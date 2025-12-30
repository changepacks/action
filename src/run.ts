import {
  debug,
  error,
  getBooleanInput,
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
import { runChangepacks } from './run-changepacks'
import { sendSlackNotification } from './send-slack-notification'
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
        debug(
          `filteredPastChangepacks: ${JSON.stringify(filteredPastChangepacks, null, 2)}`,
        )
        if (
          Object.keys(filteredPastChangepacks).length > 0 &&
          (await createRelease(config, filteredPastChangepacks))
        ) {
          await sendSlackNotification(filteredPastChangepacks)
          if (getBooleanInput('publish')) {
            const result = await runChangepacks('publish')
            for (const [path, res] of Object.entries(result)) {
              if (res.result) {
                info(`${path} published successfully`)
              } else {
                error(`${path} published failed: ${res.error}`)
                setFailed(`${path} published failed: ${res.error}`)
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
