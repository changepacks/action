import { expect, mock, test } from 'bun:test'
import { resolve } from 'node:path'
import type { ChangepackPublishResult, ChangepackResultMap } from '../types'

test('runChangepacks executes check command and returns parsed JSON', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('check')

  expect(result).toEqual(expectedResult)
  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json'],
    expect.objectContaining({
      listeners: expect.any(Object),
      silent: true,
    }),
  )
  expect(debugMock).toHaveBeenCalledWith('running changepacks check')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks executes update command with -y flag and returns parsed JSON', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
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
    getInput: mock(() => ''),
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
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks parses only stdout and ignores stderr noise', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
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
      // stdout carries the JSON; stderr carries human-readable noise that
      // must NOT be appended to the JSON parse input.
      options?.listeners?.stdout?.(Buffer.from(jsonOutput))
      options?.listeners?.stderr?.(Buffer.from('warning: deprecated flag\n'))
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('check')

  expect(result).toEqual(expectedResult)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks uses .exe extension on Windows', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
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
    getInput: mock(() => ''),
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
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks throws error when JSON parse fails', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks throws error when exec fails', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const execMock = mock(async () => {
    throw new Error('exec failed')
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow('exec failed')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks sets silent to false when isDebug returns true', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
    getInput: mock(() => ''),
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
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks returns empty object when output is empty', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const execMock = mock(
    async (
      _cmd: string,
      _args?: string[],
      _options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
          stderr?: (data: Buffer) => void
        }
      },
    ) => {
      // Return empty output
      return 0
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const debugMock = mock()
  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')

  await expect(runChangepacks('check')).rejects.toThrow()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks executes publish command with -y flag and returns parsed JSON', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': {
      result: true,
      error: null,
      stderr: null,
      stdout: null,
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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('publish')

  expect(result).toEqual(expectedResult)
  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['publish', '-y', '--format', 'json'],
    expect.objectContaining({
      listeners: expect.any(Object),
      silent: true,
    }),
  )
  expect(debugMock).toHaveBeenCalledWith('running changepacks publish')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks returns publish JSON when publish exits non-zero', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': {
      result: true,
      error: null,
      stderr: null,
      stdout: 'published',
    },
    'packages/b/package.json': {
      result: false,
      error: 'publish failed',
      stderr: 'npm ERR',
      stdout: null,
    },
  }
  const publishError = new Error('Process failed with exit code 1')

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
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(expectedResult)))
      throw publishError
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const warningMock = mock()
  mock.module('@actions/core', () => ({
    debug: mock(),
    warning: warningMock,
    isDebug: mock(() => false),
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('publish')

  expect(result).toEqual(expectedResult)
  expect(warningMock).toHaveBeenCalledWith(
    `changepacks publish exited with error: ${publishError}`,
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks calls debug with changepacks path', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(debugMock).toHaveBeenCalledWith('running changepacks check')
  expect(debugMock).toHaveBeenCalledWith(
    expect.stringContaining('changepacks path:'),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks calls debug with changepacks output', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Patch', note: 'fix' }],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'pkg-a',
      path: 'packages/a/package.json',
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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(debugMock).toHaveBeenCalledWith('running changepacks check')
  expect(debugMock).toHaveBeenCalledWith(
    expect.stringContaining('changepacks stdout:'),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks passes explicit --remote flag for check command', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check', '--remote')

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json', '--remote'],
    expect.objectContaining({
      silent: true,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks adds -l flag when language input is set for publish command', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
  const getInputMock = mock((name: string) => {
    if (name === 'language') return 'node'
    return ''
  })
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('publish', '-p', 'pkg/a')

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['publish', '-y', '--format', 'json', '-l', 'node', '-p', 'pkg/a'],
    expect.objectContaining({
      silent: true,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks adds -l flag when language input is set for check command', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
  const getInputMock = mock((name: string) => {
    if (name === 'language') return 'rust'
    return ''
  })
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json', '-l', 'rust'],
    expect.objectContaining({
      silent: true,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks adds -l flag when language input is set for update command', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
  const getInputMock = mock((name: string) => {
    if (name === 'language') return 'python'
    return ''
  })
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('update')

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['update', '--format', 'json', '-y', '-l', 'python'],
    expect.objectContaining({
      silent: true,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks omits -l flag when language input is empty', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

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
  const getInputMock = mock(() => '')
  mock.module('@actions/core', () => ({
    debug: debugMock,
    isDebug: isDebugMock,
    getInput: getInputMock,
  }))

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json'],
    expect.objectContaining({
      silent: true,
    }),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks uses non-exe extension on non-Windows platforms', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
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
    getInput: mock(() => ''),
  }))

  // Mock non-Windows platform
  Object.defineProperty(process, 'platform', {
    value: 'linux',
    writable: true,
    configurable: true,
  })

  const { runChangepacks } = await import('../run-changepacks')
  await runChangepacks('check')

  expect(execMock).toHaveBeenCalledWith(
    resolve('changepacks'),
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
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

// Regression: changepacks publish writes valid JSON to stdout and
// human-readable error context to stderr on partial failures. The
// JSON parser must never see stderr content.
test('runChangepacks publish parses stdout JSON when stderr carries failure message and exec exits non-zero', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: Record<string, ChangepackPublishResult> = {
    'bindings/devup-ui-wasm/package.json': {
      result: false,
      error: 'npm publish failed',
      stderr: 'npm ERR! 403 Forbidden',
      stdout: null,
    },
    'packages/ok/package.json': {
      result: true,
      error: null,
      stderr: null,
      stdout: 'published',
    },
  }
  const publishError = new Error('Process failed with exit code 1')

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
      options?.listeners?.stdout?.(Buffer.from(JSON.stringify(expectedResult)))
      options?.listeners?.stderr?.(
        Buffer.from(
          'Error: Failed to publish 1 project(s): bindings/devup-ui-wasm/package.json\n',
        ),
      )
      throw publishError
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const warningMock = mock()
  const debugMock = mock()
  mock.module('@actions/core', () => ({
    debug: debugMock,
    warning: warningMock,
    isDebug: mock(() => false),
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('publish')

  expect(result).toEqual(expectedResult)
  expect(warningMock).toHaveBeenCalledWith(
    `changepacks publish exited with error: ${publishError}`,
  )
  expect(warningMock).toHaveBeenCalledWith(
    expect.stringContaining('changepacks stderr:'),
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks publish throws when stdout is empty and only stderr was produced', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const publishError = new Error('Process failed with exit code 1')

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
      options?.listeners?.stderr?.(
        Buffer.from('Error: Failed to publish 1 project(s): foo\n'),
      )
      throw publishError
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  mock.module('@actions/core', () => ({
    debug: mock(),
    warning: mock(),
    isDebug: mock(() => false),
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')

  // the exec failure alone only says "exit code 1", so the stderr text has to
  // reach the caller
  const caught = await runChangepacks('publish').catch(
    (err: unknown) => err as Error,
  )
  expect(caught.message).toBe(
    'changepacks publish failed: Error: Failed to publish 1 project(s): foo',
  )
  expect(caught.cause).toBe(publishError)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks rethrows the raw error when the process produced no output', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const publishError = new Error('Process failed with exit code 1')
  const execMock = mock(async () => {
    throw publishError
  })
  mock.module('@actions/exec', () => ({ exec: execMock }))
  mock.module('@actions/core', () => ({
    debug: mock(),
    warning: mock(),
    isDebug: mock(() => false),
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')

  const caught = await runChangepacks('check').catch(
    (err: unknown) => err as Error,
  )
  expect(caught).toBe(publishError)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('runChangepacks publish handles interleaved stdout/stderr chunks without breaking JSON parse', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const expectedResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': {
      result: true,
      error: null,
      stderr: null,
      stdout: 'published',
    },
    'packages/b/package.json': {
      result: false,
      error: 'failed',
      stderr: 'npm ERR',
      stdout: null,
    },
  }
  const publishError = new Error('Process failed with exit code 1')

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
      const third = Math.floor(jsonOutput.length / 3)
      // stdout chunk 1 -> stderr noise -> stdout chunk 2 -> more stderr -> stdout tail
      options?.listeners?.stdout?.(Buffer.from(jsonOutput.substring(0, third)))
      options?.listeners?.stderr?.(Buffer.from('Compiling foo...\n'))
      options?.listeners?.stdout?.(
        Buffer.from(jsonOutput.substring(third, third * 2)),
      )
      options?.listeners?.stderr?.(
        Buffer.from('Error: Failed to publish 1 project(s): foo\n'),
      )
      options?.listeners?.stdout?.(Buffer.from(jsonOutput.substring(third * 2)))
      throw publishError
    },
  )
  mock.module('@actions/exec', () => ({ exec: execMock }))

  mock.module('@actions/core', () => ({
    debug: mock(),
    warning: mock(),
    isDebug: mock(() => false),
    getInput: mock(() => ''),
  }))

  const { runChangepacks } = await import('../run-changepacks')
  const result = await runChangepacks('publish')

  expect(result).toEqual(expectedResult)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})
