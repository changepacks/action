import {
  error,
  getBooleanInput,
  getInput,
  info,
  isDebug,
  setFailed,
} from '@actions/core'
import { exec } from '@actions/exec'
import { context } from '@actions/github'
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
    const changepacks = await runChangepacks('check')
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
            await sendSlackNotification(filteredPastChangepacks)
            if (getBooleanInput('publish')) {
              const publishTarget = Object.keys(filteredPastChangepacks)
              info(`publish target: ${publishTarget.join(', ')}`)
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
                  } else {
                    error(`${path} published failed: ${res.error}`)
                    errors.push(`${path} published failed: ${res.error}`)
                  }
                }
                if (errors.length > 0) {
                  await rollbackReleases(result, releaseResult)
                  setFailed(errors.join('\n'))
                }
              } catch (err: unknown) {
                error(`publish crashed: ${err}`)
                const allFailed: Record<string, ChangepackPublishResult> =
                  Object.fromEntries(
                    publishTarget.map((path) => [
                      path,
                      { result: false, error: String(err) },
                    ]),
                  )
                await rollbackReleases(allFailed, releaseResult)
                setFailed(err as Error)
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
