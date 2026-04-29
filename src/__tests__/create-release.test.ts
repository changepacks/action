import { expect, mock, test } from 'bun:test'
import { createBody } from '../create-body'
import type { ChangepackResultMap } from '../types'

test('createRelease sets release asset URLs and creates releases per project', async () => {
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
    data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
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
      makeLatest: false,
    },
    'packages/b/package.json': {
      releaseId: 1,
      tagName: 'b(packages/b/package.json)@2.0.1',
      makeLatest: false,
    },
  })

  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {
    'packages/a/package.json': expect.any(String),
    'packages/b/package.json': expect.any(String),
  })

  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/tags/a(packages/a/package.json)@1.1.0',
    sha: 'abc123def456',
  })
  expect(createRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'refs/tags/b(packages/b/package.json)@2.0.1',
    sha: 'abc123def456',
  })

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'false',
    target_commitish: 'refs/heads/main',
    draft: false,
  })
  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'b(packages/b/package.json)@2.0.1',
    body: createBody(changepacks['packages/b/package.json']),
    tag_name: 'b(packages/b/package.json)@2.0.1',
    make_latest: 'false',
    target_commitish: 'refs/heads/main',
    draft: false,
  })

  mock.module('@actions/core', () => originalCore)
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

test('createRelease logs error and sets failed on API failure', async () => {
  const originalCore = { ...(await import('@actions/core')) }
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
    setFailed: setFailedMock,
  }))

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
      git: { createRef: createRefMock, deleteRef: deleteRefMock },
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

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease deletes created releases when error occurs after some releases are created', async () => {
  const originalCore = { ...(await import('@actions/core')) }
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
  }))

  let callCount = 0
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
      git: { createRef: createRefMock, deleteRef: deleteRefMock },
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
    },
  })

  expect(setOutputMock).toHaveBeenCalledWith('release_assets_urls', {
    'packages/a/package.json': 'https://example.com/upload',
  })
  expect(createReleaseMock).toHaveBeenCalledTimes(2)
  expect(deleteReleaseMock).not.toHaveBeenCalled()
  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'tags/b(packages/b/package.json)@2.0.1',
  })
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('create release failed'),
  )
  expect(setFailedMock).toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease returns makeLatest true when changepacks has only 1 item even if latestPackage does not match', async () => {
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
    data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
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
    },
  })

  expect(createReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    name: 'a(packages/a/package.json)@1.1.0',
    body: createBody(changepacks['packages/a/package.json']),
    tag_name: 'a(packages/a/package.json)@1.1.0',
    make_latest: 'false',
    target_commitish: 'refs/heads/main',
    draft: false,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease skips creating ref when tag already exists', async () => {
  const originalCore = { ...(await import('@actions/core')) }
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
  }))

  const getRefMock = mock()
  const createRefMock = mock()
  const getReleaseByTagMock = mock(async (_params: unknown) => ({
    data: { id: 1, upload_url: 'https://example.com/upload/a.zip' },
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
      alreadyExisted: true,
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
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease creates release when tag exists but release lookup fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
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
  }))

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
    target_commitish: 'refs/heads/main',
    draft: false,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('createRelease logs cleanup error when deleting created tag fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const errorMock = mock()
  mock.module('@actions/core', () => ({
    setOutput: mock(),
    getInput: mock((name: string) => (name === 'token' ? 'T' : '')),
    getBooleanInput: mock((name: string) => name === 'create_release'),
    debug: mock(),
    info: mock(),
    error: errorMock,
    setFailed: mock(),
  }))

  const deleteError = new Error('delete ref failed')
  const createRefMock = mock(async (_params: unknown) => ({ data: {} }))
  const createReleaseMock = mock(async () => {
    throw new Error('create release failed')
  })
  const deleteRefMock = mock(async () => {
    throw deleteError
  })
  const octokit = {
    rest: {
      git: {
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
  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'tags/a(packages/a/package.json)@1.1.0',
  })
  expect(errorMock).toHaveBeenCalledWith(
    `failed to delete tag a(packages/a/package.json)@1.1.0: ${deleteError}`,
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
