import { context } from '@actions/github'
import { checkPastChangepacks } from './check-past-changepacks'
import { createPr } from './create-pr'
import { createPrComment } from './create-pr-comment'
import { createRelease } from './create-release'
import { installChangepacks } from './install-changepacks'
import { runChangepacks } from './run-changepacks'

export async function run() {
  await installChangepacks()
  const changepacks = await runChangepacks('check')
  // add pull request comment
  if (context.payload?.pull_request) {
    await createPrComment(changepacks)
    return
  }
  if (
    Object.values(changepacks).some((changepack) => !!changepack.nextVersion)
  ) {
    await createPr(changepacks)
  } else {
    const pastChangepacks = await checkPastChangepacks()
    if (Object.keys(pastChangepacks).length > 0) {
      await createRelease(pastChangepacks)
    }
  }
}
