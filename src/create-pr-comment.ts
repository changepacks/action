import { error, getInput, setFailed } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createContents } from './create-contents'
import type { ChangepackResultMap } from './types'

export async function createPrComment(
  changepacks: ChangepackResultMap,
): Promise<void> {
  const octokit = getOctokit(getInput('token'))
  const body = createContents(changepacks)

  try {
    const comments = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      per_page: 100,
    })
    if (
      comments.data.some(
        (c) =>
          c.user?.login === 'github-actions[bot]' &&
          c.body?.startsWith('# Changepacks'),
      )
    ) {
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: comments.data[0].id,
        body: body,
      })
    } else {
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: body,
      })
    }
  } catch (e) {
    error('create pr comment failed')
    setFailed(e as Error)
  }
}
