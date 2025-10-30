import { expect, mock, test } from 'bun:test'
import { createBody } from '../create-body'
import type { ChangepackResultMap } from '../types'

test('createRelease sets output and creates releases per project', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
  }))

  const createReleaseMock = mock(async (_params: unknown) => ({
    data: { assets_url: 'https://example.com/assets/a.zip' },
  }))
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
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'packages/b/package.json': {
      logs: [{ type: 'Patch', note: 'fix B' }],
      version: '2.0.0',
      nextVersion: '2.0.1',
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const { createRelease } = await import('../create-release')
  await createRelease(changepacks)

  expect(setOutputMock).toHaveBeenCalledWith(
    'changepacks',
    Object.keys(changepacks),
  )
  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {
    'packages/a/package.json': expect.any(String),
    'packages/b/package.json': expect.any(String),
  })
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

test('createRelease sets only changepacks output when create_release=false', async () => {
  const originalCore = { ...(await import('@actions/core')) }

  const setOutputMock = mock()
  const getBooleanInputMock = mock((_name: string) => false)
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getBooleanInput: getBooleanInputMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createRelease } = await import('../create-release')
  await createRelease(changepacks)

  expect(setOutputMock).toHaveBeenCalledWith(
    'changepacks',
    Object.keys(changepacks),
  )

  mock.module('@actions/core', () => originalCore)
})

test('createRelease logs error and sets failed on API failure', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const createReleaseMock = mock(async () => {
    throw new Error('fail release')
  })
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
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createRelease } = await import('../create-release')
  await createRelease(changepacks)

  expect(setOutputMock).toHaveBeenCalledWith(
    'changepacks',
    Object.keys(changepacks),
  )
  expect(createReleaseMock).toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create release failed'),
  )
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
