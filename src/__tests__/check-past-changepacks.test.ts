import { expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

test('checkPastChangepacks returns empty when no .changepacks diff', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const diffStdout = ''
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'diff') {
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

  const diffOutput = '.changepacks/a.md\n.changepacks/b.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (data: Buffer) => void } },
    ) => {
      if (args?.[0] === 'diff') {
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
      logs: [{ type: 'PATCH', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
    },
  }

  const checkChangepacksMock = mock(async () => payload)
  mock.module('../check-changepacks', () => ({
    checkChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual(payload)

  // ensure we diffed and did two checkouts around checkChangepacks
  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['diff', 'HEAD~1', 'HEAD', '--name-only', '--', '.changepacks/'],
    expect.any(Object),
  )
  expect(execMock).toHaveBeenCalledWith('git', [
    'checkout',
    'HEAD~1',
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

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} and setsFailed when git diff errors', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async (_cmd: string, _args?: string[]) => {
    throw new Error('diff failed')
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const setFailedMock = mock()
  mock.module('@actions/core', () => ({ setFailed: setFailedMock }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('checkPastChangepacks returns {} and setsFailed when later step throws (outer catch)', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalCheck = { ...(await import('../check-changepacks')) }

  const diffOutput = '.changepacks/a.md\n'
  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: { listeners?: { stdout?: (buf: Buffer) => void } },
    ) => {
      if (args?.[0] === 'diff') {
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
  mock.module('../check-changepacks', () => ({
    checkChangepacks: checkChangepacksMock,
  }))

  const { checkPastChangepacks } = await import('../check-past-changepacks')
  const result = await checkPastChangepacks()

  expect(result).toEqual({})
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../check-changepacks', () => originalCheck)
})

test('checkPastChangepacks returns {} and does not setFailed when no HEAD~1', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: { listeners?: { stderr?: (data: Buffer) => void } },
    ) => {
      options?.listeners?.stderr?.(Buffer.from("fatal: bad revision 'HEAD~1'"))
      throw new Error("fatal: bad revision 'HEAD~1'")
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
  expect(debugMock).toHaveBeenCalled()
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})
