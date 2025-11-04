import { expect, mock, test } from 'bun:test'
import { context as realContext } from '@actions/github'

test('run creates PR when current changepacks exist', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }

  const installMock = mock(async () => {})
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock(async () => {})
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const checkPastMock = mock()
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(createPrMock).toHaveBeenCalled()
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
})

test('run creates releases from past changepacks when current is empty', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }

  const installMock = mock(async () => {})
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock(async () => {})
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const checkMock = mock(async () => ({}))
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const pastChangepacks = {
    'pkg/b': { logs: [], version: '2.0.0', nextVersion: '2.1.0', name: 'b' },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(createPrMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
})

test('run posts PR comment and returns early when payload.pull_request exists', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalPrComment = { ...(await import('../create-pr-comment')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }

  const installMock = mock(async () => {})
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock(async () => {})
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const createPrCommentMock = mock()
  mock.module('../create-pr-comment', () => ({
    createPrComment: createPrCommentMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))
  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))
  const checkPastMock = mock()
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  // inject pull_request in context payload
  const contextMock = {
    ...realContext,
    payload: { pull_request: { number: 1 } },
  }
  mock.module('@actions/github', () => ({ context: contextMock }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(createPrCommentMock).toHaveBeenCalledWith(currentChangepacks)
  // early return prevents PR/release paths
  expect(createPrMock).not.toHaveBeenCalled()
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../create-pr-comment', () => originalPrComment)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
})

test('run does not create release when past changepacks is empty', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }

  const installMock = mock(async () => {})
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock(async () => {})
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const checkMock = mock(async () => ({}))
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const checkPastMock = mock(async () => ({}))
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(createPrMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
})

test('run fetches origin when ref is not base branch', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const installMock = mock(async () => {})
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock(async () => {})
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const checkPastMock = mock()
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  // inject different ref
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/develop',
  }
  mock.module('@actions/github', () => ({ context: contextMock }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(fetchOriginMock).toHaveBeenCalledWith('main')
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(createPrMock).toHaveBeenCalled()
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/github', () => originalGithub)
})
