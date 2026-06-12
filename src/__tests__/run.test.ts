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

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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

test('run keeps base branch changepack detection local when changepacks have nextVersion', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
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
    'pkg/rust': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'rust-pkg',
      path: 'pkg/rust',
      changed: false,
    },
  }
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        expect(args).toEqual([])
        return currentChangepacks
      }
      return {}
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const checkPastMock = mock()
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const getBooleanInputMock = mock((name: string) => name === 'publish')
  mock.module('@actions/core', () => ({
    getBooleanInput: getBooleanInputMock,
    getInput: mock(() => ''),
    info: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  mock.module('@actions/github', () => ({
    context: {
      ...realContext,
      ref: 'refs/heads/main',
      repo: { owner: 'acme', repo: 'widgets' },
      issue: { number: 1 },
    },
    getOctokit: mock(),
  }))

  const { run } = await import('../run')
  await run()

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(createPrMock).toHaveBeenCalledWith(currentChangepacks)
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(runChangepacksMock).not.toHaveBeenCalledWith('publish')

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
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
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const getBooleanInputMock = mock()
  mock.module('@actions/core', () => ({
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
  }))

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

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
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

test('run posts PR comment before base branch release logic when pull_request payload exists', async () => {
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

  mock.module('@actions/core', () => ({
    getInput: mock(() => ''),
    error: mock(),
    setFailed: mock(),
  }))

  mock.module('@actions/github', () => ({
    context: {
      ...realContext,
      ref: 'refs/heads/main',
      payload: { pull_request: { number: 1 } },
      repo: { owner: 'acme', repo: 'widgets' },
      issue: { number: 1 },
    },
    getOctokit: mock(),
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
  expect(createPrMock).not.toHaveBeenCalled()
  expect(checkPastMock).not.toHaveBeenCalled()
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(fetchOriginMock).not.toHaveBeenCalled()

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
    ref: 'refs/heads/main',
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
  expect(checkMock).toHaveBeenCalledWith('check', '--remote')
  expect(createPrMock).not.toHaveBeenCalled()
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

test('run filters past changepacks when current changepack version matches past nextVersion', async () => {
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

  // current changepacks with version that matches past nextVersion
  const currentChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.1',
      nextVersion: null,
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  // past changepacks with nextVersion that matches current version
  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  // pkg/a should be included (version matches nextVersion, so it's ready for release)
  // pkg/b should remain (no current changepack for it)
  expect(createReleaseMock).toHaveBeenCalledWith(config, {
    'pkg/a': pastChangepacks['pkg/a'],
    'pkg/b': pastChangepacks['pkg/b'],
  })
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

test('run filters past changepacks when nextVersion is null', async () => {
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

  // past changepacks with some having null nextVersion
  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: null,
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  // pkg/a should be filtered out (nextVersion is null)
  // pkg/b should remain (nextVersion is not null)
  expect(createReleaseMock).toHaveBeenCalledWith(config, {
    'pkg/b': pastChangepacks['pkg/b'],
  })
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

test('run filters past changepacks when current changepack version differs from past nextVersion', async () => {
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

  // current changepacks with version that differs from past nextVersion
  const currentChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.2',
      nextVersion: null,
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
  }
  const checkMock = mock(async () => currentChangepacks)
  mock.module('../run-changepacks', () => ({ runChangepacks: checkMock }))

  // past changepacks with nextVersion that differs from current version
  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

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
    ref: 'refs/heads/main',
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
  expect(checkMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  // pkg/a should be filtered out (version differs from nextVersion, so not ready for release)
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

test('run executes git clean in finally block even when error occurs', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  const execMock = mock()
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const installMock = mock(() => {
    throw new Error('Test error')
  })
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const getConfigMock = mock()
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: getConfigMock,
  }))

  const fetchOriginMock = mock()
  mock.module('../fetch-origin', () => ({
    fetchOrigin: fetchOriginMock,
  }))

  const checkMock = mock()
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
  await expect(run()).rejects.toThrow('Test error')

  expect(installMock).toHaveBeenCalled()
  // git clean should be called in finally block
  expect(execMock).toHaveBeenCalledWith('git', ['clean', '-fd'], {
    silent: true,
  })

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run does not fetch origin when ref matches base branch', async () => {
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
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
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

  // inject same ref as base branch
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(fetchOriginMock).not.toHaveBeenCalled()
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

test('run calls runChangepacks publish when publish option is true', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') {
      return checkMock()
    }
    return {}
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/b': { releaseId: 1, tagName: 'b(pkg/b)@2.1.0', makeLatest: false },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock((_name: string) => {
    return true
  })
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(sendSlackMock).toHaveBeenCalledWith(pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish', '-p', 'pkg/b')
  expect(createPrMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run sets changepacks output from releases when publish option is false', async () => {
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

  const execMock = mock()
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
  const runChangepacksMock = mock(async (_cmd: 'check' | 'publish') => {
    return checkMock()
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/b': { releaseId: 1, tagName: 'b(pkg/b)@2.1.0', makeLatest: false },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
    setOutput: setOutputMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(runChangepacksMock).not.toHaveBeenCalledWith('publish')
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', ['pkg/b'])
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

test('run calls info when publish succeeds', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const publishResult = {
    'pkg/a/package.json': {
      result: true,
      error: null,
    },
  }
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') {
      return checkMock()
    }
    return publishResult
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/b': { releaseId: 1, tagName: 'b(pkg/b)@2.1.0', makeLatest: true },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
  }))

  const updateReleaseMock = mock()
  const getOctokitMock = mock(() => ({
    rest: { repos: { updateRelease: updateReleaseMock } },
  }))
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(sendSlackMock).toHaveBeenCalledWith(pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish', '-p', 'pkg/b')
  expect(infoMock).toHaveBeenCalledWith(
    'pkg/a/package.json published successfully',
  )
  expect(errorMock).not.toHaveBeenCalled()
  expect(setFailedMock).not.toHaveBeenCalled()
  expect(createPrMock).not.toHaveBeenCalled()
  expect(getOctokitMock).toHaveBeenCalled()
  expect(infoMock).toHaveBeenCalledWith('updating latest: b(pkg/b)@2.1.0')
  expect(updateReleaseMock).toHaveBeenCalledWith({
    owner: 'acme',
    repo: 'widgets',
    release_id: 1,
    make_latest: 'true',
  })
  expect(infoMock).toHaveBeenCalledWith('updated latest: b(pkg/b)@2.1.0')

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run calls error and setFailed when publish fails', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const publishResult = {
    'pkg/b': {
      result: false,
      error: 'Publish failed: network error',
    },
  }
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      // Dry-run pass should succeed so the test can exercise the
      // actual publish failure path.
      if (args.includes('--dry-run')) {
        return {
          'pkg/b': { result: true, error: null, stdout: '', stderr: '' },
        }
      }
      return publishResult
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/b': { releaseId: 1, tagName: 'b(pkg/b)@2.1.0', makeLatest: false },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(sendSlackMock).toHaveBeenCalledWith(pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish', '-p', 'pkg/b')
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/b published failed: Publish failed: network error',
  )
  expect(rollbackMock).toHaveBeenCalledWith(publishResult, releaseInfo)
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [])
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/b published failed: Publish failed: network error',
  )
  expect(createPrMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run handles mixed publish results (some succeed, some fail)', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const publishResult = {
    'pkg/a/package.json': {
      result: true,
      error: null,
      stdout: 'npm notice published @scope/a@1.0.0',
      // Truthy stderr on success exercises the `info publish stderr: ...`
      // branch so the operator sees warnings even when publish ultimately
      // succeeded (e.g. npm deprecation notice, cargo registry retry).
      stderr: 'npm warn deprecated dep@x',
    },
    'pkg/b/package.json': {
      result: false,
      // Both stdout and stderr populated to surface the full child output
      // on the failure path — the only diagnostic that explains why the
      // publish failed when the action only has a 15-minute window.
      stdout: 'npm notice tarball already uploaded',
      stderr: 'E401 unauthorized',
      error: 'Publish failed',
    },
  }
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      // Dry-run pass should succeed so the test can exercise the
      // actual publish failure path.
      if (args.includes('--dry-run')) {
        return {
          'pkg/a/package.json': {
            result: true,
            error: null,
            stdout: '',
            stderr: '',
          },
          'pkg/b/package.json': {
            result: true,
            error: null,
            stdout: '',
            stderr: '',
          },
        }
      }
      return publishResult
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'a',
      path: 'pkg/a/package.json',
      changed: false,
    },
    'pkg/b/package.json': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b/package.json',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a/package.json': {
      releaseId: 1,
      tagName: 'a(pkg/a/package.json)@1.0.1',
      makeLatest: false,
    },
    'pkg/b/package.json': {
      releaseId: 2,
      tagName: 'b(pkg/b/package.json)@2.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(sendSlackMock).toHaveBeenCalledWith(pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '-p',
    'pkg/a/package.json',
    '-p',
    'pkg/b/package.json',
  )
  expect(infoMock).toHaveBeenCalledWith(
    'pkg/a/package.json published successfully',
  )
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/b/package.json published failed: Publish failed',
  )
  expect(rollbackMock).toHaveBeenCalledWith(publishResult, releaseInfo)
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [
    'pkg/a/package.json',
  ])
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/b/package.json published failed: Publish failed',
  )
  expect(createPrMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run includes filtered-out publish targets in changepacks output', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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

  // changepacks publish was invoked with `publish_options: -l rust`, which
  // makes changepacks itself only publish the rust crate. The node/python
  // packages are released as GitHub releases but their actual publishing is
  // delegated to downstream workflows, so they are absent from the publish
  // result map.
  const checkMock = mock(async () => ({}))
  const publishResult = {
    'crates/rust/Cargo.toml': {
      result: true,
      error: null,
      stderr: null,
      stdout: 'cargo publish ok',
    },
  }
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') {
      return checkMock()
    }
    return publishResult
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'crates/rust/Cargo.toml': {
      logs: [],
      version: '0.1.0',
      nextVersion: '0.1.1',
      name: 'rust-crate',
      path: 'crates/rust/Cargo.toml',
      changed: false,
    },
    'bridge/node/package.json': {
      logs: [],
      version: '0.1.0',
      nextVersion: '0.1.1',
      name: '@scope/node',
      path: 'bridge/node/package.json',
      changed: false,
    },
    'bridge/python/pyproject.toml': {
      logs: [],
      version: '0.1.0',
      nextVersion: '0.1.1',
      name: 'scope-python',
      path: 'bridge/python/pyproject.toml',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'crates/rust/Cargo.toml': {
      releaseId: 1,
      tagName: 'rust-crate(crates/rust/Cargo.toml)@0.1.1',
      makeLatest: false,
    },
    'bridge/node/package.json': {
      releaseId: 2,
      tagName: '@scope/node(bridge/node/package.json)@0.1.1',
      makeLatest: false,
    },
    'bridge/python/pyproject.toml': {
      releaseId: 3,
      tagName: 'scope-python(bridge/python/pyproject.toml)@0.1.1',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock((name: string) => {
    if (name === 'publish_options') return '-l rust'
    return ''
  })
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: setOutputMock,
  }))

  const updateReleaseMock = mock(async () => ({}))
  const getOctokitMock = mock(() => ({
    rest: { repos: { updateRelease: updateReleaseMock } },
  }))
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  // changepacks publish is called with -p for every released path AND the
  // publish_options that were forwarded by the user (-l rust).
  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '-p',
    'crates/rust/Cargo.toml',
    '-p',
    'bridge/node/package.json',
    '-p',
    'bridge/python/pyproject.toml',
    '-l',
    'rust',
  )
  // Only the rust crate was actually published by changepacks.
  expect(infoMock).toHaveBeenCalledWith(
    'crates/rust/Cargo.toml published successfully',
  )
  // The node/python paths were filtered out by `-l rust`, so they should be
  // surfaced as delegated-downstream so downstream publish jobs can pick
  // them up via the `changepacks` output.
  expect(infoMock).toHaveBeenCalledWith(
    'not published by changepacks, delegated downstream: bridge/node/package.json, bridge/python/pyproject.toml',
  )
  // The published output must contain every release that needs follow-up
  // work: the rust crate that changepacks published itself plus the
  // node/python paths that downstream pipelines will publish.
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [
    'crates/rust/Cargo.toml',
    'bridge/node/package.json',
    'bridge/python/pyproject.toml',
  ])
  // Nothing failed, so rollback / setFailed must not have been triggered.
  expect(rollbackMock).not.toHaveBeenCalled()
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run does not call publish when createRelease returns false', async () => {
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
  const runChangepacksMock = mock(async (_cmd: 'check' | 'publish') => {
    return checkMock()
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock()
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
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
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(runChangepacksMock).not.toHaveBeenCalledWith('publish')
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

test('run passes only filtered project paths to publish command', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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

  // current changepacks shows pkg/a is at version 1.1.0 and pkg/b is at version 2.1.0
  const currentChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.1.0',
      nextVersion: null,
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.1.0',
      nextVersion: null,
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
    'pkg/c': {
      logs: [],
      version: '3.0.0',
      nextVersion: null,
      name: 'c',
      path: 'pkg/c',
      changed: false,
    },
  }

  // past changepacks: pkg/a should be released (version matches nextVersion),
  // pkg/b should NOT be released (version doesn't match nextVersion),
  // pkg/c should be released (nextVersion matches current version)
  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0', // matches current version -> should publish
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.0.1', // doesn't match current version 2.1.0 -> should NOT publish
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
    'pkg/c': {
      logs: [],
      version: '2.5.0',
      nextVersion: '3.0.0', // matches current version -> should publish
      name: 'c',
      path: 'pkg/c',
      changed: false,
    },
  }

  const filteredPastChangepacks = {
    'pkg/a': pastChangepacks['pkg/a'],
    'pkg/c': pastChangepacks['pkg/c'],
  }

  const checkMock = mock(async () => currentChangepacks)
  const publishResult = {
    'pkg/a': { result: true, error: null },
  }
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') {
      return checkMock()
    }
    return publishResult
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a': { releaseId: 1, tagName: 'a(pkg/a)@1.1.0', makeLatest: false },
    'pkg/c': {
      releaseId: 2,
      tagName: 'c(pkg/c)@3.0.0',
      makeLatest: false,
      alreadyExisted: true,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  // createRelease should be called with filtered changepacks (pkg/a and pkg/c only)
  expect(createReleaseMock).toHaveBeenCalledWith(
    config,
    filteredPastChangepacks,
  )
  // Should only pass pkg/a. pkg/c is filtered in, but skipped because its
  // release already exists from a previous run.
  expect(runChangepacksMock).toHaveBeenCalledWith('publish', '-p', 'pkg/a')
  // Should NOT include pkg/b
  expect(infoMock).toHaveBeenCalledWith('publish target: pkg/a')
  expect(infoMock).toHaveBeenCalledWith('pkg/a published successfully')
  expect(infoMock).not.toHaveBeenCalledWith('pkg/c published successfully')

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run skips publish when all releases already exist on rerun', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }

  mock.module('@actions/exec', () => ({ exec: mock(async () => 0) }))
  mock.module('../install-changepacks', () => ({ installChangepacks: mock() }))

  const config = { baseBranch: 'main', ignore: [], latestPackage: null }
  mock.module('../get-changepacks-config', () => ({
    getChangepacksConfig: mock(async () => config),
  }))
  mock.module('../fetch-origin', () => ({ fetchOrigin: mock() }))

  const changepack = {
    logs: [],
    version: '1.1.0',
    nextVersion: null,
    name: 'a',
    path: 'pkg/a',
    changed: false,
  }
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') return { 'pkg/a': changepack }
    return {}
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: mock(async () => ({
      'pkg/a': { ...changepack, version: '1.0.0', nextVersion: '1.1.0' },
    })),
  }))
  mock.module('../create-pr', () => ({ createPr: mock() }))
  mock.module('../create-release', () => ({
    createRelease: mock(async () => ({
      'pkg/a': {
        releaseId: 1,
        tagName: 'a(pkg/a)@1.1.0',
        makeLatest: true,
        alreadyExisted: true,
      },
    })),
  }))
  mock.module('../update-pr-comment', () => ({ updatePrComment: mock() }))
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: mock(),
  }))

  const infoMock = mock()
  const setOutputMock = mock()
  mock.module('@actions/core', () => ({
    getInput: mock(() => ''),
    getBooleanInput: mock(() => true),
    debug: mock(),
    info: infoMock,
    error: mock(),
    setFailed: mock(),
    setOutput: setOutputMock,
  }))
  mock.module('@actions/github', () => ({
    context: {
      ...realContext,
      ref: 'refs/heads/main',
      repo: { owner: 'acme', repo: 'widgets' },
      issue: { number: 1 },
    },
    getOctokit: mock(() => ({
      rest: { repos: { updateRelease: mock() } },
    })),
  }))

  const { run } = await import('../run')
  await run()

  expect(runChangepacksMock).not.toHaveBeenCalledWith('publish')
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [])
  expect(infoMock).toHaveBeenCalledWith(
    'all releases already exist, skipping publish',
  )

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run passes publish_options to runChangepacks publish command', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const runChangepacksMock = mock(async (cmd: 'check' | 'publish') => {
    if (cmd === 'check') {
      return checkMock()
    }
    return {}
  })
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/b': { releaseId: 1, tagName: 'b(pkg/b)@2.1.0', makeLatest: false },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock((name: string) => {
    if (name === 'publish_options') return '-l rust'
    return ''
  })
  const getBooleanInputMock = mock(() => true)
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: mock(),
    error: mock(),
    setFailed: mock(),
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '-p',
    'pkg/b',
    '-l',
    'rust',
  )

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run rolls back all releases when publish command crashes (exit code 1)', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const publishError = new Error('Process failed with exit code 1')
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      // Dry-run pass should succeed so the test can exercise the
      // actual publish crash path.
      if (args.includes('--dry-run')) {
        return {
          'pkg/a': { result: true, error: null, stdout: '', stderr: '' },
          'pkg/b': { result: true, error: null, stdout: '', stderr: '' },
        }
      }
      throw publishError
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a': {
      releaseId: 10,
      tagName: 'a(pkg/a)@1.1.0',
      makeLatest: true,
    },
    'pkg/b': {
      releaseId: 20,
      tagName: 'b(pkg/b)@2.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(sendSlackMock).toHaveBeenCalledWith(pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '-p',
    'pkg/a',
    '-p',
    'pkg/b',
  )
  expect(errorMock).toHaveBeenCalledWith(`publish crashed: ${publishError}`)
  // rollback should be called with all paths marked as failed
  expect(rollbackMock).toHaveBeenCalledWith(
    {
      'pkg/a': {
        result: false,
        error: String(publishError),
        stderr: null,
        stdout: null,
      },
      'pkg/b': {
        result: false,
        error: String(publishError),
        stderr: null,
        stdout: null,
      },
    },
    releaseInfo,
  )
  expect(setFailedMock).toHaveBeenCalledWith(publishError)

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run calls rollbackReleases with publish result and release info when publish fails', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const publishResult = {
    'pkg/a': { result: true, error: null },
    'pkg/b': { result: false, error: 'npm publish failed' },
  }
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      // Dry-run pass should succeed so the test can exercise the
      // actual publish failure path.
      if (args.includes('--dry-run')) {
        return {
          'pkg/a': { result: true, error: null, stdout: '', stderr: '' },
          'pkg/b': { result: true, error: null, stdout: '', stderr: '' },
        }
      }
      return publishResult
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a': {
      releaseId: 10,
      tagName: 'a(pkg/a)@1.1.0',
      makeLatest: false,
    },
    'pkg/b': {
      releaseId: 20,
      tagName: 'b(pkg/b)@2.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(infoMock).toHaveBeenCalledWith('pkg/a published successfully')
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/b published failed: npm publish failed',
  )
  expect(rollbackMock).toHaveBeenCalledWith(publishResult, releaseInfo)
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/b published failed: npm publish failed',
  )

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run aborts before createRelease when dry-run reports per-package failure', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  // Dry-run returns mixed results: one succeeds (with stdout), one fails.
  // This drives the entire dry-run loop: the success branch logs stdout,
  // and the failure branch builds dryRunErrors and triggers rollback.
  const dryRunResult = {
    'pkg/a': {
      result: true,
      error: null,
      stdout: 'npm notice dry-run ok',
      stderr: null,
    },
    'pkg/b': {
      result: false,
      error: null,
      stdout: '',
      stderr: 'EPUBLISHCONFLICT: package version already exists',
    },
  }
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      if (args.includes('--dry-run')) {
        return dryRunResult
      }
      // Actual publish must never be reached.
      throw new Error('actual publish should not run when dry-run fails')
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
    'pkg/b': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'b',
      path: 'pkg/b',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a': {
      releaseId: 10,
      tagName: 'a(pkg/a)@1.1.0',
      makeLatest: true,
    },
    'pkg/b': {
      releaseId: 20,
      tagName: 'b(pkg/b)@2.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '--dry-run',
    '-p',
    'pkg/a',
    '-p',
    'pkg/b',
  )
  // Actual publish call must NOT have happened.
  expect(runChangepacksMock).not.toHaveBeenCalledWith(
    'publish',
    '-p',
    'pkg/a',
    '-p',
    'pkg/b',
  )
  // Dry-run is a GATE: createRelease, sendSlackNotification, and the
  // post-failure rollback path must ALL be skipped when dry-run reports a
  // per-package failure. The whole run aborts before any GitHub release
  // is created so the user never ends up with stale releases that block
  // a rerun.
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(sendSlackMock).not.toHaveBeenCalled()
  expect(rollbackMock).not.toHaveBeenCalled()
  // Success branch must log stdout when present.
  expect(infoMock).toHaveBeenCalledWith('pkg/a dry-run succeeded')
  expect(infoMock).toHaveBeenCalledWith('dry-run stdout: npm notice dry-run ok')
  // Failure branch falls back to stderr when error is null.
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/b dry-run failed: EPUBLISHCONFLICT: package version already exists',
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/b dry-run failed: EPUBLISHCONFLICT: package version already exists',
  )

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run aborts before createRelease when dry-run crashes', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
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
  const dryRunError = new Error('binary spawn failed: ENOENT')
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      if (args.includes('--dry-run')) {
        throw dryRunError
      }
      throw new Error('actual publish should not run when dry-run crashes')
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'pkg/a',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a': {
      releaseId: 10,
      tagName: 'a(pkg/a)@1.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
  }))

  const getOctokitMock = mock()
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '--dry-run',
    '-p',
    'pkg/a',
  )
  // Actual publish must not run after a dry-run crash.
  expect(runChangepacksMock).not.toHaveBeenCalledWith('publish', '-p', 'pkg/a')
  expect(errorMock).toHaveBeenCalledWith(
    `publish --dry-run crashed: ${dryRunError}`,
  )
  // Dry-run is a GATE: a crash before createRelease aborts the entire run
  // so no GitHub release / tag is created and there is nothing to roll
  // back. sendSlackNotification is also skipped for the same reason.
  expect(createReleaseMock).not.toHaveBeenCalled()
  expect(sendSlackMock).not.toHaveBeenCalled()
  expect(rollbackMock).not.toHaveBeenCalled()
  expect(setFailedMock).toHaveBeenCalledWith(dryRunError)

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
})

