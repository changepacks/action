import { expect, test } from 'bun:test'
import { createBody } from '../create-body'

test('createBody includes reminder when changed=true and has logs', () => {
  const body = createBody({
    logs: [
      { type: 'PATCH', note: 'fix x' },
      { type: 'MINOR', note: 'feat y' },
    ],
    version: '1.0.0',
    nextVersion: '1.1.0',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: true,
  })
  expect(body).toContain('## Minor')
  expect(body).toContain('## Patch')
  expect(body).toContain(
    'Maybe you forgot to write the following files to the latest version',
  )
})

test('createBody does not include reminder when changed=false or no logs', () => {
  const bodyNoChange = createBody({
    logs: [{ type: 'PATCH', note: 'fix' }],
    version: '1.0.0',
    nextVersion: '1.0.1',
    name: 'pkg',
    changed: false,
    path: 'packages/pkg/package.json',
  })
  expect(bodyNoChange).not.toContain(
    'Maybe you forgot to write the following files to the latest version',
  )

  const bodyNoLogs = createBody({
    logs: [],
    version: '1.0.0',
    nextVersion: '1.0.1',
    name: 'pkg',
    path: 'packages/pkg/package.json',
    changed: true,
  })
  expect(bodyNoLogs).not.toContain(
    'Maybe you forgot to write the following files to the latest version',
  )
})
