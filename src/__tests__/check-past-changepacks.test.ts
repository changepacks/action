import { expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

test('checkPastChangepacks returns empty when no .changepacks diff', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const diffStdout = ''
  const prevCommitHash = 'abc123def456'
  const currentCommitHash = 'def456ghi789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        options?.listeners?.stdout?.(
          Buffer.from(`${currentCommitHash}\n${prevCommitHash}\n`),
        )
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffStdout))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({ setFailed: setFailedMock }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks rollbacks, reads, and restores when diff exists', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const diffOutput = '.changepacks/a.md\n.changepacks/b.md\n'
  const prevCommitHash = 'abc123def456'
  const currentCommitHash = 'def456ghi789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        options?.listeners?.stdout?.(
          Buffer.from(`${currentCommitHash}\n${prevCommitHash}\n`),
        )
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({ setFailed: setFailedMock }))

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

  // ensure we log first to get previous commit, then diff and did two checkouts around checkChangepacks
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['log', '--format=%H', '-n', '2'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', prevCommitHash, 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith('git', [
    'checkout',
    prevCommitHash,
    '--',
    '.changepacks/',
  ])
  expect(checkChangepacksMock).toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith('git', [
    'checkout',
    'HEAD',
    '--',
    '.changepacks/',
  ])
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} and setsFailed when git diff errors', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const prevCommitHash = 'abc123def456'
  const currentCommitHash = 'def456ghi789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        options?.listeners?.stdout?.(
          Buffer.from(`${currentCommitHash}\n${prevCommitHash}\n`),
        )
        return 0
      }
      throw new Error('diff failed')
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({ setFailed: setFailedMock }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks returns {} and setsFailed when later step throws (outer catch)', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const diffOutput = '.changepacks/a.md\n'
  const prevCommitHash = 'abc123def456'
  const currentCommitHash = 'def456ghi789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (buf: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        options?.listeners?.stdout?.(
          Buffer.from(`${currentCommitHash}\n${prevCommitHash}\n`),
        )
      } else if (args?.[0] === 'diff') {
        options?.listeners?.stdout?.(Buffer.from(diffOutput))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({ setFailed: setFailedMock }))

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

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('checkPastChangepacks returns {} when git log returns only one commit', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const currentCommitHash = 'def456ghi789'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        // shallow clone: 1개만 반환
        options?.listeners?.stdout?.(Buffer.from(`${currentCommitHash}\n`))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    'No previous commit found (shallow clone or first commit)',
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} when git log throws error', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async (_cmd: string, args?: string[]) => {
    if (args?.[0] === 'log') {
      throw new Error('git log failed')
    }
    return 0
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    'No previous commit found (shallow clone or first commit)',
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} when git log returns empty result', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'log') {
        // 빈 결과 반환
        options?.listeners?.stdout?.(Buffer.from(''))
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
  }))
  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()
  expect(result).toEqual({})
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    'No previous commit found (shallow clone or first commit)',
  )
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} when git diff outputs bad revision to stderr', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const prevCommitHash = 'abc123def456'
  const currentCommitHash = 'def456ghi789'
  const errorMessage = "fatal: bad revision 'abc123def456'"
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
      if (args?.[0] === 'log') {
        options?.listeners?.stdout?.(
          Buffer.from(`${currentCommitHash}\n${prevCommitHash}\n`),
        )
        return 0
      } else if (args?.[0] === 'diff') {
        // stderr로 에러 메시지 출력
        options?.listeners?.stderr?.(Buffer.from(errorMessage))
        throw new Error(errorMessage)
      }
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))
  const setFailedMock = mock()
  const debugMock = mock()
  mock.module('@actions/core', () => ({
    setFailed: setFailedMock,
    debug: debugMock,
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
})
