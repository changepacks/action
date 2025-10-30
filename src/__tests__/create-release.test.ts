import { expect, mock, test } from 'bun:test'
import { createBody } from '../create-body'
import type { ChangepackResultMap } from '../types'

test('createRelease sets output and creates releases per project', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
  }))

  const createReleaseMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = { rest: { repos: { createRelease: createReleaseMock } } }
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
      logs: [{ type: 'MINOR', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
    },
    'packages/b/package.json': {
      logs: [{ type: 'PATCH', note: 'fix B' }],
      version: '2.0.0',
      nextVersion: '2.0.1',
      name: 'b',
    },
  }

  const { createRelease } = await import('../create-release')
  await createRelease(changepacks)

  expect(setOutputMock).toHaveBeenCalledWith(
    'changepacks',
    Object.keys(changepacks),
  )

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'a@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: '1.1.0',
    target_commitish: 'refs/heads/main',
  })
  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'b@2.0.1',
    body: createBody(changepacks['packages/b/package.json']),
    tag_name: '2.0.1',
    target_commitish: 'refs/heads/main',
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
