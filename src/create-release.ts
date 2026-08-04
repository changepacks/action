import {
  debug,
  endGroup,
  error,
  getBooleanInput,
  getInput,
  info,
  isDebug,
  setFailed,
  setOutput,
  startGroup,
  warning,
} from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type {
  ChangepackConfig,
  ChangepackResultMap,
  ReleaseInfo,
} from './types'

const RELEASE_PAGE_SIZE = 100
const MAX_RELEASE_PAGES = 5

interface DraftRelease {
  readonly id: number
  readonly uploadUrl: string
}

// `GET /releases/tags/{tag}` never returns draft releases, so a draft left
// behind by an earlier run stays invisible there and every re-run piles up
// another duplicate. Index drafts from the release list instead. Loading is
// lazy and shared because it only matters once a tag already exists.
function createDraftIndex(octokit: ReturnType<typeof getOctokit>) {
  const load = async () => {
    const drafts = new Map<string, DraftRelease[]>()
    try {
      for (let page = 1; page <= MAX_RELEASE_PAGES; page++) {
        const { data } = await octokit.rest.repos.listReleases({
          ...context.repo,
          per_page: RELEASE_PAGE_SIZE,
          page,
        })
        for (const release of data) {
          if (!release.draft) {
            continue
          }
          const bucket = drafts.get(release.tag_name)
          const draft = { id: release.id, uploadUrl: release.upload_url }
          if (bucket) {
            bucket.push(draft)
          } else {
            drafts.set(release.tag_name, [draft])
          }
        }
        if (data.length < RELEASE_PAGE_SIZE) {
          break
        }
      }
    } catch (err: unknown) {
      // Losing the index only costs deduplication, so keep releasing.
      warning(`failed to list existing draft releases: ${err}`)
    }
    return drafts
  }

  let pending: Promise<Map<string, DraftRelease[]>> | null = null
  return async (tagName: string) => {
    pending ??= load()
    return (await pending).get(tagName) ?? []
  }
}

