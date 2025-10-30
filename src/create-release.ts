import { getInput, setOutput } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createRelease(changepacks: ChangepackResultMap) {
  setOutput('changepacks', Object.keys(changepacks))
  const octokit = getOctokit(getInput('token'))

  const releasePromises = Object.entries(changepacks).map(
    ([_projectPath, changepack]) =>
      octokit.rest.repos.createRelease({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: `${changepack.name}@${changepack.nextVersion}`,
        body: createBody(changepack),
        tag_name: changepack.nextVersion,
        target_commitish: context.ref,
      }),
  )

  await Promise.all(releasePromises)
}
