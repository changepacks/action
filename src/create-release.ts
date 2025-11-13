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
) {
  setOutput('changepacks', Object.keys(changepacks))
  if (!getBooleanInput('create_release')) {
    return
  }
  const octokit = getOctokit(getInput('token'))

  try {
    const releasePromises = Object.entries(changepacks)
      .filter(([_, changepack]) => !!changepack.nextVersion)
      .map(async ([projectPath, changepack]) => {
        const tagName = `${changepack.name}(${changepack.path})@${changepack.nextVersion}`
        await octokit.rest.git.createRef({
          ...context.repo,
          ref: `refs/tags/${tagName}`,
          sha: context.sha,
        })
        debug(`created ref: ${tagName}`)
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
        })
        return [projectPath, release.data.upload_url]
      })
    const releaseAssetsUrls = await Promise.all(releasePromises)
    await Promise.all(releasePromises)
    debug(`releaseAssetsUrls: ${JSON.stringify(releaseAssetsUrls, null, 2)}`)
    setOutput('release_assets_urls', Object.fromEntries(releaseAssetsUrls))
  } catch (err: unknown) {
    error('create release failed')
    setFailed(err as Error)
  }
}
