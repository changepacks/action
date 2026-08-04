import { expect, mock, test } from 'bun:test'
import { resolve } from 'node:path'

const BINARY_PACKAGE = 'changepacks(crates/changepacks/Cargo.toml)'

function binaryAssets(tagName: string) {
  return [
    {
      name: 'changepacks-linux-x64',
      browser_download_url: `https://example.com/${tagName}/changepacks-linux-x64`,
    },
  ]
}

test('installChangepacks downloads asset and writes binary (linux/x64)', async () => {
  const originalFs = { ...(await import('node:fs/promises')) }
  const originalOs = { ...(await import('node:os')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalHttp = { ...(await import('@actions/http-client')) }

  const writeFileMock = mock()
  mock.module('node:fs/promises', () => ({
    writeFile: writeFileMock,
    chmod: mock(),
  }))

  const typeMock = mock(() => 'Linux')
  const machineMock = mock(() => 'x64')
  mock.module('node:os', () => ({ type: typeMock, machine: machineMock }))

  const getInputMock = mock((_name: string) => 'TOKEN')
  const debugMock = mock()
  const infoMock = mock()
  const setFailedMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    debug: debugMock,
    info: infoMock,
    setFailed: setFailedMock,
    warning: warningMock,
  }))

  const pullsGetLatestReleaseMock = mock(async () => ({
    data: {
      tag_name: 'v1.2.3',
      assets: [
        {
          name: 'changepacks-linux-x64',
          browser_download_url: 'https://example.com/changepacks-linux-x64',
        },
      ],
    },
  }))
  const listReleasesMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      repos: {
        getLatestRelease: pullsGetLatestReleaseMock,
        listReleases: listReleasesMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({ getOctokit: getOctokitMock }))

  const httpGetMock = mock(async (_url: string) => ({
    readBodyBuffer: async () => Buffer.from('BINARYDATA'),
  }))
  function HttpClient(this: { get: typeof httpGetMock }) {
    this.get = httpGetMock
  }
  mock.module('@actions/http-client', () => ({ HttpClient: HttpClient }))

  const { installChangepacks } = await import('../install-changepacks')
  await installChangepacks()

  expect(getInputMock).toHaveBeenCalledWith('token')
  expect(getOctokitMock).toHaveBeenCalledWith('TOKEN')
  expect(pullsGetLatestReleaseMock).toHaveBeenCalled()
  expect(listReleasesMock).not.toHaveBeenCalled()
  expect(warningMock).not.toHaveBeenCalled()
  expect(debugMock).toHaveBeenCalledWith(
    'downloading asset: changepacks-linux-x64',
  )
  expect(httpGetMock).toHaveBeenCalledWith(
    'https://example.com/changepacks-linux-x64',
  )
  expect(writeFileMock).toHaveBeenCalledWith(
    resolve('changepacks'),
    Buffer.from('BINARYDATA'),
  )
  expect(infoMock).toHaveBeenCalledWith('changepacks version: v1.2.3')
  expect(setFailedMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('@actions/http-client', () => originalHttp)
})

test('installChangepacks falls back to an older release of the same package', async () => {
  const originalFs = { ...(await import('node:fs/promises')) }
  const originalOs = { ...(await import('node:os')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalHttp = { ...(await import('@actions/http-client')) }

  const writeFileMock = mock()
  mock.module('node:fs/promises', () => ({
    writeFile: writeFileMock,
    chmod: mock(),
  }))

  const typeMock = mock(() => 'Linux')
  const machineMock = mock(() => 'x64')
  mock.module('node:os', () => ({ type: typeMock, machine: machineMock }))

  const getInputMock = mock((_name: string) => 'TOKEN')
  const debugMock = mock()
  const infoMock = mock()
  const setFailedMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    debug: debugMock,
    info: infoMock,
    setFailed: setFailedMock,
    warning: warningMock,
  }))

  const getLatestReleaseMock = mock(async () => ({
    data: { tag_name: `${BINARY_PACKAGE}@0.3.0`, assets: [] },
  }))
  const listReleasesMock = mock(async () => ({
    data: [
      // sibling packages of the same version bump must not consume the depth
      {
        tag_name: 'changepacks-utils(crates/utils/Cargo.toml)@0.3.0',
        draft: false,
        prerelease: false,
        assets: [],
      },
      {
        tag_name: 'changepacks-cli(crates/cli/Cargo.toml)@0.3.0',
        draft: false,
        prerelease: false,
        assets: [],
      },
      {
        tag_name: '@changepacks/cli(bridge/node/package.json)@0.2.34',
        draft: false,
        prerelease: false,
        assets: [{ name: 'changepacks.linux-x64-gnu.node' }],
      },
      // already attempted through getLatestRelease
      {
        tag_name: `${BINARY_PACKAGE}@0.3.0`,
        draft: false,
        prerelease: false,
        assets: [],
      },
      {
        tag_name: `${BINARY_PACKAGE}@0.2.36`,
        draft: true,
        prerelease: false,
        assets: binaryAssets('draft'),
      },
      {
        tag_name: `${BINARY_PACKAGE}@0.2.36-rc.1`,
        draft: false,
        prerelease: true,
        assets: binaryAssets('rc'),
      },
      {
        tag_name: `${BINARY_PACKAGE}@0.2.35`,
        draft: false,
        prerelease: false,
        assets: binaryAssets('0.2.35'),
      },
    ],
  }))
  const octokit = {
    rest: {
      repos: {
        getLatestRelease: getLatestReleaseMock,
        listReleases: listReleasesMock,
      },
    },
  }
  mock.module('@actions/github', () => ({
    getOctokit: mock((_token: string) => octokit),
  }))

  const httpGetMock = mock(async (_url: string) => ({
    readBodyBuffer: async () => Buffer.from('OLDBINARY'),
  }))
  function HttpClient(this: { get: typeof httpGetMock }) {
    this.get = httpGetMock
  }
  mock.module('@actions/http-client', () => ({ HttpClient: HttpClient }))

  const { installChangepacks } = await import('../install-changepacks')
  await installChangepacks()

  expect(listReleasesMock).toHaveBeenCalledWith({
    owner: 'changepacks',
    repo: 'changepacks',
    per_page: 100,
    page: 1,
  })
  expect(warningMock).toHaveBeenCalledTimes(1)
  expect(warningMock).toHaveBeenCalledWith(
    `changepacks release ${BINARY_PACKAGE}@0.3.0 has no changepacks-linux-x64 asset (1/10), falling back to an older release`,
  )
  expect(httpGetMock).toHaveBeenCalledWith(
    'https://example.com/0.2.35/changepacks-linux-x64',
  )
  expect(writeFileMock).toHaveBeenCalledWith(
    resolve('changepacks'),
    Buffer.from('OLDBINARY'),
  )
  expect(infoMock).toHaveBeenCalledWith(
    `changepacks version: ${BINARY_PACKAGE}@0.2.35`,
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('@actions/http-client', () => originalHttp)
})

