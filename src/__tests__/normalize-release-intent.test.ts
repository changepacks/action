import { expect, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

const changepacks: ChangepackResultMap = {
  'packages/a/package.json': {
    logs: [],
    version: '1.0.0',
    nextVersion: '1.1.0',
    name: 'a',
    path: 'packages/a/package.json',
    changed: false,
  },
}

test('normalizeReleaseIntent preserves recovered source SHA', async () => {
  const { normalizeReleaseIntent } = await import('../normalize-release-intent')

  expect(
    normalizeReleaseIntent({ changepacks, sourceSha: 'version-update-sha' }),
  ).toEqual({ changepacks, sourceSha: 'version-update-sha' })
})

test('normalizeReleaseIntent supports legacy changepack maps without source SHA', async () => {
  const { normalizeReleaseIntent } = await import('../normalize-release-intent')

  expect(normalizeReleaseIntent(changepacks)).toEqual({
    changepacks,
    sourceSha: null,
  })
})
