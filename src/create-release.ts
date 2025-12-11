import {
  debug,
  error,
  getBooleanInput,
  getInput,
  setFailed,
  setOutput,
} from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackConfig, ChangepackResultMap } from './types'

export async function createRelease(
  config: ChangepackConfig,
  changepacks: ChangepackResultMap,
): Promise<boolean> {
  debug(`createRelease`)
  debug(
    `output changepacks: ${JSON.stringify(Object.keys(changepacks), null, 2)}`,
  )
  setOutput('changepacks', Object.keys(changepacks))
  if (!getBooleanInput('create_release')) {
    return true
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
            debug(`ref already exists: ${tagName}`)
            tagNames.add(tagName)
          } catch (err: unknown) {
            debug(`create ref: ${refPath} ${err}`)
            await octokit.rest.git.createRef({
              ...context.repo,
              ref: refPath,
              sha: context.sha,
            })
            tagNames.add(tagName)
            debug(`created ref: ${tagName}`)
          }
          debug(
            `create release: ${tagName} ${JSON.stringify(
              {
                owner: context.repo.owner,
                repo: context.repo.repo,
                name: tagName,
                body: createBody(changepack),
                tag_name: tagName,
                make_latest:
                  config.latestPackage === projectPath ||
                  Object.keys(changepacks).length === 1
                    ? 'true'
                    : 'false',
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
            make_latest:
              config.latestPackage === projectPath ||
              Object.keys(changepacks).length === 1
                ? 'true'
                : 'false',
            target_commitish: context.ref,
            draft: false,
          })
          releaseNumbers.add(release.data.id)
          debug(`created release: ${tagName} ${release.data.id}`)
          return [projectPath, release.data.upload_url]
        } catch (err: unknown) {
          error(`create release failed: ${tagName} ${err}`)
          throw err
        }
      })
    const releaseAssetsUrls = await Promise.all(releasePromises)
    debug(`releaseAssetsUrls: ${JSON.stringify(releaseAssetsUrls, null, 2)}`)
    setOutput('release_assets_urls', Object.fromEntries(releaseAssetsUrls))
    return true
  } catch (err: unknown) {
    error('create release failed')
    setFailed(err as Error)
    if (releaseNumbers.size > 0) {
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
  }
}
