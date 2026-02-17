import { error, getInput, info } from '@actions/core'
import { context, getOctokit } from '@actions/github'
import type { ChangepackPublishResult, ReleaseInfo } from './types'

export async function rollbackReleases(
  publishResult: Record<string, ChangepackPublishResult>,
  releaseResult: Record<string, ReleaseInfo>,
) {
  const octokit = getOctokit(getInput('token'))
  const failedPaths = Object.entries(publishResult)
    .filter(([_, res]) => !res.result)
    .map(([path]) => path)

  for (const failedPath of failedPaths) {
    const release = releaseResult[failedPath]
    if (!release) continue
    info(`rolling back release for ${failedPath}: ${release.tagName}`)
    try {
      await octokit.rest.repos.deleteRelease({
        ...context.repo,
        release_id: release.releaseId,
      })
    } catch (err: unknown) {
      error(`failed to delete release ${release.tagName}: ${err}`)
    }
    try {
      await octokit.rest.git.deleteRef({
        ...context.repo,
        ref: `tags/${release.tagName}`,
      })
    } catch (err: unknown) {
      error(`failed to delete tag ${release.tagName}: ${err}`)
    }
    info(`rolled back release: ${release.tagName}`)
  }
}
