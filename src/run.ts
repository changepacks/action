import {
  error,
  getBooleanInput,
  getInput,
  info,
  isDebug,
  setFailed,
  setOutput,
} from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { checkPastChangepacks } from './check-past-changepacks'
import { createPr } from './create-pr'
import { createRelease } from './create-release'
import { fetchOrigin } from './fetch-origin'
import { getChangepacksConfig } from './get-changepacks-config'
import { installChangepacks } from './install-changepacks'
import { rollbackReleases } from './rollback-releases'
import { runChangepacks } from './run-changepacks'
import { sendSlackNotification } from './send-slack-notification'
import type { ChangepackPublishResult } from './types'
import { updatePrComment } from './update-pr-comment'

/**
 * Resolve a human-readable failure message from a `changepacks publish`
 * result. Falls back to `'unknown error'` so log lines never print
 * `undefined` or `null` when both fields are missing.
 */
function formatPublishError(
  res: Pick<ChangepackPublishResult, 'error' | 'stderr'> | undefined,
): string {
  return res?.error ?? res?.stderr ?? 'unknown error'
}

/**
 * Build a uniform `Record<path, ChangepackPublishResult>` marking every
 * publish target as failed, used to feed `rollbackReleases` when the
 * publish pipeline must abort as a batch (dry-run failure, dry-run crash,
 * actual publish crash). The `errorBuilder` callback lets each call site
 * shape the per-package error message while reusing the rollback contract.
 */
function buildAllFailed(
  publishTarget: string[],
  errorBuilder: (res: ChangepackPublishResult | undefined) => string,
  resultByPath: Record<string, ChangepackPublishResult> = {},
): Record<string, ChangepackPublishResult> {
  return Object.fromEntries(
    publishTarget.map((path) => {
      const res = resultByPath[path]
      return [
        path,
        {
          result: false,
          error: errorBuilder(res),
          stderr: res?.stderr ?? null,
          stdout: res?.stdout ?? null,
        },
      ]
    }),
  )
}

