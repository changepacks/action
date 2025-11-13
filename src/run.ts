import { context } from '@actions/github'
import { checkPastChangepacks } from './check-past-changepacks'
import { createPr } from './create-pr'
import { createRelease } from './create-release'
import { fetchOrigin } from './fetch-origin'
import { getChangepacksConfig } from './get-changepacks-config'
import { installChangepacks } from './install-changepacks'
import { runChangepacks } from './run-changepacks'
import { updatePrComment } from './update-pr-comment'

export async function run() {
  await installChangepacks()

  const config = await getChangepacksConfig()
  if (context.ref !== `refs/heads/${config.baseBranch}`) {
    await fetchOrigin(config.baseBranch)
  }
  const changepacks = await runChangepacks('check')
  // add pull request comment
  if (context.payload?.pull_request) {
    await updatePrComment(changepacks, context.payload.pull_request.number)
    return
  }
  if (
    Object.values(changepacks).some((changepack) => !!changepack.nextVersion)
  ) {
    await createPr(changepacks)
  } else {
    const pastChangepacks = await checkPastChangepacks()
    if (Object.keys(pastChangepacks).length > 0) {
      await createRelease(config, pastChangepacks)
    }
  }
}