export async function createRelease(
  config: ChangepackConfig,
  changepacks: ChangepackResultMap,
  sourceSha: string = context.sha,
): Promise<Record<string, ReleaseInfo> | false> {
  startGroup(`createRelease`)

  try {
    if (!getBooleanInput('create_release')) {
      info(`create_release is not enabled, skipping release creation`)
      return {}
    }

    const shouldPublish = getBooleanInput('publish')
    const octokit = getOctokit(getInput('token'))
    const findDrafts = createDraftIndex(octokit)
    // A shallow checkout (actions/checkout defaults to fetch-depth 1) cannot
    // push its boundary commits: GitHub rejects the tag push with "shallow
    // update not allowed". Restore full history before pushing any tag.
    if (
      (
        await getExecOutput('git', ['rev-parse', '--is-shallow-repository'], {
          silent: !isDebug(),
        })
      ).stdout.trim() === 'true'
    ) {
      await exec('git', ['fetch', '--unshallow', 'origin'], {
        silent: !isDebug(),
      })
    }
    const releasePromises = Object.entries(changepacks)
      .filter(([_, changepack]) => !!changepack.nextVersion)
      .map(async ([projectPath, changepack]) => {
        const tagName = `${changepack.name}(${changepack.path})@${changepack.nextVersion}`
        const refPath = `refs/tags/${tagName}`
        const makeLatest =
          config.latestPackage === projectPath ||
          Object.keys(changepacks).length === 1
        // When the action publishes (and finalizes) the release itself, create
        // it as a draft. Otherwise publish it immediately as a public,
        // latest-aware release.
        const makeLatestValue = !shouldPublish && makeLatest ? 'true' : 'false'
        let releaseTargetSha = sourceSha
        try {
          let tagAlreadyExisted = false
          try {
            debug(`get ref: ${refPath}`)
            await octokit.rest.git.getRef({
              ...context.repo,
              ref: `tags/${tagName}`,
            })
            tagAlreadyExisted = true
            info(`ref already exists: ${tagName}`)
          } catch (err: unknown) {
            if (
              !(err instanceof Error && 'status' in err && err.status === 404)
            ) {
              throw err
            }
            info(`create ref: ${refPath} ${err}`)
            let pushResult = await getExecOutput(
              'git',
              ['push', 'origin', `${sourceSha}:${refPath}`],
              { ignoreReturnCode: true, silent: !isDebug() },
            )
            // The default GITHUB_TOKEN (a GitHub App) cannot create a ref at a
            // commit whose workflow files differ from the default branch HEAD.
            // Fall back to tagging HEAD, which carries the same released
            // versions.
            if (
              pushResult.exitCode !== 0 &&
              sourceSha !== context.sha &&
              /refusing to allow a github app to create or update workflow/i.test(
                pushResult.stderr,
              )
            ) {
              info(
                `workflow-protected push rejected, retrying at HEAD: ${tagName}`,
              )
              releaseTargetSha = context.sha
              pushResult = await getExecOutput(
                'git',
                ['push', 'origin', `${context.sha}:${refPath}`],
                { ignoreReturnCode: true, silent: !isDebug() },
              )
            }
            if (pushResult.exitCode !== 0) {
              throw new Error(
                `git push failed: ${pushResult.stderr.trim() || pushResult.stdout.trim()}`,
              )
            }
            info(`pushed ref: ${tagName}`)
          }

          if (tagAlreadyExisted) {
            try {
              const existingRelease = await octokit.rest.repos.getReleaseByTag({
                ...context.repo,
                tag: tagName,
              })
              info(
                `release already exists: ${tagName} ${existingRelease.data.id}`,
              )
              return [
                projectPath,
                existingRelease.data.id,
                tagName,
                existingRelease.data.upload_url,
                makeLatest,
                existingRelease.data.draft ? 'pending' : 'published',
              ] as const
            } catch (err: unknown) {
              info(`release does not exist for existing ref: ${tagName} ${err}`)
            }

            // Drafts are invisible above, so reuse one of them and drop the
            // duplicates earlier runs left behind.
            const [reused, ...duplicates] = await findDrafts(tagName)
            for (const duplicate of duplicates) {
              try {
                await octokit.rest.repos.deleteRelease({
                  ...context.repo,
                  release_id: duplicate.id,
                })
                info(
                  `deleted duplicate draft release: ${tagName} ${duplicate.id}`,
                )
              } catch (err: unknown) {
                warning(
                  `failed to delete duplicate draft release: ${tagName} ${duplicate.id} ${err}`,
                )
              }
            }
            if (reused) {
              info(`draft release already exists: ${tagName} ${reused.id}`)
              return [
                projectPath,
                reused.id,
                tagName,
                reused.uploadUrl,
                makeLatest,
                'pending',
              ] as const
            }
          }

          info(
            `create release: ${tagName} ${JSON.stringify(
              {
                owner: context.repo.owner,
                repo: context.repo.repo,
                name: tagName,
                body: createBody(changepack),
                tag_name: tagName,
                make_latest: makeLatestValue,
                target_commitish: releaseTargetSha,
                draft: shouldPublish,
              },
              null,
              2,
            )}`,
          )
          const release = await octokit.rest.repos.createRelease({
            owner: context.repo.owner,
            repo: context.repo.repo,
            name: tagName,
            body: createBody(changepack),
            tag_name: tagName,
            make_latest: makeLatestValue,
            target_commitish: releaseTargetSha,
            draft: shouldPublish,
          })
          info(`created release: ${tagName} ${release.data.id}`)
          return [
            projectPath,
            release.data.id,
            tagName,
            release.data.upload_url,
            makeLatest,
            'pending',
          ] as const
        } catch (err: unknown) {
          error(`create release failed: ${tagName} ${err}`)
          setFailed(err as Error)

          return null
        }
      })

    const releaseResults = (await Promise.all(releasePromises)).filter(
      (releaseResult) => releaseResult !== null,
    )
    const releaseAssetsUrls = releaseResults.map(
      ([projectPath, _releaseId, _tagName, uploadUrl]) =>
        [projectPath, uploadUrl] as const,
    )
    info(`releaseAssetsUrls: ${JSON.stringify(releaseAssetsUrls, null, 2)}`)
    setOutput('release_assets_urls', Object.fromEntries(releaseAssetsUrls))
    const releaseInfoMap: Record<string, ReleaseInfo> = {}
    for (const [
      projectPath,
      releaseId,
      tagName,
      _uploadUrl,
      makeLatest,
      status,
    ] of releaseResults) {
      releaseInfoMap[projectPath] = {
        releaseId,
        tagName,
        makeLatest,
        status,
      }
    }
    const pendingReleases = Object.fromEntries(
      Object.entries(releaseInfoMap)
        .filter(([_, release]) => release.status === 'pending')
        .map(([projectPath, release]) => [
          projectPath,
          {
            releaseId: release.releaseId,
            tagName: release.tagName,
            makeLatest: release.makeLatest,
          },
        ]),
    )
    setOutput('pending_releases', pendingReleases)
    return releaseInfoMap
  } finally {
    endGroup()
  }
}
