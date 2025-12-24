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
  expect(checkMock).toHaveBeenCalledWith('check')
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

  const createReleaseMock = mock(async () => true)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
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
  expect(runChangepacksMock).toHaveBeenCalledWith('publish')
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

test('run does not call runChangepacks publish when publish option is false', async () => {
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

test('run calls info when publish succeeds', async () => {
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

  const createReleaseMock = mock(async () => true)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
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

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish')
  expect(infoMock).toHaveBeenCalledWith(
    'pkg/a/package.json published successfully',
  )
  expect(errorMock).not.toHaveBeenCalled()
  expect(setFailedMock).not.toHaveBeenCalled()
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

test('run calls error and setFailed when publish fails', async () => {
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
  const publishResult = {
    'pkg/a/package.json': {
      result: false,
      error: 'Publish failed: network error',
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

  const createReleaseMock = mock(async () => true)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
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

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish')
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/a/package.json published failed: Publish failed: network error',
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/a/package.json published failed: Publish failed: network error',
  )
  expect(infoMock).not.toHaveBeenCalled()
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

test('run handles mixed publish results (some succeed, some fail)', async () => {
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
  const publishResult = {
    'pkg/a/package.json': {
      result: true,
      error: null,
    },
    'pkg/b/package.json': {
      result: false,
      error: 'Publish failed',
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
    'pkg/c': {
      logs: [],
      version: '2.0.0',
      nextVersion: '2.1.0',
      name: 'c',
      path: 'pkg/c',
      changed: false,
    },
  }
  const checkPastMock = mock(async () => pastChangepacks)
  mock.module('../check-past-changepacks', () => ({
    checkPastChangepacks: checkPastMock,
  }))

  const createPrMock = mock()
  mock.module('../create-pr', () => ({ createPr: createPrMock }))

  const createReleaseMock = mock(async () => true)
  mock.module('../create-release', () => ({ createRelease: createReleaseMock }))

  const updatePrMock = mock()
  mock.module('../update-pr-comment', () => ({
    updatePrComment: updatePrMock,
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

  expect(installMock).toHaveBeenCalled()
  expect(getConfigMock).toHaveBeenCalled()
  expect(runChangepacksMock).toHaveBeenCalledWith('check')
  expect(checkPastMock).toHaveBeenCalled()
  expect(createReleaseMock).toHaveBeenCalledWith(config, pastChangepacks)
  expect(runChangepacksMock).toHaveBeenCalledWith('publish')
  expect(infoMock).toHaveBeenCalledWith(
    'pkg/a/package.json published successfully',
  )
  expect(errorMock).toHaveBeenCalledWith(
    'pkg/b/package.json published failed: Publish failed',
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    'pkg/b/package.json published failed: Publish failed',
  )
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
