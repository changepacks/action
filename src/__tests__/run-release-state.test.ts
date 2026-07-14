import { expect, mock, test } from 'bun:test'
import { context as realContext } from '@actions/github'

test('run reconciles only releases with pending receipts', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalCheckPast = { ...(await import('../check-past-changepacks')) }
  const originalCreatePr = { ...(await import('../create-pr')) }
  const originalCreateRelease = { ...(await import('../create-release')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalPublish = { ...(await import('../publish-changepacks')) }
  const originalRunChangepacks = { ...(await import('../run-changepacks')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalValidate = { ...(await import('../validate-publish')) }

  const changepack = (path: string) => ({
    logs: [],
    version: '1.0.0',
    nextVersion: '1.1.0',
    name: path,
    path,
    changed: false,
  })
  const pastChangepacks = {
    'pkg/a': changepack('pkg/a'),
    'pkg/b': changepack('pkg/b'),
    'pkg/c': changepack('pkg/c'),
  }
  const pendingChangepacks = { 'pkg/a': pastChangepacks['pkg/a'] }
  const releases = {
    'pkg/a': {
      releaseId: 1,
      tagName: 'a@1.1.0',
      makeLatest: false,
      status: 'pending' as const,
    },
    'pkg/b': {
      releaseId: 2,
      tagName: 'b@1.1.0',
      makeLatest: true,
      status: 'published' as const,
    },
  }
  const validateMock = mock(async () => true)
  const publishMock = mock(async () => ({
    failed: false,
    publishedPaths: ['pkg/a'],
  }))
  const slackMock = mock()
  const getOctokitMock = mock()
  const restoreError = new Error('branch restore failed')
  const execMock = mock(async (_command: string, args: string[]) => {
    if (args[0] === 'checkout' && args[1] === 'main') {
      throw restoreError
    }
    return 0
  })

  mock.module('@actions/core', () => ({
    getBooleanInput: mock((name: string) => name === 'publish'),
    getInput: mock(() => ''),
    info: mock(),
    isDebug: mock(() => false),
    setOutput: mock(),
  }))
  mock.module('@actions/exec', () => ({ exec: execMock }))
  mock.module('@actions/github', () => ({
    context: {
      ...realContext,
      ref: 'refs/heads/main',
      repo: { owner: 'acme', repo: 'widgets' },
    },
    getOctokit: getOctokitMock,
  }))
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: mock(async () => ({
      changepacks: pastChangepacks,
      sourceSha: 'release-source-sha',
    })),
  }))
  mock.module('../create-pr', () => ({ createPr: mock() }))
  mock.module('../create-release', () => ({
    createRelease: mock(async () => releases),
  }))
  mock.module('../fetch-origin', () => ({ fetchOrigin: mock() }))
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: mock(async () => ({
      baseBranch: 'main',
      ignore: [],
      latestPackage: null,
    })),
  }))
  mock.module('../install-changepacks', () => ({ installChangepacks: mock() }))
  mock.module('../publish-changepacks', () => ({
    publishChangepacks: publishMock,
  }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: mock(async () => ({})),
  }))
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: slackMock,
  }))
  mock.module('../update-pr-comment', () => ({ updatePrComment: mock() }))
  mock.module('../validate-publish', () => ({ validatePublish: validateMock }))

  const { run } = await import('../run')
  await expect(run()).rejects.toThrow(restoreError)

  expect(validateMock).toHaveBeenCalledWith(['pkg/a'], [])
  expect(slackMock).toHaveBeenCalledWith(pendingChangepacks)
  expect(publishMock).toHaveBeenCalledWith({
    targets: ['pkg/a'],
    publishOptions: [],
    releases,
  })
  expect(getOctokitMock).not.toHaveBeenCalled()
  expect(execMock).toHaveBeenCalledWith('git', ['clean', '-fd'], {
    silent: true,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../check-past-changepacks', () => originalCheckPast)
  mock.module('../create-pr', () => originalCreatePr)
  mock.module('../create-release', () => originalCreateRelease)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../publish-changepacks', () => originalPublish)
  mock.module('../run-changepacks', () => originalRunChangepacks)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../validate-publish', () => originalValidate)
})

test('run cleans the repository when branch restoration fails', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRelease = { ...(await import('../create-release')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalRun = { ...(await import('../run-changepacks')) }
  const originalComment = { ...(await import('../update-pr-comment')) }

  const restoreError = new Error('failed to restore main')
  const execMock = mock(async (_command: string, args: string[]) => {
    if (args[0] === 'checkout' && args[1] === 'main') {
      throw restoreError
    }
    return 0
  })
  const changepack = {
    logs: [],
    version: '1.0.0',
    nextVersion: '1.1.0',
    name: 'a',
    path: 'pkg/a',
    changed: false,
  }

  mock.module('@actions/core', () => ({
    getBooleanInput: mock(() => false),
    getInput: mock(() => ''),
    info: mock(),
    isDebug: mock(() => false),
    setOutput: mock(),
  }))
  mock.module('@actions/exec', () => ({ exec: execMock }))
  mock.module('@actions/github', () => ({
    context: {
      ...realContext,
      ref: 'refs/heads/main',
      payload: {},
      repo: { owner: 'acme', repo: 'widgets' },
    },
    getOctokit: mock(),
  }))
  mock.module('../install-changepacks', () => ({ installChangepacks: mock() }))
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: mock(async () => ({
      baseBranch: 'main',
      ignore: [],
      latestPackage: null,
    })),
  }))
  mock.module('../fetch-origin', () => ({ fetchOrigin: mock() }))
  mock.module('../run-changepacks', () => ({
    runChangepacks: mock(async () => ({})),
  }))
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: mock(async () => ({
      changepacks: { 'pkg/a': changepack },
      sourceSha: 'release-source-sha',
    })),
  }))
  mock.module('../create-pr', () => ({ createPr: mock() }))
  mock.module('../create-release', () => ({
    createRelease: mock(async () => {
      throw new Error('release failed')
    }),
  }))
  mock.module('../update-pr-comment', () => ({ updatePrComment: mock() }))

  const { run } = await import('../run')
  await expect(run()).rejects.toThrow(restoreError)

  expect(execMock).toHaveBeenCalledWith('git', ['clean', '-fd'], {
    silent: true,
  })

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRelease)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalRun)
  mock.module('../update-pr-comment', () => originalComment)
})
