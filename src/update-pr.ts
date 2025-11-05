import { debug, error, getInput, setFailed } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createContents } from './create-contents'
import type { ChangepackResultMap } from './types'

export async function updatePr(
  changepacks: ChangepackResultMap,
): Promise<void> {
  const octokit = getOctokit(getInput('token'))
  const body = createContents(changepacks)

  try {
    const issue = await octokit.rest.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
    })
    debug(JSON.stringify(issue.data, null, 2))
    if (
      issue.data.user?.login === 'github-actions[bot]' &&
      issue.data.title === 'Update Versions' &&
      issue.data.body?.startsWith('# Changepacks')
    ) {
      await octokit.rest.issues.update({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body: body,
      })
    } else {
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
    }
  } catch (e) {
    error('create pr comment failed')
    setFailed(e as Error)
  }
}
