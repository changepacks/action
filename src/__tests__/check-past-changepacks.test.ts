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
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
    expect.objectContaining({ silent: true }),
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
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
    ref: 'refs/heads/main',
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
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'HEAD~1', 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'HEAD~1'],
    expect.objectContaining({ silent: true }),
  )
  expect(installChangepacksMock).toHaveBeenCalled()
  expect(checkChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'main'],
    expect.objectContaining({ silent: true }),
  )
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
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
    throw new Error('check failed')
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

test('checkPastChangepacks fails when fallback history fetch fails', async () => {
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
        throw new Error('fetch failed')
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffStdout))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  expect(setFailedMock).toHaveBeenCalledWith(expect.any(Error))
  expect(debugMock).toHaveBeenCalledWith(
    expect.stringContaining('Failed to fetch'),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--deepen=1'],
    expect.objectContaining({ silent: true }),
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
    ref: 'refs/heads/main',
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
        // fetch origin <sha> succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const updateVersionsPr = {
    number: 42,
    title: 'Update Versions',
    merged_at: '2024-01-01T00:00:00Z',
    merge_commit_sha: pastSha,
    head: { sha: 'head123' },
    base: { ref: 'main', sha: 'base123' },
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
    ref: 'refs/heads/main',
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
    'Found closed Update Versions PR #42, SHA: base123',
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', 'base123'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'base123', pastSha, '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'base123'],
    expect.objectContaining({ silent: true }),
  )
  expect(installChangepacksMock).toHaveBeenCalled()
  expect(checkChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'main'],
    expect.objectContaining({ silent: true }),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks uses the PR base when merge_commit_sha is absent', async () => {
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
        // fetch origin <sha> succeeds
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const updateVersionsPr = {
    number: 42,
    title: 'Update Versions',
    merged_at: '2024-01-01T00:00:00Z',
    merge_commit_sha: null,
    head: { sha: headSha },
    base: { ref: 'main', sha: 'base456' },
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
    ref: 'refs/heads/main',
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
    'Found closed Update Versions PR #42, SHA: base456',
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', 'base456'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'base456', headSha, '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'base456'],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['checkout', 'main'],
    expect.objectContaining({ silent: true }),
  )
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
    ref: 'refs/heads/main',
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
    expect.objectContaining({ silent: true }),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks fails when the exact PR base cannot be fetched', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalInstallChangepacks = {
    ...(await import('../install-changepacks')),
  }

  const diffOutput = '.changepacks/a.md\n'
  const pastSha = 'abc123def456'
  const baseSha = 'base123def456'
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
      if (args?.[0] === 'fetch' && args?.[4] === baseSha) {
        throw new Error('fetch failed')
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const updateVersionsPr = {
    number: 42,
    title: 'Update Versions',
    merged_at: '2024-01-01T00:00:00Z',
    merge_commit_sha: pastSha,
    head: { sha: 'head123' },
    base: { ref: 'main', sha: baseSha },
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
    ref: 'refs/heads/main',
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

  expect(result).toEqual({})
  expect(debugMock).toHaveBeenCalledWith(
    `Found closed Update Versions PR #42, SHA: ${baseSha}`,
  )
  expect(debugMock).toHaveBeenCalledWith(
    expect.stringContaining('Failed to fetch Update Versions base SHA'),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', baseSha],
    expect.objectContaining({ silent: true }),
  )
  expect(setFailedMock).toHaveBeenCalledWith(expect.any(Error))
  expect(installChangepacksMock).not.toHaveBeenCalled()
  expect(checkChangepacksMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstallChangepacks)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks setsFailed when git diff throws non-revision error', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMessage = 'Permission denied'
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
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
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
  expect(setFailedMock).toHaveBeenCalledWith(expect.any(Error))
  expect(debugMock).not.toHaveBeenCalledWith(
    expect.stringContaining('skip past changepacks'),
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('checkPastChangepacks recovers without a commit-distance cutoff', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
        return 0
      }
      if (args?.[0] === 'rev-list') {
        options?.listeners?.stdout?.(Buffer.from('2'))
        return 0
      }
      if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from('.changepacks/example.json'))
        return 0
      }
      if (args?.[0] === 'checkout') {
        return 0
      }
      options?.listeners?.stdout?.(Buffer.from(''))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({
    data: [
      {
        title: 'Update Versions',
        merged_at: '2024-01-01T00:00:00Z',
        merge_commit_sha: 'abc123',
        head: { sha: 'headsha' },
        base: { ref: 'main', sha: 'base123' },
        number: 99,
      },
    ],
  }))
  const octokit = { rest: { pulls: { list: pullsListMock } } }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installMock = mock(async () => undefined)
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))
  const changepacksResult = {
    'packages/example/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: '@acme/example',
      changed: true,
      path: 'packages/example/package.json',
    },
  }
  const runChangepacksMock = mock(async () => changepacksResult)
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(changepacksResult)
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(installMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'base123', 'abc123', '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks does not discard releases after three commits', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
        return 0
      }
      if (args?.[0] === 'rev-list') {
        options?.listeners?.stdout?.(Buffer.from('4'))
        return 0
      }
      if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from('.changepacks/example.json'))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({
    data: [
      {
        title: 'Update Versions',
        merged_at: '2024-01-01T00:00:00Z',
        merge_commit_sha: 'abc123',
        head: { sha: 'headsha' },
        base: { ref: 'main', sha: 'base123' },
        number: 5,
      },
    ],
  }))
  const octokit = { rest: { pulls: { list: pullsListMock } } }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installMock = mock(async () => undefined)
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))
  const changepacksResult = {
    'packages/example/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: '@acme/example',
      changed: true,
      path: 'packages/example/package.json',
    },
  }
  const runChangepacksMock = mock(async () => changepacksResult)
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(changepacksResult)
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(installMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'base123', 'abc123', '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks keeps retrying pending releases on later pushes', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
        return 0
      }
      if (args?.[0] === 'rev-list') {
        options?.listeners?.stdout?.(Buffer.from('5'))
        return 0
      }
      if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from('.changepacks/example.json'))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({
    data: [
      {
        title: 'Update Versions',
        merged_at: '2024-01-01T00:00:00Z',
        merge_commit_sha: 'abc123',
        head: { sha: 'headsha' },
        base: { ref: 'main', sha: 'base123' },
        number: 5,
      },
    ],
  }))
  const octokit = { rest: { pulls: { list: pullsListMock } } }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installMock = mock(async () => undefined)
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))
  const changepacksResult = {
    'packages/example/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: '@acme/example',
      changed: true,
      path: 'packages/example/package.json',
    },
  }
  const runChangepacksMock = mock(async () => changepacksResult)
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(changepacksResult)
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(installMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'base123', 'abc123', '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks never invokes rev-list during recovery', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const execMock = mock(async (_cmd: string, args?: string[]) => {
    if (args?.[0] === 'fetch') {
      return 0
    }
    if (args?.[0] === 'rev-list') {
      throw new Error('rev-list failed')
    }
    return 0
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  const debugMock = mock()
  const isDebugMock = mock(() => false)
  const getInputMock = mock((name: string) =>
    name === 'token' ? 'TEST_TOKEN' : '',
  )
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const pullsListMock = mock(async () => ({
    data: [
      {
        title: 'Update Versions',
        merged_at: '2024-01-01T00:00:00Z',
        merge_commit_sha: 'abc123',
        head: { sha: 'headsha' },
        base: { ref: 'main', sha: 'base123' },
        number: 5,
      },
    ],
  }))
  const octokit = { rest: { pulls: { list: pullsListMock } } }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))
  const runChangepacksMock = mock()
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(execMock).not.toHaveBeenCalledWith(
    'git',
    ['rev-list', '--count', 'abc123~1..HEAD'],
    expect.objectContaining({ silent: true }),
  )
  expect(installMock).not.toHaveBeenCalled()
  expect(runChangepacksMock).not.toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks fetches the exact PR base SHA for shallow recovery', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const baseSha = 'base123'
  const mergeSha = 'merge456'
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
      if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from('.changepacks/release.json\n'))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    debug: mock(),
    getInput: mock(() => 'TOKEN'),
    isDebug: mock(() => false),
    setFailed: setFailedMock,
  }))

  mock.module('@actions/github', () => ({
    context: {
      ref: 'refs/heads/main',
      repo: { owner: 'acme', repo: 'widgets' },
      sha: 'head789',
    },
    getOctokit: mock(() => ({
      rest: {
        pulls: {
          list: mock(async () => ({
            data: [
              {
                base: { ref: 'main', sha: baseSha },
                head: { sha: 'head456' },
                merge_commit_sha: mergeSha,
                merged_at: '2026-07-14T00:00:00Z',
                number: 172,
                title: 'Update Versions',
              },
            ],
          })),
        },
      },
    })),
  }))

  const changepacks = {
    'packages/a/package.json': {
      changed: false,
      logs: [{ note: 'release', type: 'Patch' as const }],
      name: 'a',
      nextVersion: '1.0.1',
      path: 'packages/a/package.json',
      version: '1.0.0',
    },
  }
  mock.module('../install-changepacks', () => ({
    installChangepacks: mock(async () => undefined),
  }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: mock(async () => changepacks),
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks({ includeSource: true })

  expect(result).toEqual({ changepacks, sourceSha: mergeSha })
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', baseSha],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', baseSha, mergeSha, '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks fetches the exact PR base when the checkout is shallow', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const baseSha = 'base123'
  const mergeSha = 'merge456'
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
      if (args?.[0] === 'rev-list') {
        throw new Error('shallow merge parent is unavailable')
      }
      if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from('.changepacks/release.json\n'))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: mock(),
    isDebug: mock(() => false),
    getInput: mock((name: string) => (name === 'token' ? 'TEST_TOKEN' : '')),
  }))

  const octokit = {
    rest: {
      pulls: {
        list: mock(async () => ({
          data: [
            {
              title: 'Update Versions',
              merged_at: '2026-07-14T00:25:35Z',
              merge_commit_sha: mergeSha,
              head: { sha: 'head789' },
              base: { ref: 'main', sha: baseSha },
              number: 172,
            },
          ],
        })),
      },
    },
  }
  mock.module('@actions/github', () => ({
    getOctokit: mock(() => octokit),
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      ref: 'refs/heads/main',
    },
  }))

  const installMock = mock(async () => undefined)
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))
  const changepacksResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'packages/a/package.json',
      changed: true,
    },
  }
  const runChangepacksMock = mock(async () => changepacksResult)
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(changepacksResult)
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', '--no-tags', '--depth=1', 'origin', baseSha],
    expect.objectContaining({ silent: true }),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', baseSha, mergeSha, '--name-only', '--', '.changepacks/'],
    expect.objectContaining({ silent: true }),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})
