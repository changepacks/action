import { expect, mock, test } from 'bun:test'

test('parseFinalizeReleasesInput parses release receipts', async () => {
  const { parseFinalizeReleasesInput } = await import('../finalize-releases')

  expect(
    parseFinalizeReleasesInput(
      JSON.stringify({
        'packages/a/package.json': {
          releaseId: 10,
          tagName: 'a(packages/a/package.json)@1.1.0',
          makeLatest: true,
        },
      }),
    ),
  ).toEqual({
    'packages/a/package.json': {
      releaseId: 10,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
    },
  })
})

test('parseFinalizeReleasesInput rejects malformed release receipts', async () => {
  const { parseFinalizeReleasesInput } = await import('../finalize-releases')

  expect(() =>
    parseFinalizeReleasesInput(
      JSON.stringify({
        'packages/a/package.json': {
          releaseId: '10',
          tagName: 'a(packages/a/package.json)@1.1.0',
          makeLatest: true,
        },
      }),
    ),
  ).toThrow('Invalid finalize_releases input')
})

test('parseFinalizeReleasesInput rejects invalid JSON', async () => {
  const { parseFinalizeReleasesInput } = await import('../finalize-releases')

  expect(() => parseFinalizeReleasesInput('{')).toThrow(
    'Invalid finalize_releases input',
  )
})

test('parseFinalizeReleasesInput rejects non-object JSON', async () => {
  const { parseFinalizeReleasesInput } = await import('../finalize-releases')

  expect(() => parseFinalizeReleasesInput('[]')).toThrow(
    'Invalid finalize_releases input',
  )
})

test('finalizeReleases publishes drafts and sets the selected latest release', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const updateReleaseMock = mock(async () => ({ data: {} }))
  mock.module('@actions/core', () => ({
    getInput: mock((name: string) => (name === 'token' ? 'TOKEN' : '')),
    info: mock(),
  }))
  mock.module('@actions/github', () => ({
    context: { repo: { owner: 'acme', repo: 'widgets' } },
    getOctokit: mock(() => ({
      rest: { repos: { updateRelease: updateReleaseMock } },
    })),
  }))

  const { finalizeReleases } = await import('../finalize-releases')
  const result = await finalizeReleases({
    'packages/a/package.json': {
      releaseId: 10,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
    },
    'packages/b/package.json': {
      releaseId: 20,
      tagName: 'b(packages/b/package.json)@2.0.1',
      makeLatest: false,
    },
  })

  expect(updateReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    release_id: 10,
    draft: false,
    make_latest: 'true',
  })
  expect(updateReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    release_id: 20,
    draft: false,
    make_latest: 'false',
  })
  expect(result).toEqual(['packages/a/package.json', 'packages/b/package.json'])

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
