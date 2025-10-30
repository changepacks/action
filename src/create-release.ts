import {
  error,
  getBooleanInput,
  getInput,
  setFailed,
  setOutput,
} from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createRelease(changepacks: ChangepackResultMap) {
  setOutput('changepacks', Object.keys(changepacks))
  if (!getBooleanInput('create_release')) {
    return
  }
  const octokit = getOctokit(getInput('token'))

  try {
    const releasePromises = Object.entries(changepacks)
      .filter(([_, changepack]) => !!changepack.nextVersion)
      .map(async ([projectPath, changepack]) => {
        const release = await octokit.rest.repos.createRelease({
          owner: context.repo.owner,
          repo: context.repo.repo,
          title: `${changepack.name}@${changepack.nextVersion}`,
          body: createBody(changepack),
          // biome-ignore lint/style/noNonNullAssertion: filter
          tag_name: changepack.nextVersion!,
          target_commitish: context.ref,
        })
        return [projectPath, release.data.assets_url]
      })
    const releaseAssetsUrls = await Promise.all(releasePromises)
    await Promise.all(releasePromises)
    setOutput('release_assets_urls', Object.fromEntries(releaseAssetsUrls))
  } catch (err: unknown) {
    error('create release failed')
    setFailed(err as Error)
  }
}