test('run logs workspace-internal dep skips and continues dry-run for remaining targets', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalDetect = {
    ...(await import('../detect-workspace-internal-deps')),
  }

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
  mock.module('../fetch-origin', () => ({ fetchOrigin: fetchOriginMock }))

  const checkMock = mock(async () => ({}))
  // Both passes succeed when invoked. The point of the test is to verify
  // that the skip log fires AND that the dry-run only sees the
  // non-skipped path.
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      if (args.includes('--dry-run')) {
        return {
          'pkg/a/package.json': {
            result: true,
            error: null,
            stdout: 'ok',
            stderr: '',
          },
        }
      }
      return {
        'pkg/a/package.json': {
          result: true,
          error: null,
          stdout: 'published',
          stderr: '',
        },
      }
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'pkg/a/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'pkg-a',
      path: 'pkg/a/package.json',
      changed: false,
    },
    'crates/parent/Cargo.toml': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'crate-parent',
      path: 'crates/parent/Cargo.toml',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'pkg/a/package.json': {
      releaseId: 10,
      tagName: 'pkg-a@1.1.0',
      makeLatest: false,
    },
    'crates/parent/Cargo.toml': {
      releaseId: 20,
      tagName: 'crate-parent@1.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  // The crux of the test: the detector reports one skipped Rust target.
  const detectMock = mock(async () => ({
    filtered: ['pkg/a/package.json'],
    skipped: ['crates/parent/Cargo.toml'],
  }))
  mock.module('../detect-workspace-internal-deps', () => ({
    detectWorkspaceInternalDeps: detectMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: mock(),
    startGroup: mock(),
    endGroup: mock(),
    isDebug: mock(() => false),
  }))

  const getOctokitMock = mock(() => ({
    rest: { repos: { updateRelease: mock(async () => ({})) } },
  }))
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  // The detector must receive the full target list, not the filtered one.
  expect(detectMock).toHaveBeenCalledWith([
    'pkg/a/package.json',
    'crates/parent/Cargo.toml',
  ])
  // The skip log must fire with the rust-lang/cargo#1169 reference so the
  // operator can immediately understand why the path was excluded.
  expect(infoMock).toHaveBeenCalledWith(
    'dry-run skipped (workspace-internal dep — rust-lang/cargo#1169): crates/parent/Cargo.toml',
  )
  // The dry-run runChangepacks invocation must only include the filtered
  // path; the skipped path must NOT be passed to changepacks.
  expect(runChangepacksMock).toHaveBeenCalledWith(
    'publish',
    '--dry-run',
    '-p',
    'pkg/a/package.json',
  )
  expect(createReleaseMock).toHaveBeenCalled()
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
  mock.module('../detect-workspace-internal-deps', () => originalDetect)
})

