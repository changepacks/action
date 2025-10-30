import { getInput } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createPrComment(
  changepacks: ChangepackResultMap,
): Promise<void> {
  const octokit = getOctokit(getInput('token'))
  const comment = Object.values(changepacks).map(createBody).join('\n')
  await octokit.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: comment,
  })
}
