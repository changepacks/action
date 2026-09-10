import { expect, mock, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { preservePublishConfig } from '../preserve-publish-config'

test('release retries use current publish commands and restore exact source config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-config-'))
  const path = join(root, '.changepacks/config.json')
  const original = '{"ignore":["examples/**"],"publish":{},"future":true}\n'
  try {
    await mkdir(join(root, '.changepacks'))
    await writeFile(path, original)
    const commands = {
      publish: { node: 'npm publish' },
      publishDryRun: { node: 'npm publish --dry-run' },
    }
    const restore = await preservePublishConfig(commands, root)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      ignore: ['examples/**'],
      future: true,
      ...commands,
    })
    await restore()
    expect(await readFile(path, 'utf8')).toBe(original)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('removed overrides do not revive commands from the release source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-config-'))
  const path = join(root, '.changepacks/config.json')
  try {
    await mkdir(join(root, '.changepacks'))
    await writeFile(path, JSON.stringify({ publish: { node: 'bun publish' } }))
    const restore = await preservePublishConfig({}, root)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      publish: {},
      publishDryRun: {},
    })
    await restore()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a release source without config gets temporary commands only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-config-'))
  const path = join(root, '.changepacks/config.json')
  try {
    const restore = await preservePublishConfig(
      { publish: { node: 'npm publish' } },
      root,
    )
    expect(JSON.parse(await readFile(path, 'utf8')).publish.node).toBe(
      'npm publish',
    )
    await restore()
    expect(await Bun.file(path).exists()).toBe(false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('invalid source config fails without changing its contents', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-config-'))
  const path = join(root, '.changepacks/config.json')
  try {
    await mkdir(join(root, '.changepacks'))
    await writeFile(path, 'invalid json')
    await expect(preservePublishConfig({}, root)).rejects.toThrow()
    expect(await readFile(path, 'utf8')).toBe('invalid json')
    await rm(path)
    await mkdir(path)
    await expect(preservePublishConfig({}, root)).rejects.toThrow()
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a failed overlay write restores the release config before rejecting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'publish-config-'))
  const path = join(root, '.changepacks/config.json')
  const originalFs = { ...(await import('node:fs/promises')) }
  const original = '{"publish":{}}\n'
  const failure = new Error('write interrupted')
  try {
    await mkdir(join(root, '.changepacks'))
    await writeFile(path, original)
    let firstWrite = true
    mock.module('node:fs/promises', () => ({
      ...originalFs,
      writeFile: mock(async (...args: Parameters<typeof writeFile>) => {
        if (firstWrite) {
          firstWrite = false
          await originalFs.writeFile(path, '{')
          throw failure
        }
        return originalFs.writeFile(...args)
      }),
    }))
    await expect(preservePublishConfig({}, root)).rejects.toThrow(failure)
    expect(await readFile(path, 'utf8')).toBe(original)
  } finally {
    mock.module('node:fs/promises', () => originalFs)
    await rm(root, { recursive: true, force: true })
  }
})
