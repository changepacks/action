import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChangepackConfig } from './types'

// Keep release contents pinned while using the workflow's current publish policy.
// Restore the original bytes before checking out the workflow branch again.
export async function preservePublishConfig(
  config: Pick<ChangepackConfig, 'publish' | 'publishDryRun'>,
  root = process.cwd(),
): Promise<() => Promise<void>> {
  const path = join(root, '.changepacks/config.json')
  let original: Buffer | undefined
  try {
    original = await readFile(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const sourceConfig = original ? JSON.parse(original.toString('utf8')) : {}
  const updated = JSON.stringify({
    ...sourceConfig,
    publish: config.publish ?? {},
    publishDryRun: config.publishDryRun ?? {},
  })
  const restore = async () => {
    if (original) await writeFile(path, original)
    else await rm(path, { force: true })
  }
  await mkdir(dirname(path), { recursive: true })
  try {
    await writeFile(path, updated)
  } catch (error) {
    await restore()
    throw error
  }
  return restore
}
