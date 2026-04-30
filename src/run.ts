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
            const shouldPublish = getBooleanInput('publish')
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
                const publishOptionsStr = getInput('publish_options')
                const publishOptions = publishOptionsStr
                  ? publishOptionsStr.split(/\s+/).filter(Boolean)
                  : []
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
                      error(`${path} published failed: ${res.error}`)
                      errors.push(`${path} published failed: ${res.error}`)
                    }
                  }
                  info(
                    `published changepacks output: ${JSON.stringify(
                      publishedChangepacks,
                      null,
                      2,
                    )}`,
                  )
                  // Downstream jobs should run only for packages that actually
                  // published in this run, not for release candidates or reruns.
                  setOutput('changepacks', publishedChangepacks)
                  if (errors.length > 0) {
                    await rollbackReleases(result, releaseResult)
                    setFailed(errors.join('\n'))
                    publishFailed = true
                  }
                } catch (err: unknown) {
                  error(`publish crashed: ${err}`)
                  const allFailed: Record<string, ChangepackPublishResult> =
                    Object.fromEntries(
                      publishTarget.map((path) => [
                        path,
                        {
                          result: false,
                          error: String(err),
                          stderr: null,
                          stdout: null,
                        },
                      ]),
                    )
                  await rollbackReleases(allFailed, releaseResult)
                  setFailed(err as Error)
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
