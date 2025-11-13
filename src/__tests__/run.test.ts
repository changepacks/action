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
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async (_cmd: 'check' | 'update') => currentChangepacks)
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
  mock.module('@actions/exec', () => originalExec)
})

test('run creates releases from past changepacks when current is empty', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
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
  mock.module('@actions/exec', () => originalExec)
})

test('run posts PR comment and returns early when payload.pull_request exists', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }

  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    payload: { pull_request: { number: 1 } },
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))
  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))
  const checkPastMock = mock()
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(updatePrMock).toHaveBeenCalledWith(currentChangepacks, 1)
  // early return prevents PR/release paths
  expect(createPrMock).not.toHaveBeenCalled()
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('@actions/github', () => originalGithub)
  mock.module('@actions/core', () => originalCore)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run does not create release when past changepacks is empty', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const checkMock = mock(async () => ({}))

  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

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
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run fetches origin when ref is not base branch', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock()
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  const getConfigMock = mock(async () => config)
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const currentChangepacks = {
    'pkg/a': { logs: [], version: '1.0.0', nextVersion: '1.0.1', name: 'a' },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
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
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

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
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})
