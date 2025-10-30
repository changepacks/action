import { getBooleanInput, getInput, setOutput } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createRelease(changepacks: ChangepackResultMap) {
  setOutput('changepacks', Object.keys(changepacks))
  if (!getBooleanInput('create_release')) {
    return
  }
  const octokit = getOctokit(getInput('token'))

  const releasePromises = Object.entries(changepacks).map(
    async ([projectPath, changepack]) => {
      const release = await octokit.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `${changepack.name}@${changepack.nextVersion}`,
        body: createBody(changepack),
        tag_name: changepack.nextVersion,
        target_commitish: context.ref,
      })
      return [projectPath, release.data.assets_url]
    },
  )
  const releaseAssetsUrls = await Promise.all(releasePromises)
  setOutput('release_assets_urls', Object.fromEntries(releaseAssetsUrls))
  await Promise.all(releasePromises)
}
