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

  let rolledBackLatest = false
  for (const failedPath of failedPaths) {
    const release = releaseResult[failedPath]
    if (!release) continue
    info(`rolling back release for ${failedPath}: ${release.tagName}`)
    try {
      await octokit.rest.repos.deleteRelease({
        ...context.repo,
        release_id: release.releaseId,
      })
      await octokit.rest.git.deleteRef({
        ...context.repo,
        ref: `tags/${release.tagName}`,
      })
      info(`rolled back release: ${release.tagName}`)
      if (release.makeLatest) {
        rolledBackLatest = true
      }
    } catch (err: unknown) {
      error(`failed to rollback release ${release.tagName}: ${err}`)
    }
  }

  if (rolledBackLatest) {
    const failedPathSet = new Set(failedPaths)
    const surviving = Object.entries(releaseResult).find(
      ([path, rel]) => !failedPathSet.has(path) && rel.releaseId,
    )
    if (surviving) {
      const [survivingPath, survivingRelease] = surviving
      info(
        `reassigning latest to ${survivingPath}: ${survivingRelease.tagName}`,
      )
      try {
        await octokit.rest.repos.updateRelease({
          ...context.repo,
          release_id: survivingRelease.releaseId,
          make_latest: 'true',
        })
        info(`reassigned latest to: ${survivingRelease.tagName}`)
      } catch (err: unknown) {
        error(
          `failed to reassign latest to ${survivingRelease.tagName}: ${err}`,
        )
      }
    }
  }
}
