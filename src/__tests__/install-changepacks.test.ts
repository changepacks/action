import { expect, mock, test } from 'bun:test'
import { resolve } from 'node:path'

test('installChangepacks downloads asset and writes binary (linux/x64)', async () => {
  const originalFs = { ...(await import('node:fs/promises')) }
  const originalOs = { ...(await import('node:os')) }
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalHttp = { ...(await import('@actions/http-client')) }

  const writeFileMock = mock()
  mock.module('node:fs/promises', () => ({ writeFile: writeFileMock }))

  const typeMock = mock(() => 'Linux')
  const machineMock = mock(() => 'x64')
  mock.module('node:os', () => ({ type: typeMock, machine: machineMock }))

  const getInputMock = mock((_name: string) => 'TOKEN')
  const infoMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    setFailed: setFailedMock,
  }))

  const pullsGetLatestReleaseMock = mock(async () => ({
    data: {
      assets: [
        {
          name: 'changepacks-linux-x64',
          browser_download_url: 'https://example.com/changepacks-linux-x64',
        },
      ],
    },
  }))
  const octokit = {
    rest: { repos: { getLatestRelease: pullsGetLatestReleaseMock } },
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
  expect(infoMock).toHaveBeenCalledWith(
    'downloading asset: changepacks-linux-x64',
  )
  expect(httpGetMock).toHaveBeenCalledWith(
    'https://example.com/changepacks-linux-x64',
  )
  expect(writeFileMock).toHaveBeenCalledWith(
    resolve('changepacks'),
    Buffer.from('BINARYDATA'),
  )
  expect(setFailedMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
  mock.module('@actions/http-client', () => originalHttp)
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
  const infoMock = mock()
  const setFailedMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    setFailed: setFailedMock,
  }))

  const pullsGetLatestReleaseMock = mock(async () => ({ data: { assets: [] } }))
  const octokit = {
    rest: { repos: { getLatestRelease: pullsGetLatestReleaseMock } },
  }
  const getOctokitMock = mock((_token: string) => octokit)
  mock.module('@actions/github', () => ({ getOctokit: getOctokitMock }))

  const { installChangepacks } = await import('../install-changepacks')
  await installChangepacks()

  expect(setFailedMock).toHaveBeenCalledWith('changepacks binary not found')
  expect(writeFileMock).not.toHaveBeenCalled()

  // restore
  mock.module('node:fs/promises', () => originalFs)
  mock.module('node:os', () => originalOs)
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
