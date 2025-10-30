import { expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

test('createPrComment posts combined body to the PR issue', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  // simple passthrough
  mock.module('@actions/core', () => ({ getInput: getInputMock }))

  const createCommentMock = mock(async (_params: unknown) => ({}))
  const octokit = { rest: { issues: { createComment: createCommentMock } } }
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
