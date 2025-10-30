import { expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

test('createPrComment posts combined body to the PR issue', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  // simple passthrough
  mock.module('@actions/core', () => ({ getInput: getInputMock }))

  const listCommentsMock = mock(async (_params: unknown) => ({ data: [] }))
  const createCommentMock = mock(async (_params: unknown) => ({}))
  const octokit = {
    rest: {
      issues: {
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
      logs: [{ type: 'PATCH', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPrComment } = await import('../create-pr-comment')
  await createPrComment(changepacks)

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

test('createPrComment updates existing Changepacks comment by github-actions[bot]', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({ getInput: getInputMock }))

  const listCommentsMock = mock(async (_params: unknown) => ({
    data: [
      {
        id: 999,
        user: { login: 'github-actions[bot]' },
        body: '# Changepacks\nold',
      },
    ],
  }))
  const updateCommentMock = mock(async (_params: unknown) => ({}))
  const createCommentMock = mock(async (_params: unknown) => ({}))
  const octokit = {
    rest: {
      issues: {
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
      logs: [{ type: 'PATCH', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPrComment } = await import('../create-pr-comment')
  await createPrComment(changepacks)

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

test('createPrComment creates new comment when no existing Changepacks comment', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({ getInput: getInputMock }))

  const listCommentsMock = mock(async (_params: unknown) => ({ data: [] }))
  const createCommentMock = mock()
  const octokit = {
    rest: {
      issues: {
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
      logs: [{ type: 'PATCH', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { createPrComment } = await import('../create-pr-comment')
  await createPrComment(changepacks)

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
