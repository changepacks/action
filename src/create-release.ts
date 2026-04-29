import {
  debug,
  endGroup,
  error,
  getBooleanInput,
  getInput,
  info,
  setFailed,
  setOutput,
  startGroup,
} from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type {
  ChangepackConfig,
  ChangepackResultMap,
  ReleaseInfo,
} from './types'

export async function createRelease(
  config: ChangepackConfig,
  changepacks: ChangepackResultMap,
): Promise<Record<string, ReleaseInfo> | false> {
  startGroup(`createRelease`)

  try {
    if (!getBooleanInput('create_release')) {
      info(`create_release is not enabled, skipping release creation`)
      return {}
    }

    const octokit = getOctokit(getInput('token'))
    const releasePromises = Object.entries(changepacks)
      .filter(([_, changepack]) => !!changepack.nextVersion)
      .map(async ([projectPath, changepack]) => {
        const tagName = `${changepack.name}(${changepack.path})@${changepack.nextVersion}`
        const refPath = `refs/tags/${tagName}`
        const makeLatest =
          config.latestPackage === projectPath ||
          Object.keys(changepacks).length === 1
        let createdTagName: string | null = null

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
            info(`create ref: ${refPath} ${err}`)
            await octokit.rest.git.createRef({
              ...context.repo,
              ref: refPath,
              sha: context.sha,
            })
            createdTagName = tagName
            info(`created ref: ${tagName}`)
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
                true,
              ] as const
            } catch (err: unknown) {
              info(`release does not exist for existing ref: ${tagName} ${err}`)
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
                make_latest: 'false',
                target_commitish: context.ref,
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
            make_latest: 'false',
            target_commitish: context.ref,
            draft: false,
          })
          info(`created release: ${tagName} ${release.data.id}`)
          return [
            projectPath,
            release.data.id,
            tagName,
            release.data.upload_url,
            makeLatest,
            false,
          ] as const
        } catch (err: unknown) {
          error(`create release failed: ${tagName} ${err}`)
          setFailed(err as Error)

          // A failure for one package should not delete releases that were
          // already created for other packages. Only clean artifacts created
          // for this package in the current attempt.
          if (createdTagName) {
            try {
              await octokit.rest.git.deleteRef({
                ...context.repo,
                ref: `tags/${createdTagName}`,
              })
            } catch (deleteErr: unknown) {
              error(`failed to delete tag ${createdTagName}: ${deleteErr}`)
            }
          }
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
      alreadyExisted,
    ] of releaseResults) {
      releaseInfoMap[projectPath] = {
        releaseId,
        tagName,
        makeLatest,
        ...(alreadyExisted ? { alreadyExisted } : {}),
      }
    }
    return releaseInfoMap
  } finally {
    endGroup()
  }
}
