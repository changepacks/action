import { afterAll, expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

afterAll(() => {
  process.exitCode = 0
})

test('updatePr posts combined body to the PR issue', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const setFailedMock = mock()
  // simple passthrough
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    warning: mock(),
    error: mock(),
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'user' },
      body: 'Some body',
    },
  }))
  const listCommentsMock = mock(async (_params: unknown) => ({ data: [] }))
  const createCommentMock = mock(async (_params: unknown) => ({}))
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        listComments: listCommentsMock,
        createComment: createCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(getOctokitMock).toHaveBeenCalledWith('T')
  expect(createCommentMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    body: expect.stringContaining('# a@1.0.0 → 1.0.1'),
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('updatePr updates existing Changepacks comment by github-actions[bot]', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    warning: mock(),
    error: mock(),
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'user' },
      body: 'Some body',
    },
  }))
  const listCommentsMock = mock(async (_params: unknown) => ({
    data: [
      {
        id: 999,
        user: { login: 'github-actions[bot]' },
        body: '# Changepacks\nold',
      },
    ],
  }))
  const updateCommentMock = mock()
  const createCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        listComments: listCommentsMock,
        updateComment: updateCommentMock,
        createComment: createCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(getOctokitMock).toHaveBeenCalledWith('T')
  expect(listCommentsMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    per_page: 100,
  })
  expect(updateCommentMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    comment_id: 999,
    body: expect.stringContaining('# Changepacks'),
  })
  expect(createCommentMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('updatePr creates new comment when no existing Changepacks comment', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    warning: mock(),
    error: mock(),
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'user' },
      body: 'Some body',
    },
  }))
  const listCommentsMock = mock(async (_params: unknown) => ({ data: [] }))
  const createCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        listComments: listCommentsMock,
        createComment: createCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(getOctokitMock).toHaveBeenCalledWith('T')
  expect(listCommentsMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    per_page: 100,
  })
  expect(createCommentMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    body: expect.stringContaining('# Changepacks'),
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('updatePr warns when listComments fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMock = mock()
  const setFailedMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'user' },
      body: 'Some body',
    },
  }))
  const listCommentsMock = mock(async () => {
    throw new Error('boom')
  })
  const createCommentMock = mock()
  const updateCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        listComments: listCommentsMock,
        createComment: createCommentMock,
        updateComment: updateCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(listCommentsMock).toHaveBeenCalled()
  expect(createCommentMock).not.toHaveBeenCalled()
  expect(updateCommentMock).not.toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create pr comment failed'),
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('updatePr updates issue body when issue is created by github-actions[bot]', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    warning: mock(),
    error: mock(),
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'github-actions[bot]' },
      title: 'Update Versions',
      body: '# Changepacks\nold',
    },
  }))
  const updateMock = mock()
  const listCommentsMock = mock()
  const createCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        update: updateMock,
        listComments: listCommentsMock,
        createComment: createCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(getOctokitMock).toHaveBeenCalledWith('T')
  expect(updateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    body: expect.stringContaining('# Changepacks'),
  })
  expect(listCommentsMock).not.toHaveBeenCalled()
  expect(createCommentMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('updatePr warns when updateComment fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMock = mock()
  const setFailedMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getMock = mock(async (_params: unknown) => ({
    data: {
      user: { login: 'user' },
      body: 'Some body',
    },
  }))
  const listCommentsMock = mock(async () => ({
    data: [
      { id: 1, user: { login: 'github-actions[bot]' }, body: '# Changepacks' },
    ],
  }))
  const updateCommentMock = mock(async () => {
    throw new Error('fail update')
  })
  const createCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
        get: getMock,
        listComments: listCommentsMock,
        updateComment: updateCommentMock,
        createComment: createCommentMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 123 },
  }
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

  const { updatePr } = await import('../update-pr')
  await updatePr(changepacks)

  expect(listCommentsMock).toHaveBeenCalled()
  expect(updateCommentMock).toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create pr comment failed'),
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