test('installChangepacks paginates and gives up after 10 releases', async () => {
  const originalFs = { ...(await import('node:fs/promises')) }
  const originalOs = { ...(await import('node:os')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const writeFileMock = mock()
  mock.module('node:fs/promises', () => ({ writeFile: writeFileMock }))

  const typeMock = mock(() => 'Linux')
  const machineMock = mock(() => 'x64')
  mock.module('node:os', () => ({ type: typeMock, machine: machineMock }))

  const getInputMock = mock((_name: string) => 'TOKEN')
  const debugMock = mock()
  const infoMock = mock()
  const setFailedMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    debug: debugMock,
    info: infoMock,
    setFailed: setFailedMock,
    warning: warningMock,
  }))

  // a full page of sibling package releases, so the binary releases only show
  // up on the second page
  const siblingPage = Array.from({ length: 100 }, (_, index) => ({
    tag_name: `changepacks-utils(crates/utils/Cargo.toml)@0.${index}.0`,
    draft: false,
    prerelease: false,
    assets: [],
  }))
  const binaryPage = Array.from({ length: 20 }, (_, index) => ({
    tag_name: `${BINARY_PACKAGE}@0.${20 - index}.0`,
    draft: false,
    prerelease: false,
    assets: [],
  }))
  const getLatestReleaseMock = mock(async () => ({
    data: { tag_name: `${BINARY_PACKAGE}@1.0.0`, assets: [] },
  }))
  const listReleasesMock = mock(async ({ page }: { page: number }) => ({
    data: page === 1 ? siblingPage : binaryPage,
  }))
  const octokit = {
    rest: {
      repos: {
        getLatestRelease: getLatestReleaseMock,
        listReleases: listReleasesMock,
      },
    },
  }
  mock.module('@actions/github', () => ({
    getOctokit: mock((_token: string) => octokit),
  }))

  const { installChangepacks } = await import('../install-changepacks')
  await installChangepacks()

  expect(listReleasesMock).toHaveBeenCalledTimes(2)
  expect(warningMock).toHaveBeenCalledTimes(10)
  expect(warningMock).toHaveBeenLastCalledWith(
    `changepacks release ${BINARY_PACKAGE}@0.12.0 has no changepacks-linux-x64 asset (10/10), falling back to an older release`,
  )
  expect(setFailedMock).toHaveBeenCalledWith('changepacks binary not found')
  expect(writeFileMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('installChangepacks sets failed when asset not found', async () => {
  const originalFs = { ...(await import('node:fs/promises')) }
  const originalOs = { ...(await import('node:os')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }

  const writeFileMock = mock()
  mock.module('node:fs/promises', () => ({ writeFile: writeFileMock }))

  const typeMock = mock(() => 'Linux')
  const machineMock = mock(() => 'x64')
  mock.module('node:os', () => ({ type: typeMock, machine: machineMock }))

  const getInputMock = mock((_name: string) => 'TOKEN')
  const debugMock = mock()
  const infoMock = mock()
  const setFailedMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    debug: debugMock,
    info: infoMock,
    setFailed: setFailedMock,
    warning: warningMock,
  }))

  const pullsGetLatestReleaseMock = mock(async () => ({
    data: { tag_name: 'v1.2.3', assets: [] },
  }))
  const listReleasesMock = mock(async () => ({ data: [] }))
  const octokit = {
    rest: {
      repos: {
        getLatestRelease: pullsGetLatestReleaseMock,
        listReleases: listReleasesMock,
      },
    },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({ getOctokit: getOctokitMock }))

  const { installChangepacks } = await import('../install-changepacks')
  await installChangepacks()

  expect(warningMock).toHaveBeenCalledTimes(1)
  expect(listReleasesMock).toHaveBeenCalledTimes(1)
  expect(setFailedMock).toHaveBeenCalledWith('changepacks binary not found')
  expect(writeFileMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
