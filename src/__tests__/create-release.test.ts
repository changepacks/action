import { expect, mock, test } from 'bun:test'
import { createBody } from '../create-body'
import type { ChangepackResultMap } from '../types'

const missingRefError = () =>
  Object.assign(new Error('ref not found'), { status: 404 })

// A non-shallow repository so createRelease skips `git fetch --unshallow` and
// pushes tags directly. Use a bespoke mock when a test asserts on the
// exec/getExecOutput calls.
const notShallowExec = () => ({
  exec: mock(async () => 0),
  getExecOutput: mock(async (_cmd: string, args: string[] = []) =>
    args.includes('--is-shallow-repository')
      ? { exitCode: 0, stdout: 'false\n', stderr: '' }
      : { exitCode: 0, stdout: '', stderr: '' },
  ),
})

test('createRelease pushes source SHA tags through git before creating releases', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    isDebug: mock(() => false),
  }))

  const getExecOutputMock = mock(async (_cmd: string, args: string[] = []) =>
    args.includes('--is-shallow-repository')
      ? { exitCode: 0, stdout: 'false\n', stderr: '' }
      : { exitCode: 0, stdout: '', stderr: '' },
  )
  mock.module('@actions/exec', () => ({
    exec: mock(async () => 0),
    getExecOutput: getExecOutputMock,
  }))

  const getRefMock = mock(async () => {
    throw missingRefError()
  })
  const createRefMock = mock(async (_params: unknown) => ({
    data: { ref: 'refs/tags/a@1.1.0' },
  }))
  const createReleaseMock = mock(async (_params: unknown) => ({
    data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
  }))
  const octokit = {
    rest: {
      git: { getRef: getRefMock, createRef: createRefMock },
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
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
    'source-sha',
  )

  expect(result).toEqual({
    'packages/a/package.json': {
      releaseId: 1,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: false,
      status: 'pending',
    },
    'packages/b/package.json': {
      releaseId: 1,
      tagName: 'b(packages/b/package.json)@2.0.1',
      makeLatest: false,
      status: 'pending',
    },
  })

  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {
    'packages/a/package.json': expect.any(String),
    'packages/b/package.json': expect.any(String),
  })
  expect(setOutputMock).toHaveBeenCalledWith('pending_releases', {
    'packages/a/package.json': {
      releaseId: 1,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: false,
    },
    'packages/b/package.json': {
      releaseId: 1,
      tagName: 'b(packages/b/package.json)@2.0.1',
      makeLatest: false,
    },
  })
  expect(setOutputMock).toHaveBeenCalledWith('pending_releases', {
    'packages/a/package.json': {
      releaseId: 1,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: false,
    },
    'packages/b/package.json': {
      releaseId: 1,
      tagName: 'b(packages/b/package.json)@2.0.1',
      makeLatest: false,
    },
  })

  expect(getExecOutputMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'source-sha:refs/tags/a(packages/a/package.json)@1.1.0'],
    { ignoreReturnCode: true, silent: true },
  )
  expect(getExecOutputMock).toHaveBeenCalledWith(
    'git',
    ['push', 'origin', 'source-sha:refs/tags/b(packages/b/package.json)@2.0.1'],
    { ignoreReturnCode: true, silent: true },
  )
  expect(createRefMock).not.toHaveBeenCalled()

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'false',
    target_commitish: 'source-sha',
    draft: true,
  })
  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'b(packages/b/package.json)@2.0.1',
    body: createBody(changepacks['packages/b/package.json']),
    tag_name: 'b(packages/b/package.json)@2.0.1',
    make_latest: 'false',
    target_commitish: 'source-sha',
    draft: true,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease does not set outputs when create_release=false', async () => {
  const originalCore = { ...(await import('@actions/core')) }

  const setOutputMock = mock()
  const getBooleanInputMock = mock((_name: string) => false)
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getBooleanInput: getBooleanInputMock,
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({})

  expect(setOutputMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
})