test('run skips changepacks publish --dry-run when every target is workspace-internal', async () => {
  const originalInstall = { ...(await import('../install-changepacks')) }
  const originalCheck = { ...(await import('../run-changepacks')) }
  const originalPast = { ...(await import('../check-past-changepacks')) }
  const originalPr = { ...(await import('../create-pr')) }
  const originalRel = { ...(await import('../create-release')) }
  const originalRollback = { ...(await import('../rollback-releases')) }
  const originalUpdatePr = { ...(await import('../update-pr-comment')) }
  const originalSlack = { ...(await import('../send-slack-notification')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalConfig = { ...(await import('../get-changepacks-config')) }
  const originalFetch = { ...(await import('../fetch-origin')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalDetect = {
    ...(await import('../detect-workspace-internal-deps')),
  }

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
  mock.module('../fetch-origin', () => ({ fetchOrigin: fetchOriginMock }))

  const checkMock = mock(async () => ({}))
  // When every target is skipped, `changepacks publish --dry-run` must
  // NEVER be invoked. Throw from the dry-run branch so the test fails
  // loudly if that contract is ever violated.
  const runChangepacksMock = mock(
    async (cmd: 'check' | 'publish', ...args: string[]) => {
      if (cmd === 'check') {
        return checkMock()
      }
      if (args.includes('--dry-run')) {
        throw new Error('dry-run must not run when all targets are skipped')
      }
      return {
        'crates/a/Cargo.toml': {
          result: true,
          error: null,
          stdout: 'published',
          stderr: '',
        },
        'crates/b/Cargo.toml': {
          result: true,
          error: null,
          stdout: 'published',
          stderr: '',
        },
      }
    },
  )
  mock.module('../run-changepacks', () => ({
    runChangepacks: runChangepacksMock,
  }))

  const pastChangepacks = {
    'crates/a/Cargo.toml': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'crate-a',
      path: 'crates/a/Cargo.toml',
      changed: false,
    },
    'crates/b/Cargo.toml': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'crate-b',
      path: 'crates/b/Cargo.toml',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const releaseInfo = {
    'crates/a/Cargo.toml': {
      releaseId: 10,
      tagName: 'crate-a@1.1.0',
      makeLatest: false,
    },
    'crates/b/Cargo.toml': {
      releaseId: 20,
      tagName: 'crate-b@1.1.0',
      makeLatest: false,
    },
  }
  const createReleaseMock = mock(async () => releaseInfo)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const rollbackMock = mock()
  mock.module('../rollback-releases', () => ({
    rollbackReleases: rollbackMock,
  }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
  }))

  const sendSlackMock = mock()
  mock.module('../send-slack-notification', () => ({
    sendSlackNotification: sendSlackMock,
  }))

  // Both targets get skipped: filtered is empty, skipped lists both.
  const detectMock = mock(async () => ({
    filtered: [],
    skipped: ['crates/a/Cargo.toml', 'crates/b/Cargo.toml'],
  }))
  mock.module('../detect-workspace-internal-deps', () => ({
    detectWorkspaceInternalDeps: detectMock,
  }))

  const getInputMock = mock()
  const getBooleanInputMock = mock(() => true)
  const infoMock = mock()
  const errorMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    getBooleanInput: getBooleanInputMock,
    debug: mock(),
    info: infoMock,
    error: errorMock,
    setFailed: setFailedMock,
    setOutput: mock(),
    startGroup: mock(),
    endGroup: mock(),
    isDebug: mock(() => false),
  }))

  const getOctokitMock = mock(() => ({
    rest: { repos: { updateRelease: mock(async () => ({})) } },
  }))
  const contextMock = {
    ...realContext,
    ref: 'refs/heads/main',
    repo: { owner: 'acme', repo: 'widgets' },
    issue: { number: 1 },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
    getOctokit: getOctokitMock,
  }))

  const { run } = await import('../run')
  await run()

  // The 0-validated summary must fire so the operator can confirm the
  // skip was intentional rather than a missed call.
  expect(infoMock).toHaveBeenCalledWith(
    'dry-run summary: 0 validated (all targets skipped as workspace-internal deps)',
  )
  // createRelease still runs since nothing failed the gate.
  expect(createReleaseMock).toHaveBeenCalled()
  expect(setFailedMock).not.toHaveBeenCalled()

  mock.module('../install-changepacks', () => originalInstall)
  mock.module('../run-changepacks', () => originalCheck)
  mock.module('../check-past-changepacks', () => originalPast)
  mock.module('../create-pr', () => originalPr)
  mock.module('../create-release', () => originalRel)
  mock.module('../rollback-releases', () => originalRollback)
  mock.module('../update-pr-comment', () => originalUpdatePr)
  mock.module('../send-slack-notification', () => originalSlack)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('../get-changepacks-config', () => originalConfig)
  mock.module('../fetch-origin', () => originalFetch)
  mock.module('@actions/exec', () => originalExec)
  mock.module('../detect-workspace-internal-deps', () => originalDetect)
})
