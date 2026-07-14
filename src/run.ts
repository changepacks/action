import {
  getBooleanInput,
  getInput,
  info,
  isDebug,
  setOutput,
} from '@actions/core'
import { exec } from '@actions/exec'
import { context } from '@actions/github'
import { checkPastChangepacks } from './check-past-changepacks'
import { createPr } from './create-pr'
import { createRelease } from './create-release'
import { fetchOrigin } from './fetch-origin'
import {
  finalizeReleases,
  parseFinalizeReleasesInput,
} from './finalize-releases'
import { getChangepacksConfig } from './get-changepacks-config'
import { installChangepacks } from './install-changepacks'
import { normalizeReleaseIntent } from './normalize-release-intent'
import { publishChangepacks } from './publish-changepacks'
import { runChangepacks } from './run-changepacks'
import { sendSlackNotification } from './send-slack-notification'
import { updatePrComment } from './update-pr-comment'
import { validatePublish } from './validate-publish'

export async function run() {
  const finalizeInput = getInput('finalize_releases')
  if (finalizeInput) {
    const finalizedPaths = await finalizeReleases(
      parseFinalizeReleasesInput(finalizeInput),
    )
    setOutput('changepacks', finalizedPaths)
    return
  }

  let restoreBranch: string | null = null
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
        const pastRelease = await checkPastChangepacks({ includeSource: true })
        if (!pastRelease) {
          return
        }
        const { changepacks: pastChangepacks, sourceSha } =
          normalizeReleaseIntent(pastRelease)
        const filteredPastChangepacks = Object.fromEntries(
          Object.entries(pastChangepacks).filter(([key, changepack]) => {
            if (changepacks[key]) {
              return changepacks[key].version === changepack.nextVersion
            }
            return changepack.nextVersion !== null
          }),
        )
        if (Object.keys(filteredPastChangepacks).length > 0) {
          if (sourceSha) {
            await exec('git', ['checkout', sourceSha], {
              silent: !isDebug(),
            })
            restoreBranch = config.baseBranch
          }
          const shouldPublish = getBooleanInput('publish')
          const publishOptionsStr = getInput('publish_options')
          const publishOptions = publishOptionsStr
            ? publishOptionsStr.split(/\s+/).filter(Boolean)
            : []
          const releaseResult = sourceSha
            ? await createRelease(config, filteredPastChangepacks, sourceSha)
            : await createRelease(config, filteredPastChangepacks)
          if (releaseResult) {
            const pendingChangepacks = Object.fromEntries(
              Object.entries(filteredPastChangepacks).filter(
                ([path]) => releaseResult[path]?.status === 'pending',
              ),
            )
            const pendingPaths = Object.keys(pendingChangepacks)
            if (pendingPaths.length === 0) {
              setOutput('changepacks', [])
              return
            }
            if (
              shouldPublish &&
              !(await validatePublish(pendingPaths, publishOptions))
            ) {
              return
            }
            await sendSlackNotification(pendingChangepacks)
            if (!shouldPublish) {
              setOutput('changepacks', pendingPaths)
            }
            if (shouldPublish) {
              await publishChangepacks({
                targets: pendingPaths,
                publishOptions,
                releases: releaseResult,
              })
            }
          }
        }
      }
    }
  } finally {
    try {
      if (restoreBranch) {
        await exec('git', ['checkout', restoreBranch], {
          silent: !isDebug(),
        })
      }
    } finally {
      await exec('git', ['clean', '-fd'], {
        silent: !isDebug(),
      })
    }
  }
}
