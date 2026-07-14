import { expect, mock, test } from 'bun:test'

test('publishChangepacks skips publishing when targets are empty', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalFinalize = { ...(await import('../finalize-releases')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const infoMock = mock()
  const setOutputMock = mock()
  const finalizeMock = mock()
  const runChangepacksMock = mock()
  mock.module('@actions/core', () => ({
    endGroup: mock(),
    error: mock(),
    info: infoMock,
    setFailed: mock(),
    setOutput: setOutputMock,
    startGroup: mock(),
  }))
  mock.module('../finalize-releases', () => ({
    finalizeReleases: finalizeMock,
  }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const { publishChangepacks } = await import('../publish-changepacks')
  const result = await publishChangepacks({
    targets: [],
    publishOptions: [],
    releases: {},
  })

  expect(result).toEqual({ failed: false, publishedPaths: [] })
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [])
  expect(infoMock).toHaveBeenCalledWith(
    'all releases are published, skipping publish',
  )
  expect(runChangepacksMock).not.toHaveBeenCalled()
  expect(finalizeMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('../finalize-releases', () => originalFinalize)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('publishChangepacks outputs only unresolved pending release receipts', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalFinalize = { ...(await import('../finalize-releases')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const setOutputMock = mock()
  const finalizeMock = mock(async () => ['pkg/a'])
  mock.module('@actions/core', () => ({
    endGroup: mock(),
    error: mock(),
    info: mock(),
    setFailed: mock(),
    setOutput: setOutputMock,
    startGroup: mock(),
  }))
  mock.module('../finalize-releases', () => ({
    finalizeReleases: finalizeMock,
  }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: mock(async () => ({
      'pkg/a': { result: true, error: null, stderr: null, stdout: null },
      'pkg/b': {
        result: false,
        error: 'registry unavailable',
        stderr: null,
        stdout: null,
      },
    })),
  }))

  const releases = {
    'pkg/a': {
      releaseId: 1,
      tagName: 'a@1.1.0',
      makeLatest: true,
      status: 'pending' as const,
    },
    'pkg/b': {
      releaseId: 2,
      tagName: 'b@1.1.0',
      makeLatest: false,
      status: 'pending' as const,
    },
    'pkg/c': {
      releaseId: 3,
      tagName: 'c@1.1.0',
      makeLatest: false,
      status: 'pending' as const,
    },
  }
  const { publishChangepacks } = await import('../publish-changepacks')
  await publishChangepacks({
    targets: ['pkg/a', 'pkg/b', 'pkg/c'],
    publishOptions: [],
    releases,
  })

  expect(finalizeMock).toHaveBeenCalledWith({ 'pkg/a': releases['pkg/a'] })
  expect(setOutputMock).toHaveBeenCalledWith('pending_releases', {
    'pkg/b': {
      releaseId: 2,
      tagName: 'b@1.1.0',
      makeLatest: false,
    },
    'pkg/c': {
      releaseId: 3,
      tagName: 'c@1.1.0',
      makeLatest: false,
    },
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('../finalize-releases', () => originalFinalize)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})

test('publishChangepacks preserves receipts when release finalization fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalFinalize = { ...(await import('../finalize-releases')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }

  const finalizationError = new Error('GitHub release update failed')
  const setFailedMock = mock()
  const setOutputMock = mock()
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    endGroup: mock(),
    error: mock(),
    info: infoMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
    startGroup: mock(),
  }))
  mock.module('../finalize-releases', () => ({
    finalizeReleases: mock(async () => {
      throw finalizationError
    }),
  }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: mock(async () => ({
      'pkg/a': { result: true, error: null, stderr: null, stdout: null },
    })),
  }))

  const releases = {
    'pkg/a': {
      releaseId: 1,
      tagName: 'a@1.1.0',
      makeLatest: true,
      status: 'pending' as const,
    },
  }
  const { publishChangepacks } = await import('../publish-changepacks')
  const result = await publishChangepacks({
    targets: ['pkg/a'],
    publishOptions: [],
    releases,
  })

  expect(result).toEqual({ failed: true, publishedPaths: ['pkg/a'] })
  expect(setOutputMock).toHaveBeenCalledWith('pending_releases', {
    'pkg/a': {
      releaseId: 1,
      tagName: 'a@1.1.0',
      makeLatest: true,
    },
  })
  expect(setFailedMock).toHaveBeenCalledWith(finalizationError)
  expect(infoMock).toHaveBeenCalledWith(
    'registry publication succeeded; retry with finalize_releases using the pending_releases output',
  )

  mock.module('@actions/core', () => originalCore)
  mock.module('../finalize-releases', () => originalFinalize)
  mock.module('../run-changepacks', () => originalRunChangepacks)
})
