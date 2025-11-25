import { expect, test } from 'bun:test'
import { createContents } from '../create-contents'
import type { ChangepackResultMap } from '../types'

test('createContents generates header and combines multiple changepacks', () => {
  const changepacks: ChangepackResultMap = {
    'pkg/a': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'pkg/b': {
      logs: [{ type: 'Patch', note: 'fix B' }],
      version: '2.0.0',
      nextVersion: '2.0.1',
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const contents = createContents(changepacks)

  expect(contents).toContain('# Changepacks')
  expect(contents).toContain('## a@1.0.0 → 1.1.0')
  expect(contents).toContain('feat A')
  expect(contents).toContain('## b@2.0.0 → 2.0.1')
  expect(contents).toContain('fix B')
})

test('createContents filters out empty changepacks', () => {
  const changepacks: ChangepackResultMap = {
    'pkg/a': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '1.0.0',
      nextVersion: null,
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const contents = createContents(changepacks)

  expect(contents).toContain('# Changepacks')
  expect(contents).toContain('## a@1.0.0 → 1.1.0')
  expect(contents).not.toContain('## b@')
})

test('createContents returns only header when all changepacks are empty', () => {
  const changepacks: ChangepackResultMap = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: null,
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '1.0.0',
      nextVersion: null,
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const contents = createContents(changepacks)

  expect(contents).toBe('# Changepacks\n')
})

test('createContents handles empty changepacks object', () => {
  const changepacks: ChangepackResultMap = {}

  const contents = createContents(changepacks)

  expect(contents).toBe('# Changepacks\n')
})
