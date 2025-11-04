import { expect, mock, test } from 'bun:test'
import { createBody } from '../create-body'
import type { ChangepackConfig, ChangepackResultMap } from '../types'

test('getChangepacksConfig parses JSON output from changepacks config', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const config: ChangepackConfig = {
    ignore: ['packages/ignored/**'],
    baseBranch: 'main',
    latestPackage: 'packages/a/package.json',
  }

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
      if (args?.[0] === 'config') {
        const output = JSON.stringify(config)
        options?.listeners?.stdout?.(Buffer.from(output))
      }
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

  const { getChangepacksConfig } = await import('../get-changepacks-config')
  const result = await getChangepacksConfig()

  expect(result).toEqual(config)
  expect(execMock).toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith('getting changepacks config')

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('getChangepacksConfig handles config with null latestPackage', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const config: ChangepackConfig = {
    ignore: [],
    baseBranch: 'main',
    latestPackage: null,
  }

  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
        }
      },
    ) => {
      if (args?.[0] === 'config') {
        const output = JSON.stringify(config)
        options?.listeners?.stdout?.(Buffer.from(output))
      }
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

  const { getChangepacksConfig } = await import('../get-changepacks-config')
  const result = await getChangepacksConfig()

  expect(result).toEqual(config)
  expect(result.latestPackage).toBeNull()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('getChangepacksConfig handles stderr output', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const config: ChangepackConfig = {
    ignore: [],
    baseBranch: 'main',
    latestPackage: null,
  }

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
      if (args?.[0] === 'config') {
        const output = JSON.stringify(config)
        // stderr로 출력되는 경우 시뮬레이션
        options?.listeners?.stderr?.(Buffer.from(output))
      }
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

  const { getChangepacksConfig } = await import('../get-changepacks-config')
  const result = await getChangepacksConfig()

  expect(result).toEqual(config)

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('getChangepacksConfig uses silent=false when isDebug is true', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const config: ChangepackConfig = {
    ignore: [],
    baseBranch: 'main',
    latestPackage: null,
  }

  const execMock = mock(
    async (
      _cmd: string,
      args?: string[],
      options?: {
        listeners?: {
          stdout?: (data: Buffer) => void
        }
        silent?: boolean
      },
    ) => {
      if (args?.[0] === 'config') {
        const output = JSON.stringify(config)
        options?.listeners?.stdout?.(Buffer.from(output))
        // silent가 false인지 확인하기 위해 옵션 확인
        expect(options?.silent).toBe(false)
      }
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

  const { getChangepacksConfig } = await import('../get-changepacks-config')
  const result = await getChangepacksConfig()

  expect(result).toEqual(config)
  expect(isDebugMock).toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('createRelease uses latestPackage from config to set make_latest', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
  }))

  const createRefMock = mock(async (_params: unknown) => ({
    data: { ref: 'refs/tags/a@1.1.0' },
  }))
  const createReleaseMock = mock(async (_params: unknown) => ({
    data: { assets_url: 'https://example.com/assets/a.zip' },
  }))
  const octokit = {
    rest: {
      git: { createRef: createRefMock },
      repos: { createRelease: createReleaseMock },
    },
  }
  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
    ref: 'refs/heads/main',
    sha: 'abc123def456',
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: contextMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'packages/b/package.json': {
      logs: [{ type: 'Patch', note: 'fix B' }],
      version: '2.0.0',
      nextVersion: '2.0.1',
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const { createRelease } = await import('../create-release')
  await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: 'packages/a/package.json',
    },
    changepacks,
  )

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'true',
    target_commitish: 'refs/heads/main',
  })
  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'b(packages/b/package.json)@2.0.1',
    body: createBody(changepacks['packages/b/package.json']),
    tag_name: 'b(packages/b/package.json)@2.0.1',
    make_latest: 'false',
    target_commitish: 'refs/heads/main',
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
