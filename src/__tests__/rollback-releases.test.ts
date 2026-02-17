import { expect, mock, test } from 'bun:test'
import type { ChangepackPublishResult, ReleaseInfo } from '../types'

test('rollbackReleases does nothing when publishResult is empty', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
  }))

  const octokit = {
    rest: {
      repos: {},
      git: {},
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  await rollbackReleases({}, {})

  expect(getOctokitMock).toHaveBeenCalledWith('T')

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('rollbackReleases skips failed path not in releaseResult', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const octokit = {
    rest: {
      repos: {},
      git: {},
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  const publishResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': { result: false, error: 'publish failed' },
  }
  const releaseResult: Record<string, ReleaseInfo> = {}

  await rollbackReleases(publishResult, releaseResult)

  expect(infoMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('rollbackReleases deletes release and tag when path fails and not latest', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const deleteReleaseMock = mock(async () => ({}))
  const deleteRefMock = mock(async () => ({}))
  const octokit = {
    rest: {
      repos: { deleteRelease: deleteReleaseMock },
      git: { deleteRef: deleteRefMock },
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  const publishResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': { result: false, error: 'publish failed' },
  }
  const releaseResult: Record<string, ReleaseInfo> = {
    'packages/a/package.json': {
      releaseId: 123,
      tagName: 'a(packages/a/package.json)@1.0.0',
      makeLatest: false,
    },
  }

  await rollbackReleases(publishResult, releaseResult)

  expect(infoMock).toHaveBeenCalledWith(
    'rolling back release for packages/a/package.json: a(packages/a/package.json)@1.0.0',
  )
  expect(deleteReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    release_id: 123,
  })
  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'tags/a(packages/a/package.json)@1.0.0',
  })
  expect(infoMock).toHaveBeenCalledWith(
    'rolled back release: a(packages/a/package.json)@1.0.0',
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('rollbackReleases still deletes tag when deleteRelease fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const infoMock = mock()
  const errorMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    error: errorMock,
  }))

  const deleteReleaseMock = mock(async () => {
    throw new Error('delete release failed')
  })
  const deleteRefMock = mock(async () => ({}))
  const octokit = {
    rest: {
      repos: { deleteRelease: deleteReleaseMock },
      git: { deleteRef: deleteRefMock },
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  const publishResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': { result: false, error: 'publish failed' },
  }
  const releaseResult: Record<string, ReleaseInfo> = {
    'packages/a/package.json': {
      releaseId: 123,
      tagName: 'a(packages/a/package.json)@1.0.0',
      makeLatest: false,
    },
  }

  await rollbackReleases(publishResult, releaseResult)

  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('failed to delete release'),
  )
  expect(deleteRefMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    ref: 'tags/a(packages/a/package.json)@1.0.0',
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('rollbackReleases handles deleteRef error', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const infoMock = mock()
  const errorMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    error: errorMock,
  }))

  const deleteReleaseMock = mock(async () => ({}))
  const deleteRefMock = mock(async () => {
    throw new Error('delete ref failed')
  })
  const octokit = {
    rest: {
      repos: { deleteRelease: deleteReleaseMock },
      git: { deleteRef: deleteRefMock },
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  const publishResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': { result: false, error: 'publish failed' },
  }
  const releaseResult: Record<string, ReleaseInfo> = {
    'packages/a/package.json': {
      releaseId: 123,
      tagName: 'a(packages/a/package.json)@1.0.0',
      makeLatest: false,
    },
  }

  await rollbackReleases(publishResult, releaseResult)

  expect(deleteReleaseMock).toHaveBeenCalled()
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringContaining('failed to delete tag'),
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('rollbackReleases handles multiple failed paths correctly', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const getInputMock = mock((name: string) => (name === 'token' ? 'T' : ''))
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const deleteReleaseMock = mock(async () => ({}))
  const deleteRefMock = mock(async () => ({}))
  const octokit = {
    rest: {
      repos: {
        deleteRelease: deleteReleaseMock,
      },
      git: { deleteRef: deleteRefMock },
    },
  }
  const getOctokitMock = mock(() => octokit)
  mock.module('@actions/github', () => ({
    getOctokit: getOctokitMock,
    context: { repo: { owner: 'acme', repo: 'widgets' } },
  }))

  const { rollbackReleases } = await import('../rollback-releases')
  const publishResult: Record<string, ChangepackPublishResult> = {
    'packages/a/package.json': { result: false, error: 'publish failed' },
    'packages/b/package.json': { result: false, error: 'publish failed' },
    'packages/c/package.json': { result: true, error: null },
  }
  const releaseResult: Record<string, ReleaseInfo> = {
    'packages/a/package.json': {
      releaseId: 123,
      tagName: 'a(packages/a/package.json)@1.0.0',
      makeLatest: true,
    },
    'packages/b/package.json': {
      releaseId: 456,
      tagName: 'b(packages/b/package.json)@2.0.0',
      makeLatest: false,
    },
    'packages/c/package.json': {
      releaseId: 789,
      tagName: 'c(packages/c/package.json)@3.0.0',
      makeLatest: false,
    },
  }

  await rollbackReleases(publishResult, releaseResult)

  expect(deleteReleaseMock).toHaveBeenCalledTimes(2)
  expect(deleteRefMock).toHaveBeenCalledTimes(2)

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
