import { expect, mock, test } from 'bun:test'
import { isDebug } from '@actions/core'
import { createBody } from '../create-body'
import type { ChangepackResultMap } from '../types'

test('createPr runs update and opens PR with formatted body', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({ getInput: getInputMock }))

  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = { rest: { pulls: { create: pullsCreateMock } } }

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
  }

  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [
        { type: 'Major', note: 'Breaking API change' },
        { type: 'Patch', note: 'Fix typo' },
      ],
      version: '1.0.0',
      nextVersion: '2.0.0',
      name: 'pkg-a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'packages/b/package.json': {
      logs: [{ type: 'Minor', note: 'Add feature X' }],
      version: '0.9.0',
      nextVersion: '0.10.0',
      name: 'pkg-b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const expectedBody = Object.values(changepacks).map(createBody).join('\n')

  const { createPr } = await import('../create-pr')
  await createPr(changepacks)

  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    {
      silent: !isDebug(),
    },
  )

  expect(pullsCreateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'Update Versions',
    body: expectedBody,
    head: 'changepacks',
    base: 'refs/heads/main',
  })

  // restore modules
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
