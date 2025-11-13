import { expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

test('checkPastChangepacks returns empty when no .changepacks diff', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const diffStdout = ''
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffStdout))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--deepen=1'],
    expect.any(Object),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks rollbacks, reads, and restores when diff exists', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput = '.changepacks/a.md\n.changepacks/b.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const payload: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      path: 'packages/a/package.json',
      changed: false,
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--deepen=1'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'HEAD~1', 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith('git', ['checkout', 'HEAD~1'])
  expect(installChangepacksMock).toHaveBeenCalled()
  expect(checkChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith('git', ['checkout', 'HEAD'])
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks returns {} and setsFailed when git diff errors', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const execMock = mock(async (_cmd: string, args?: string[]) => {
    if (args?.[0] === 'fetch') {
      return 0
    }
    throw new Error('diff failed')
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks returns {} and setsFailed when later step throws (outer catch)', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput = '.changepacks/a.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (buf: Buffer) => void
          stderr?: (buf: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const checkChangepacksMock = mock(async () => {
    throw new Error('parse failed')
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks returns {} and setsFailed when fetch fails', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async (_cmd: string, _args?: string[]) => {
    throw new Error('fetch failed')
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--deepen=1'],
    expect.any(Object),
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks returns {} when git diff outputs bad revision to stderr', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMessage = "fatal: bad revision 'HEAD~1'"
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stderr?.(Buffer.from(errorMessage))
        throw new Error(errorMessage)
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    `skip past changepacks: ${errorMessage}`,
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks returns {} when git diff outputs unknown revision to stdout', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMessage = "fatal: unknown revision 'HEAD~1'"
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(errorMessage))
        throw new Error(errorMessage)
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    `skip past changepacks: ${errorMessage}`,
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks returns {} when git diff outputs ambiguous argument', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMessage = "fatal: ambiguous argument 'HEAD~1'"
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stderr?.(Buffer.from(errorMessage))
        throw new Error(errorMessage)
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    `skip past changepacks: ${errorMessage}`,
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks returns {} when git diff outputs bad object', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMessage = "fatal: bad object 'HEAD~1'"
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(errorMessage))
        throw new Error(errorMessage)
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))
  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    `skip past changepacks: ${errorMessage}`,
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks filters empty lines from diff output', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput =
    '.changepacks/a.md\n\n.changepacks/b.md\n  \n.changepacks/c.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const payload: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      path: 'packages/a/package.json',
      changed: false,
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)
  expect(installChangepacksMock).toHaveBeenCalled()
  expect(checkChangepacksMock).toHaveBeenCalledWith('check')

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks uses Update Versions PR SHA when found', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput = '.changepacks/a.md\n'
  const pastSha = 'abc123def456'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))

  const updateVersionsPr = {
    number: 42,
    title: 'Update Versions',
    merged_at: '2024-01-01T00:00:00Z',
    merge_commit_sha: pastSha,
    head: { sha: 'head123' },
  }
  const pullsListMock = mock(async () => ({
    data: [updateVersionsPr],
  }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const payload: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      path: 'packages/a/package.json',
      changed: false,
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)
  expect(debugMock).toHaveBeenCalledWith(
    `Found closed Update Versions PR #42, SHA: ${pastSha}`,
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', pastSha, 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith('git', ['checkout', pastSha])
  expect(installChangepacksMock).toHaveBeenCalled()
  expect(checkChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith('git', ['checkout', 'HEAD'])
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks uses head.sha when Update Versions PR has no merge_commit_sha', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput = '.changepacks/a.md\n'
  const headSha = 'head789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))

  const updateVersionsPr = {
    number: 42,
    title: 'Update Versions',
    merged_at: '2024-01-01T00:00:00Z',
    merge_commit_sha: null,
    head: { sha: headSha },
  }
  const pullsListMock = mock(async () => ({
    data: [updateVersionsPr],
  }))
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const payload: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      path: 'packages/a/package.json',
      changed: false,
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)
  expect(debugMock).toHaveBeenCalledWith(
    `Found closed Update Versions PR #42, SHA: ${headSha}`,
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', headSha, 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith('git', ['checkout', headSha])
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks handles GitHub API failure gracefully', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const diffOutput = '.changepacks/a.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'fetch') {
        // fetch --deepen=1 succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => {
    throw new Error('API rate limit exceeded')
  })
  const octokit = {
    rest: {
      pulls: { list: pullsListMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const installChangepacksMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installChangepacksMock,
  }))

  const payload: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      path: 'packages/a/package.json',
      changed: false,
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../run-changepacks', () => ({
    runChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)
  expect(debugMock).toHaveBeenCalledWith(
    'Failed to fetch closed PRs: Error: API rate limit exceeded',
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'HEAD~1', 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