test('createRelease preserves a pushed tag when release creation fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    error: errorMock,
    isDebug: mock(() => false),
    setFailed: setFailedMock,
  }))
  mock.module('@actions/exec', notShallowExec)

  const getRefMock = mock(async () => {
    throw missingRefError()
  })
  const createRefMock = mock(async (_params: unknown) => ({
    data: { ref: 'refs/tags/a(packages/a/package.json)@1.1.0' },
  }))
  const createReleaseMock = mock(async () => {
    throw new Error('fail release')
  })
  const deleteRefMock = mock(async (_params: unknown) => ({
    data: {},
  }))
  const octokit = {
    rest: {
      git: {
        getRef: getRefMock,
        createRef: createRefMock,
        deleteRef: deleteRefMock,
      },
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({})

  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {})
  expect(createReleaseMock).toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create release failed'),
  )
  expect(setFailedMock).toHaveBeenCalled()
  expect(deleteRefMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease does not push when tag lookup fails with non-404', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const lookupError = Object.assign(new Error('forbidden'), { status: 403 })
  const setFailedMock = mock()
  const execMock = mock(async () => 0)
  const getExecOutputMock = mock(async (_cmd: string, args: string[] = []) =>
    args.includes('--is-shallow-repository')
      ? { exitCode: 0, stdout: 'false\n', stderr: '' }
      : { exitCode: 0, stdout: '', stderr: '' },
  )
  const createReleaseMock = mock()
  mock.module('@actions/core', () => ({
    error: mock(),
    getBooleanInput: mock((name: string) => name === 'create_release'),
    getInput: mock((name: string) => (name === 'token' ? 'T' : '')),
    info: mock(),
    isDebug: mock(() => false),
    setFailed: setFailedMock,
    setOutput: mock(),
  }))
  mock.module('@actions/exec', () => ({
    exec: execMock,
    getExecOutput: getExecOutputMock,
  }))
  mock.module('@actions/github', () => ({
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    },
    getOctokit: mock(() => ({
      rest: {
        git: {
          getRef: mock(async () => {
            throw lookupError
          }),
        },
        repos: { createRelease: createReleaseMock },
      },
    })),
  }))

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    { ignore: [], baseBranch: 'main', latestPackage: null },
    {
      'packages/a/package.json': {
        logs: [],
        version: '1.0.0',
        nextVersion: '1.1.0',
        name: 'a',
        path: 'packages/a/package.json',
        changed: false,
      },
    },
  )

  expect(result).toEqual({})
  expect(execMock).not.toHaveBeenCalled()
  expect(
    getExecOutputMock.mock.calls.every((call) => !call[1]?.includes('push')),
  ).toBe(true)
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(setFailedMock).toHaveBeenCalledWith(lookupError)

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease preserves pushed tags when one release creation fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const debugMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    error: errorMock,
    setFailed: setFailedMock,
    debug: debugMock,
    isDebug: mock(() => false),
  }))
  mock.module('@actions/exec', () => ({
    exec: mock(async () => 0),
    getExecOutput: mock(async () => ({
      exitCode: 0,
      stdout: '*\tsource:refs/tags/release\t[new tag]\n',
      stderr: '',
    })),
  }))

  let callCount = 0
  const getRefMock = mock(async () => {
    throw missingRefError()
  })
  const createRefMock = mock(async (_params: unknown) => ({
    data: { ref: 'refs/tags/test' },
  }))
  const createReleaseMock = mock(async (_params: unknown) => {
    callCount++
    if (callCount === 1) {
      return { data: { id: 123, upload_url: 'https://example.com/upload' } }
    }
    throw new Error('fail release')
  })
  const deleteReleaseMock = mock(async (_params: unknown) => ({
    data: {},
  }))
  const deleteRefMock = mock(async (_params: unknown) => ({
    data: {},
  }))
  const octokit = {
    rest: {
      git: {
        getRef: getRefMock,
        createRef: createRefMock,
        deleteRef: deleteRefMock,
      },
      repos: {
        createRelease: createReleaseMock,
        deleteRelease: deleteReleaseMock,
      },
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
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({
    'packages/a/package.json': {
      releaseId: 123,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: false,
      status: 'pending',
    },
  })

  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {
    'packages/a/package.json': 'https://example.com/upload',
  })
  expect(createReleaseMock).toHaveBeenCalledTimes(2)
  expect(deleteReleaseMock).not.toHaveBeenCalled()
  expect(deleteRefMock).not.toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create release failed'),
  )
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease returns makeLatest true when changepacks has only 1 item even if latestPackage does not match', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    isDebug: mock(() => false),
  }))
  mock.module('@actions/exec', notShallowExec)

  const getRefMock = mock(async () => {
    throw missingRefError()
  })
  const createRefMock = mock(async (_params: unknown) => ({
    data: { ref: 'refs/tags/a@1.1.0' },
  }))
  const createReleaseMock = mock(async (_params: unknown) => ({
    data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
  }))
  const octokit = {
    rest: {
      git: { getRef: getRefMock, createRef: createRefMock },
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: 'packages/b/package.json', // different from the changepack path
    },
    changepacks,
  )

  expect(result).toEqual({
    'packages/a/package.json': {
      releaseId: 1,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
      status: 'pending',
    },
  })

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'false',
    target_commitish: 'abc123def456',
    draft: true,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease skips creating ref when tag already exists', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const debugMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: debugMock,
    isDebug: mock(() => false),
  }))
  mock.module('@actions/exec', notShallowExec)

  const getRefMock = mock()
  const createRefMock = mock()
  const getReleaseByTagMock = mock(async (_params: unknown) => ({
    data: {
      id: 1,
      upload_url: 'https://example.com/upload/a.zip',
      draft: true,
    },
  }))
  const createReleaseMock = mock()
  const octokit = {
    rest: {
      git: { getRef: getRefMock, createRef: createRefMock },
      repos: {
        createRelease: createReleaseMock,
        getReleaseByTag: getReleaseByTagMock,
      },
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({
    'packages/a/package.json': {
      releaseId: 1,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
      status: 'pending',
    },
  })

  expect(getRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'tags/a(packages/a/package.json)@1.1.0',
  })
  expect(createRefMock).not.toHaveBeenCalled()
  expect(getReleaseByTagMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    tag: 'a(packages/a/package.json)@1.1.0',
  })
  expect(createReleaseMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease creates release when tag exists but release lookup fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const setOutputMock = mock(() => {})
  const infoMock = mock()
  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const getBooleanInputMock = mock((name: string) => name === 'create_release')
  mock.module('@actions/core', () => ({
    setOutput: setOutputMock,
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    isDebug: mock(() => false),
  }))
  mock.module('@actions/exec', notShallowExec)

  const lookupError = new Error('release not found')
  const getRefMock = mock(async () => ({ data: { ref: 'refs/tags/test' } }))
  const createRefMock = mock()
  const getReleaseByTagMock = mock(async () => {
    throw lookupError
  })
  const createReleaseMock = mock(async (_params: unknown) => ({
    data: { id: 2, upload_url: 'https://example.com/upload/new.zip' },
  }))
  const octokit = {
    rest: {
      git: { getRef: getRefMock, createRef: createRefMock },
      repos: {
        getReleaseByTag: getReleaseByTagMock,
        createRelease: createReleaseMock,
      },
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({
    'packages/a/package.json': {
      releaseId: 2,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
      status: 'pending',
    },
  })
  expect(infoMock).toHaveBeenCalledWith(
    `release does not exist for existing ref: a(packages/a/package.json)@1.1.0 ${lookupError}`,
  )
  expect(createRefMock).not.toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'false',
    target_commitish: 'abc123def456',
    draft: true,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease does not roll back a newly pushed tag', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMock = mock()
  mock.module('@actions/core', () => ({
    setOutput: mock(),
    getInput: mock((name: string) => (name === 'token' ? 'T' : '')),
    getBooleanInput: mock((name: string) => name === 'create_release'),
    debug: mock(),
    info: mock(),
    error: errorMock,
    isDebug: mock(() => false),
    setFailed: mock(),
  }))
  mock.module('@actions/exec', notShallowExec)

  const getRefMock = mock(async () => {
    throw missingRefError()
  })
  const createRefMock = mock(async (_params: unknown) => ({ data: {} }))
  const createReleaseMock = mock(async () => {
    throw new Error('create release failed')
  })
  const deleteRefMock = mock()
  const octokit = {
    rest: {
      git: {
        getRef: getRefMock,
        createRef: createRefMock,
        deleteRef: deleteRefMock,
      },
      repos: { createRelease: createReleaseMock },
    },
  }
  mock.module('@actions/github', () => ({
    getOctokit: mock(() => octokit),
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    },
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
  }

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    {
      ignore: [],
      baseBranch: 'main',
      latestPackage: null,
    },
    changepacks,
  )

  expect(result).toEqual({})
  expect(deleteRefMock).not.toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create release failed'),
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease unshallows a shallow checkout before pushing tags', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const calls: string[] = []
  const trackedExec = mock(async (_cmd: string, args: string[] = []) => {
    calls.push(args.join(' '))
    return 0
  })
  const getExecOutputMock = mock(async (_cmd: string, args: string[] = []) => {
    calls.push(args.join(' '))
    return args.includes('--is-shallow-repository')
      ? { exitCode: 0, stdout: 'true\n', stderr: '' }
      : { exitCode: 0, stdout: '', stderr: '' }
  })
  mock.module('@actions/core', () => ({
    setOutput: mock(),
    getInput: mock((name: string) => (name === 'token' ? 'T' : '')),
    getBooleanInput: mock((name: string) => name === 'create_release'),
    info: mock(),
    debug: mock(),
    isDebug: mock(() => false),
  }))
  mock.module('@actions/exec', () => ({
    exec: trackedExec,
    getExecOutput: getExecOutputMock,
  }))
  mock.module('@actions/github', () => ({
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    },
    getOctokit: mock(() => ({
      rest: {
        git: {
          getRef: mock(async () => {
            throw missingRefError()
          }),
        },
        repos: {
          createRelease: mock(async () => ({
            data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
          })),
        },
      },
    })),
  }))

  const { createRelease } = await import('../create-release')
  await createRelease(
    { ignore: [], baseBranch: 'main', latestPackage: null },
    {
      'packages/a/package.json': {
        logs: [],
        version: '1.0.0',
        nextVersion: '1.1.0',
        name: 'a',
        path: 'packages/a/package.json',
        changed: false,
      },
    },
    'source-sha',
  )

  expect(trackedExec).toHaveBeenCalledWith(
    'git',
    ['fetch', '--unshallow', 'origin'],
    { silent: true },
  )
  const unshallowIndex = calls.indexOf('fetch --unshallow origin')
  const pushIndex = calls.findIndex((entry) => entry.startsWith('push origin'))
  expect(unshallowIndex).toBeGreaterThanOrEqual(0)
  expect(pushIndex).toBeGreaterThan(unshallowIndex)

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease surfaces git push stderr when the push is rejected', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    setOutput: mock(),
    getInput: mock((name: string) => (name === 'token' ? 'T' : '')),
    getBooleanInput: mock((name: string) => name === 'create_release'),
    info: mock(),
    debug: mock(),
    isDebug: mock(() => false),
    error: errorMock,
    setFailed: setFailedMock,
  }))
  mock.module('@actions/exec', () => ({
    exec: mock(async () => 0),
    getExecOutput: mock(async (_cmd: string, args: string[] = []) =>
      args.includes('--is-shallow-repository')
        ? { exitCode: 0, stdout: 'false\n', stderr: '' }
        : {
            exitCode: 1,
            stdout: '',
            stderr:
              '! [remote rejected] source-sha -> tag (shallow update not allowed)',
          },
    ),
  }))
  const createReleaseMock = mock()
  mock.module('@actions/github', () => ({
    context: {
      repo: { owner: 'acme', repo: 'widgets' },
      ref: 'refs/heads/main',
      sha: 'abc123def456',
    },
    getOctokit: mock(() => ({
      rest: {
        git: {
          getRef: mock(async () => {
            throw missingRefError()
          }),
        },
        repos: { createRelease: createReleaseMock },
      },
    })),
  }))

  const { createRelease } = await import('../create-release')
  const result = await createRelease(
    { ignore: [], baseBranch: 'main', latestPackage: null },
    {
      'packages/a/package.json': {
        logs: [],
        version: '1.0.0',
        nextVersion: '1.1.0',
        name: 'a',
        path: 'packages/a/package.json',
        changed: false,
      },
    },
    'source-sha',
  )

  expect(result).toEqual({})
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('shallow update not allowed'),
  )
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
})
