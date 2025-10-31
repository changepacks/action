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

  const getBranchHeadMock = mock(async () => {
    throw new Error('not found')
  })
  const getBranchBaseMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      git: { createRef: createRefMock },
      pulls: { list: pullsListMock, create: pullsCreateMock },
      issues: { listComments: mock(async () => ({ data: [] })) },
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

  // branch does not exist path
  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'abc123',
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/main', 'origin/changepacks/main'],
    { silent: !isDebug() },
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

  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
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

test('createPr updates existing branch and updates PR comment when PR exists', async () => {
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

  const getBranchHeadMock = mock(async () => ({ data: {} }))
  const getBranchBaseMock = mock()
  const pullsListMock = mock(async () => ({ data: [{ number: 123 }] }))
  const listCommentsMock = mock(async () => ({ data: [] }))
  const createCommentMock = mock(async () => ({ data: {} }))

  const octokit = {
    rest: {
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      pulls: { list: pullsListMock },
      issues: {
        listComments: listCommentsMock,
        createComment: createCommentMock,
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

  // branch exists path
  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['merge', 'origin/main', '--no-edit'],
    { silent: !isDebug() },
  )

  // changepacks update and commit
  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith('git', ['add', '.'], {
    silent: !isDebug(),
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.name', 'changepacks'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.email', 'changepacks@users.noreply.github.com'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['commit', '-m', 'Update Versions'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )

  // PR exists -> comment created
  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
  expect(listCommentsMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    per_page: 100,
  })
  expect(createCommentMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr updates existing PR comment when PR exists with existing comment', async () => {
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

  const getBranchHeadMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [{ number: 123 }] }))
  const listCommentsMock = mock(async () => ({
    data: [
      {
        id: 456,
        user: { login: 'github-actions[bot]' },
        body: '# Changepacks\nOld content',
      },
    ],
  }))
  const updateCommentMock = mock(async () => ({ data: {} }))

  const octokit = {
    rest: {
      repos: {
        getBranch: () => getBranchHeadMock(),
      },
      pulls: { list: pullsListMock },
      issues: {
        listComments: listCommentsMock,
        updateComment: updateCommentMock,
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

  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
  expect(listCommentsMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    issue_number: 123,
    per_page: 100,
  })
  expect(updateCommentMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    comment_id: 456,
    body: expect.stringContaining('# Changepacks'),
  })
  expect(debugMock).toHaveBeenCalledWith('updated comment on PR #123')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createPr creates branch and opens PR when none exists', async () => {
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

  const getBranchHeadMock = mock(async () => {
    throw new Error('not found')
  })
  const getBranchBaseMock = mock(async () => ({
    data: { commit: { sha: 'base-sha' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async () => ({ data: {} }))

  const octokit = {
    rest: {
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      git: { createRef: createRefMock },
      pulls: { list: pullsListMock, create: pullsCreateMock },
      issues: { listComments: mock(async () => ({ data: [] })) },
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

  // branch create path
  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(getBranchBaseMock).toHaveBeenCalled()
  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'base-sha',
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/main', 'origin/changepacks/main'],
    { silent: !isDebug() },
  )

  // changepacks update and commit
  expect(execMock).toHaveBeenCalledWith(
    './changepacks',
    ['update', '--format', 'json', '-y'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith('git', ['add', '.'], {
    silent: !isDebug(),
  })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.name', 'changepacks'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['config', 'user.email', 'changepacks@users.noreply.github.com'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['commit', '-m', 'Update Versions'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )

  // PR created
  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
  expect(pullsCreateMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    title: 'Update Versions',
    body: expect.stringContaining('## pkg-a@1.0.0 → 1.0.1'),
    head: 'changepacks/main',
    base: 'main',
  })

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

  const getBranchHeadMock = mock(async () => {
    throw new Error('not found')
  })
  const getBranchBaseMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async () => {
    throw new Error('boom')
  })
  const octokit = {
    rest: {
      pulls: { list: pullsListMock, create: pullsCreateMock },
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      git: { createRef: createRefMock },
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

  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
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

  const getBranchHeadMock = mock(async () => {
    throw new Error('not found')
  })
  const getBranchBaseMock = mock(async () => ({
    data: { commit: { sha: 'abc123' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock, create: pullsCreateMock },
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      git: { createRef: createRefMock },
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

  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(getBranchBaseMock).toHaveBeenCalled()
  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/main',
    sha: 'abc123',
  })

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/main', 'origin/changepacks/main'],
    { silent: !isDebug() },
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
  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
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

  const getBranchHeadMock = mock(async () => {
    throw new Error('not found')
  })
  const getBranchBaseMock = mock(async () => ({
    data: { commit: { sha: 'def456' } },
  }))
  const createRefMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock, create: pullsCreateMock },
      repos: {
        getBranch: (params: { branch: string }) =>
          params.branch.startsWith('changepacks/')
            ? getBranchHeadMock()
            : getBranchBaseMock(),
      },
      git: { createRef: createRefMock },
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

  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(getBranchBaseMock).toHaveBeenCalled()
  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/heads/changepacks/develop',
    sha: 'def456',
  })

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/develop'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', '-b', 'changepacks/develop', 'origin/changepacks/develop'],
    { silent: !isDebug() },
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
  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/develop',
    base: 'develop',
    state: 'open',
  })
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

test('createPr merges base into existing head when branch exists', async () => {
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

  const getBranchHeadMock = mock(async () => ({ data: {} }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const pullsCreateMock = mock(async (_params: unknown) => ({ data: {} }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock, create: pullsCreateMock },
      repos: {
        getBranch: () => getBranchHeadMock(),
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

  expect(getBranchHeadMock).toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'changepacks/main'],
    { silent: !isDebug() },
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['merge', 'origin/main', '--no-edit'],
    { silent: !isDebug() },
  )

  expect(pullsListMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    head: 'acme:changepacks/main',
    base: 'main',
    state: 'open',
  })
  expect(pullsCreateMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
