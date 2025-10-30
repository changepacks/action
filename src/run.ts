import { checkChangepacks } from './check-changepacks'
import { checkPastChangepacks } from './check-past-changepacks'
import { createPr } from './create-pr'
import { createRelease } from './create-release'
import { installChangepacks } from './install-changepacks'

export async function run() {
  await installChangepacks()
  const changepacks = await checkChangepacks()
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
