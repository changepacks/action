import {
  endGroup,
  error,
  info,
  setFailed,
  setOutput,
  startGroup,
} from '@actions/core'
import { finalizeReleases } from './finalize-releases'
import { formatPublishError } from './format-publish-error'
import { runChangepacks } from './run-changepacks'
import type { ReleaseInfo } from './types'

interface PublishChangepacksOptions {
  readonly targets: readonly string[]
  readonly publishOptions: readonly string[]
  readonly releases: Readonly<Record<string, ReleaseInfo>>
}

interface PublishChangepacksResult {
  readonly failed: boolean
  readonly publishedPaths: readonly string[]
}

function pendingReleaseReceipts(
  releases: Readonly<Record<string, ReleaseInfo>>,
  finalizedPaths: ReadonlySet<string>,
) {
  return Object.fromEntries(
    Object.entries(releases)
      .filter(
        ([path, release]) =>
          release.status === 'pending' && !finalizedPaths.has(path),
      )
      .map(([path, release]) => [
        path,
        {
          releaseId: release.releaseId,
          tagName: release.tagName,
          makeLatest: release.makeLatest,
        },
      ]),
  )
}

export async function publishChangepacks({
  targets,
  publishOptions,
  releases,
}: PublishChangepacksOptions): Promise<PublishChangepacksResult> {
  const publishedPaths: string[] = []
  info(`publish target: ${targets.join(', ')}`)
  if (targets.length === 0) {
    setOutput('changepacks', publishedPaths)
    info('all releases are published, skipping publish')
    return { failed: false, publishedPaths }
  }

  info(`publishing: ${targets.join(', ')}`)
  startGroup('publish')
  try {
    const result = await runChangepacks(
      'publish',
      ...targets.flatMap((path) => ['-p', path]),
      ...publishOptions,
    )
    const failures: string[] = []
    for (const [path, publishResult] of Object.entries(result)) {
      if (publishResult.result) {
        info(`${path} published successfully`)
        if (publishResult.stdout) {
          info(`publish stdout: ${publishResult.stdout}`)
        }
        if (publishResult.stderr) {
          info(`publish stderr: ${publishResult.stderr}`)
        }
        publishedPaths.push(path)
      } else {
        const message = `${path} published failed: ${formatPublishError(publishResult)}`
        error(message)
        if (publishResult.stdout) {
          error(`${path} publish stdout: ${publishResult.stdout}`)
        }
        if (publishResult.stderr) {
          error(`${path} publish stderr: ${publishResult.stderr}`)
        }
        failures.push(message)
      }
    }

    const delegatedTargets = targets.filter((path) => !(path in result))
    if (delegatedTargets.length > 0) {
      info(
        `not published by changepacks, delegated downstream: ${delegatedTargets.join(', ')}`,
      )
      publishedPaths.push(...delegatedTargets)
    }
    info(
      `published changepacks output: ${JSON.stringify(publishedPaths, null, 2)}`,
    )
    setOutput('changepacks', publishedPaths)

    const finalizedReleases = Object.fromEntries(
      publishedPaths
        .filter(
          (path) =>
            result[path]?.result === true &&
            releases[path]?.status === 'pending',
        )
        .map((path) => [path, releases[path]]),
    )
    setOutput('pending_releases', pendingReleaseReceipts(releases, new Set()))
    if (Object.keys(finalizedReleases).length > 0) {
      try {
        await finalizeReleases(finalizedReleases)
      } catch (caught: unknown) {
        error(`release finalization failed: ${caught}`)
        info(
          'registry publication succeeded; retry with finalize_releases using the pending_releases output',
        )
        setFailed(caught instanceof Error ? caught : String(caught))
        return { failed: true, publishedPaths }
      }
    }
    setOutput(
      'pending_releases',
      pendingReleaseReceipts(releases, new Set(Object.keys(finalizedReleases))),
    )

    if (failures.length > 0) {
      setFailed(failures.join('\n'))
      return { failed: true, publishedPaths }
    }
    info(
      `publish summary: ${publishedPaths.length}/${targets.length} succeeded (${publishedPaths.join(', ') || 'none'})`,
    )
    return { failed: false, publishedPaths }
  } catch (caught: unknown) {
    error(`publish crashed: ${caught}`)
    setFailed(caught instanceof Error ? caught : String(caught))
    return { failed: true, publishedPaths }
  } finally {
    endGroup()
  }
}
