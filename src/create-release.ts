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

  info(`output: ${JSON.stringify(Object.keys(changepacks), null, 2)}`)
  setOutput('changepacks', Object.keys(changepacks))
  if (!getBooleanInput('create_release')) {
    info(`create_release is not enabled, skipping release creation`)
    endGroup()
    return {}
  }
  const octokit = getOctokit(getInput('token'))

  const releaseNumbers = new Set<number>()
  const tagNames = new Set<string>()
  try {
    const releasePromises = Object.entries(changepacks)
      .filter(([_, changepack]) => !!changepack.nextVersion)
      .map(async ([projectPath, changepack]) => {
        const tagName = `${changepack.name}(${changepack.path})@${changepack.nextVersion}`
        try {
          const refPath = `refs/tags/${tagName}`
          try {
            debug(`get ref: ${refPath}`)
            await octokit.rest.git.getRef({
              ...context.repo,
              ref: `tags/${tagName}`,
            })
            info(`ref already exists: ${tagName}`)
            tagNames.add(tagName)
          } catch (err: unknown) {
            info(`create ref: ${refPath} ${err}`)
            await octokit.rest.git.createRef({
              ...context.repo,
              ref: refPath,
              sha: context.sha,
            })
            tagNames.add(tagName)
            info(`created ref: ${tagName}`)
          }
          const makeLatest =
            config.latestPackage === projectPath ||
            Object.keys(changepacks).length === 1
          info(
            `create release: ${tagName} ${JSON.stringify(
              {
                owner: context.repo.owner,
                repo: context.repo.repo,
                name: tagName,
                body: createBody(changepack),
                tag_name: tagName,
                make_latest: makeLatest ? 'true' : 'false',
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
            make_latest: makeLatest ? 'true' : 'false',
            target_commitish: context.ref,
            draft: false,
          })
          releaseNumbers.add(release.data.id)
          info(`created release: ${tagName} ${release.data.id}`)
          return [
            projectPath,
            release.data.id,
            tagName,
            release.data.upload_url,
            makeLatest,
          ] as const
        } catch (err: unknown) {
          error(`create release failed: ${tagName} ${err}`)
          throw err
        }
      })
    const releaseResults = await Promise.all(releasePromises)
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
    ] of releaseResults) {
      releaseInfoMap[projectPath] = { releaseId, tagName, makeLatest }
    }
    return releaseInfoMap
  } catch (err: unknown) {
    error(`create release failed: ${err}`)
    setFailed(err as Error)
    if (releaseNumbers.size > 0) {
      info(
        `delete releases: ${JSON.stringify(Array.from(releaseNumbers), null, 2)}`,
      )
      await Promise.all(
        Array.from(releaseNumbers).map(async (releaseNumber) => {
          await octokit.rest.repos.deleteRelease({
            owner: context.repo.owner,
            repo: context.repo.repo,
            release_id: releaseNumber,
          })
        }),
      )
    }
    if (tagNames.size > 0) {
      info(`delete refs: ${JSON.stringify(Array.from(tagNames), null, 2)}`)
      await Promise.all(
        Array.from(tagNames).map(async (tagName) => {
          await octokit.rest.git.deleteRef({
            ...context.repo,
            ref: `tags/${tagName}`,
          })
        }),
      )
    }
    return false
  } finally {
    endGroup()
  }
}
