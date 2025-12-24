import {
  endGroup,
  error,
  getInput,
  info,
  setFailed,
  startGroup,
} from '@actions/core'
import { context, getOctokit } from '@actions/github'
import { createContents } from './create-contents'
import type { ChangepackResultMap } from './types'

export async function updatePrComment(
  changepacks: ChangepackResultMap,
  prNumber: number,
): Promise<void> {
  startGroup(`updatePrComment`)
  info(`update pr: ${prNumber}`)
  const octokit = getOctokit(getInput('token'))
  const body = createContents(changepacks)

  try {
    const comments = await octokit.rest.issues.listComments({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      per_page: 100,
    })
    const comment = comments.data.find(
      (c) =>
        c.user?.login === 'github-actions[bot]' &&
        c.body?.startsWith('# Changepacks'),
    )
    if (comment) {
      info(`update comment: ${comment.id}`)
      await octokit.rest.issues.updateComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: comment.id,
        body: body,
      })
    } else {
      info(`create comment`)
      await octokit.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        body: body,
      })
    }
  } catch (e) {
    error(`update pr comment failed: ${e}`)
    setFailed(e as Error)
  } finally {
    endGroup()
  }
}
