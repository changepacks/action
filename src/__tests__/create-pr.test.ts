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

  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    isDebug,
    debug: debugMock,
  }))

  const deleteRefMock = mock(async () => {
    throw new Error('Reference does not exist')
  })
  const getBranchMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { create: pullsCreateMock },
      repos: {
        getBranch: getBranchMock,
      },
      git: {
        deleteRef: deleteRefMock,
        createRef: createRefMock,
      },
    },
  }

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

  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
  })

  expect(getBranchMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    branch: 'main',
  })

  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'abc123',
  })

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/main'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith('git', ['add', '.'], {
    silent: !isDebug(),
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.name', 'changepacks'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.email', 'changepacks@users.noreply.github.com'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['commit', '-m', 'Update Versions'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'changepacks/main'],
    {
      silent: !isDebug(),
    },
  )

  expect(pullsCreateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'Update Versions',
    body: expectedBody,
    head: 'changepacks/main',
    base: 'main',
  })

  // restore modules
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr logs error and sets failed on API failure', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const errorMock = mock()
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    isDebug,
    error: errorMock,
    setFailed: setFailedMock,
    debug: debugMock,
  }))

  const deleteRefMock = mock(async () => {
    throw new Error('Reference does not exist')
  })
  const getBranchMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsCreateMock = mock(async () => {
    throw new Error('boom')
  })
  const octokit = {
    rest: {
      pulls: { create: pullsCreateMock },
      repos: {
        getBranch: getBranchMock,
      },
      git: {
        deleteRef: deleteRefMock,
        createRef: createRefMock,
      },
    },
  }
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
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPr } = await import('../create-pr')
  await createPr(changepacks)

  expect(pullsCreateMock).toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create pr failed'),
  )
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr creates branch when head branch does not exist', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    isDebug,
    debug: debugMock,
  }))

  const deleteRefMock = mock(async () => {
    throw new Error('Reference does not exist')
  })
  const getBranchMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { create: pullsCreateMock },
      repos: {
        getBranch: getBranchMock,
      },
      git: {
        deleteRef: deleteRefMock,
        createRef: createRefMock,
      },
    },
  }

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
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPr } = await import('../create-pr')
  await createPr(changepacks)

  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
  })

  expect(getBranchMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    branch: 'main',
  })

  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'abc123',
  })

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/main'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith('git', ['add', '.'], {
    silent: !isDebug(),
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.name', 'changepacks'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.email', 'changepacks@users.noreply.github.com'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['commit', '-m', 'Update Versions'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'changepacks/main'],
    {
      silent: !isDebug(),
    },
  )
  expect(pullsCreateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'Update Versions',
    body: Object.values(changepacks).map(createBody).join('\n'),
    head: 'changepacks/main',
    base: 'main',
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr handles different base branch', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    isDebug,
    debug: debugMock,
  }))

  const deleteRefMock = mock(async () => {
    throw new Error('Reference does not exist')
  })
  const getBranchMock = mock(async () => ({
    data: { commit: { sha: 'def456' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { create: pullsCreateMock },
      repos: {
        getBranch: getBranchMock,
      },
      git: {
        deleteRef: deleteRefMock,
        createRef: createRefMock,
      },
    },
  }

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/develop',
  }

  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'new feature' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'pkg-a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPr } = await import('../create-pr')
  await createPr(changepacks)

  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/develop',
  })

  expect(getBranchMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    branch: 'develop',
  })

  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/develop',
    sha: 'def456',
  })

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/develop'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith('git', ['add', '.'], {
    silent: !isDebug(),
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.name', 'changepacks'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.email', 'changepacks@users.noreply.github.com'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['commit', '-m', 'Update Versions'],
    {
      silent: !isDebug(),
    },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'changepacks/develop'],
    {
      silent: !isDebug(),
    },
  )
  expect(pullsCreateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'Update Versions',
    body: Object.values(changepacks).map(createBody).join('\n'),
    head: 'changepacks/develop',
    base: 'develop',
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr deletes existing head branch before creating new one', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    isDebug,
    debug: debugMock,
  }))

  const deleteRefMock = mock(async () => ({ data: {} }))
  const getBranchMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { create: pullsCreateMock },
      repos: {
        getBranch: getBranchMock,
      },
      git: {
        deleteRef: deleteRefMock,
        createRef: createRefMock,
      },
    },
  }

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
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPr } = await import('../create-pr')
  await createPr(changepacks)

  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
  })

  expect(debugMock).toHaveBeenCalledWith(
    'attempting to delete branch: changepacks/main',
  )
  expect(debugMock).toHaveBeenCalledWith(
    'deleted existing branch: changepacks/main',
  )
  expect(debugMock).toHaveBeenCalledWith('get base branch: main')
  expect(debugMock).toHaveBeenCalledWith('base branch commit: abc123')
  expect(debugMock).toHaveBeenCalledWith('create branch: changepacks/main')

  expect(getBranchMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    branch: 'main',
  })

  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'abc123',
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
