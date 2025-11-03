import { expect, test } from 'bun:test'
import { createBody } from '../create-body'

test('createBody generates correct header with nextVersion', () => {
  const body = createBody({
    logs: [],
    version: '1.0.0',
    nextVersion: '1.1.0',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: false,
  })
  expect(body).toContain('## pkg@1.0.0 → 1.1.0 - packages/pkg/package.json')
})

test('createBody does not generate header when there are no logs and changed is false and nextVersion is null', () => {
  const body = createBody({
    logs: [],
    version: '1.0.0',
    nextVersion: null,
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: false,
  })
  expect(body).toBe('')
})

test('createBody includes Major, Minor, and Patch sections', () => {
  const body = createBody({
    logs: [
      { type: 'Major', note: 'Breaking change' },
      { type: 'Minor', note: 'New feature' },
      { type: 'Patch', note: 'Bug fix' },
    ],
    version: '1.0.0',
    nextVersion: '2.0.0',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: false,
  })
  expect(body).toContain('### Major')
  expect(body).toContain('- Breaking change')
  expect(body).toContain('### Minor')
  expect(body).toContain('- New feature')
  expect(body).toContain('### Patch')
  expect(body).toContain('- Bug fix')
})

test('createBody includes reminder when changed=true and no logs', () => {
  const body = createBody({
    logs: [],
    version: '1.0.0',
    nextVersion: '1.0.1',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: true,
  })
  expect(body).toContain(
    'Maybe you forgot to write the following files to the latest version',
  )
})

test('createBody does not include reminder when changed=true but has logs', () => {
  const body = createBody({
    logs: [{ type: 'Patch', note: 'fix x' }],
    version: '1.0.0',
    nextVersion: '1.0.1',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: true,
  })
  expect(body).not.toContain(
    'Maybe you forgot to write the following files to the latest version',
  )
  expect(body).toContain('### Patch')
  expect(body).toContain('- fix x')
})

test('createBody does not include reminder when changed=false', () => {
  const body = createBody({
    logs: [],
    version: '1.0.0',
    nextVersion: '1.0.1',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: false,
  })
  expect(body).not.toContain(
    'Maybe you forgot to write the following files to the latest version',
  )
})