export async function run() {
  try {
    await installChangepacks()

    const config = await getChangepacksConfig()
    const isBaseBranch = context.ref === `refs/heads/${config.baseBranch}`
    if (!isBaseBranch) {
      await fetchOrigin(config.baseBranch)
    }
    const changepacks = await runChangepacks(
      'check',
      ...(isBaseBranch ? [] : ['--remote']),
    )
    info(`changepacks result: ${JSON.stringify(changepacks, null, 2)}`)
    // add pull request comment
    if (context.payload?.pull_request) {
      await updatePrComment(changepacks, context.payload.pull_request.number)
    } else if (isBaseBranch) {
      // push to base branch
      if (
        Object.values(changepacks).some(
          (changepack) => !!changepack.nextVersion,
        )
      ) {
        await createPr(changepacks)
      } else {
        const pastChangepacks = await checkPastChangepacks()
        const filteredPastChangepacks = Object.fromEntries(
          Object.entries(pastChangepacks).filter(([key, changepack]) => {
            if (changepacks[key]) {
              return changepacks[key].version === changepack.nextVersion
            }
            return changepack.nextVersion !== null
          }),
        )
        if (Object.keys(filteredPastChangepacks).length > 0) {
          const shouldPublish = getBooleanInput('publish')
          const publishOptionsStr = getInput('publish_options')
          const publishOptions = publishOptionsStr
            ? publishOptionsStr.split(/\s+/).filter(Boolean)
            : []
          // GATE: when publish is requested, validate the publish pipeline
          // with `changepacks publish --dry-run` BEFORE any GitHub release
          // / tag is created. A dry-run failure must abort the entire run
          // so the user does not end up with stale releases that block
          // subsequent retries (the rerun would otherwise hit the
          // "all releases already exist, skipping publish" branch and the
          // original failure reason stays hidden).
          if (shouldPublish) {
            const dryRunTarget = Object.keys(filteredPastChangepacks)
            try {
              const dryRunResult = await runChangepacks(
                'publish',
                '--dry-run',
                ...dryRunTarget.flatMap((path) => ['-p', path]),
                ...publishOptions,
              )
              const dryRunErrors: string[] = []
              for (const [path, res] of Object.entries(dryRunResult)) {
                if (res.result) {
                  info(`${path} dry-run succeeded`)
                  if (res.stdout) {
                    info(`dry-run stdout: ${res.stdout}`)
                  }
                } else {
                  const msg = `${path} dry-run failed: ${formatPublishError(res)}`
                  error(msg)
                  dryRunErrors.push(msg)
                }
              }
              if (dryRunErrors.length > 0) {
                setFailed(dryRunErrors.join('\n'))
                return
              }
            } catch (err: unknown) {
              error(`publish --dry-run crashed: ${err}`)
              setFailed(err instanceof Error ? err : String(err))
              return
            }
          }
          // Dry-run passed (or publish was not requested): create the
          // GitHub releases and proceed with the actual publish step.
          const releaseResult = await createRelease(
            config,
            filteredPastChangepacks,
          )
          if (releaseResult) {
            const releasedChangepacks = Object.fromEntries(
              Object.entries(filteredPastChangepacks).filter(
                ([path]) => !!releaseResult[path],
              ),
            )
            await sendSlackNotification(releasedChangepacks)
            let publishFailed = false
            const publishedChangepacks: string[] = []
            if (!shouldPublish) {
              const releasedChangepackPaths = Object.keys(releasedChangepacks)
              if (releasedChangepackPaths.length > 0) {
                setOutput('changepacks', releasedChangepackPaths)
              }
            }
            if (shouldPublish) {
              const publishTarget = Object.keys(filteredPastChangepacks).filter(
                (path) =>
                  releaseResult[path] && !releaseResult[path].alreadyExisted,
              )
              info(`publish target: ${publishTarget.join(', ')}`)
              if (publishTarget.length === 0) {
                // Every release already existed, so this is a rerun after a
                // previous successful release step. Do not call publish without
                // -p targets because that could publish unrelated packages.
                setOutput('changepacks', publishedChangepacks)
                info('all releases already exist, skipping publish')
              } else {
                // Actual publish. Dry-run already validated the pipeline
                // above, so any failure here is a real registry-side error
                // and we still defensively roll back the releases we just
                // created.
                try {
                  const result = await runChangepacks(
                    'publish',
                    ...publishTarget.flatMap((path) => ['-p', path]),
                    ...publishOptions,
                  )
                  const errors = []

                  for (const [path, res] of Object.entries(result)) {
                    if (res.result) {
                      info(`${path} published successfully`)
                      info(`stdout: ${res.stdout}`)
                      publishedChangepacks.push(path)
                    } else {
                      // Use `formatPublishError` so the same fallback chain
                      // (error → stderr → 'unknown error') applies as the
                      // dry-run failure path. Keeps the surfaced message
                      // identical to the existing test expectation when
                      // `res.error` is set, and avoids printing `null`
                      // / `undefined` when only stderr is populated.
                      const msg = `${path} published failed: ${formatPublishError(res)}`
                      error(msg)
                      errors.push(msg)
                    }
                  }
                  // Targets in `publishTarget` that are missing from `result`
                  // were filtered out by changepacks itself (typically via
                  // `publish_options: -l <language>` or `language` input).
                  // Their release tags were already created and the actual
                  // publishing is expected to happen in downstream workflows
                  // (e.g. npm/pypi publish jobs built from these tags), so
                  // they must still appear in the `changepacks` output to
                  // trigger those downstream jobs.
                  const filteredOutTargets = publishTarget.filter(
                    (path) => !(path in result),
                  )
                  if (filteredOutTargets.length > 0) {
                    info(
                      `not published by changepacks, delegated downstream: ${filteredOutTargets.join(
                        ', ',
                      )}`,
                    )
                    publishedChangepacks.push(...filteredOutTargets)
                  }
                  info(
                    `published changepacks output: ${JSON.stringify(
                      publishedChangepacks,
                      null,
                      2,
                    )}`,
                  )
                  // Downstream jobs should run for every package that was
                  // either published in this run or delegated to another
                  // pipeline via a language filter. Reruns where releases
                  // already existed are excluded earlier in the flow.
                  setOutput('changepacks', publishedChangepacks)
                  if (errors.length > 0) {
                    await rollbackReleases(result, releaseResult)
                    setFailed(errors.join('\n'))
                    publishFailed = true
                  }
                } catch (err: unknown) {
                  error(`publish crashed: ${err}`)
                  await rollbackReleases(
                    buildAllFailed(publishTarget, () => String(err)),
                    releaseResult,
                  )
                  setFailed(err instanceof Error ? err : String(err))
                  publishFailed = true
                }
              }
            }
            if (!publishFailed) {
              const latestEntry = Object.entries(releaseResult).find(
                ([_, rel]) => rel.makeLatest,
              )
              if (latestEntry) {
                const [, latestRelease] = latestEntry
                const octokit = getOctokit(getInput('token'))
                info(`updating latest: ${latestRelease.tagName}`)
                await octokit.rest.repos.updateRelease({
                  ...context.repo,
                  release_id: latestRelease.releaseId,
                  make_latest: 'true',
                })
                info(`updated latest: ${latestRelease.tagName}`)
              }
            }
          }
        }
      }
    }
  } finally {
    await exec('git', ['clean', '-fd'], {
      silent: !isDebug(),
    })
  }
}
