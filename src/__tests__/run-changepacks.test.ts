import { expect, mock, test } from 'bun:test'
import { resolve } from 'node:path'
import type { ChangepackResultMap } from '../types'

test('runChangepacks executes check command and returns parsed JSON', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const expectedResult: ChangepackResultMap = {
    'package.json': {
      logs: [{ type: 'Major', note: 'Update to v1.0.0' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'My Project',
      path: 'package.json',
      changed: false,
    },
  }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      const jsonOutput = JSON.stringify(expectedResult)
      options?.listeners?.stdout?.(Buffer.from(jsonOutput))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('check')

  expect(result).toEqual(expectedResult)
  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json', '--remote'],
    expect.objectContaining({
      listeners: expect.any(Object),
      silent: true,
    }),
  )
  expect(debugMock).toHaveBeenCalledWith('running changepacks check')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks executes update command with -y flag and returns parsed JSON', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix bug' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'Package A',
      path: 'packages/a/package.json',
      changed: true,
    },
  }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      const jsonOutput = JSON.stringify(expectedResult)
      options?.listeners?.stdout?.(Buffer.from(jsonOutput))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('update')

  expect(result).toEqual(expectedResult)
  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['update', '--format', 'json', '-y'],
    expect.objectContaining({
      listeners: expect.any(Object),
      silent: true,
    }),
  )
  expect(debugMock).toHaveBeenCalledWith('running changepacks update')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks handles output from both stdout and stderr', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const expectedResult: ChangepackResultMap = {
    'package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'Test',
      path: 'package.json',
      changed: false,
    },
  }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      options?.listeners?.stdout?.(Buffer.from('{"package.json":'))
      options?.listeners?.stderr?.(Buffer.from('{"logs":[],'))
      options?.listeners?.stdout?.(Buffer.from('"version":"1.0.0",'))
      options?.listeners?.stderr?.(Buffer.from('"nextVersion":"1.0.1",'))
      options?.listeners?.stdout?.(Buffer.from('"name":"Test",'))
      options?.listeners?.stdout?.(Buffer.from('"path":"package.json",'))
      options?.listeners?.stdout?.(Buffer.from('"changed":false}}'))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('check')

  expect(result).toEqual(expectedResult)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks uses .exe extension on Windows', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalProcess = { ...process }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
        }
      },
    ) => {
      options?.listeners?.stdout?.(Buffer.from('{}'))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  // Mock Windows platform
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true,
    configurable: true,
  })

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(execMock).toHaveBeenCalledWith(
    resolve('changepacks.exe'),
    expect.any(Array),
    expect.any(Object),
  )

  // Restore original process
  Object.defineProperty(process, 'platform', {
    value: originalProcess.platform,
    writable: true,
    configurable: true,
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks throws error when JSON parse fails', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
        }
      },
    ) => {
      options?.listeners?.stdout?.(Buffer.from('invalid json'))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks throws error when exec fails', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async () => {
    throw new Error('exec failed')
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow('exec failed')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks sets silent to false when isDebug returns true', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
        }
      },
    ) => {
      options?.listeners?.stdout?.(Buffer.from('{}'))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => true)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(execMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.any(Array),
    expect.objectContaining({
      silent: false,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('runChangepacks returns empty object when output is empty', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async () => {
    return 0
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})
