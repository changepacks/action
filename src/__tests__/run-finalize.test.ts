import { expect, mock, test } from 'bun:test'

test('run finalizes provided release receipts without running changepacks', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalExec = { ...(await import('@actions/exec')) }
  const originalFinalize = { ...(await import('../finalize-releases')) }
  const originalInstall = { ...(await import('../install-changepacks')) }

  const input = JSON.stringify({
    'packages/a/package.json': {
      releaseId: 10,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
    },
  })
  const receipt = {
    'packages/a/package.json': {
      releaseId: 10,
      tagName: 'a(packages/a/package.json)@1.1.0',
      makeLatest: true,
    },
  }
  const parseMock = mock(() => receipt)
  const finalizeMock = mock(async () => ['packages/a/package.json'])
  const installMock = mock()
  const setOutputMock = mock()
  const execMock = mock(async () => 0)

  mock.module('@actions/core', () => ({
    getInput: mock((name: string) =>
      name === 'finalize_releases' ? input : '',
    ),
    isDebug: mock(() => false),
    setOutput: setOutputMock,
  }))
  mock.module('@actions/exec', () => ({ exec: execMock }))
  mock.module('../finalize-releases', () => ({
    finalizeReleases: finalizeMock,
    parseFinalizeReleasesInput: parseMock,
  }))
  mock.module('../install-changepacks', () => ({
    installChangepacks: installMock,
  }))

  const { run } = await import('../run')
  await run()

  expect(parseMock).toHaveBeenCalledWith(input)
  expect(finalizeMock).toHaveBeenCalledWith(receipt)
  expect(setOutputMock).toHaveBeenCalledWith('changepacks', [
    'packages/a/package.json',
  ])
  expect(installMock).not.toHaveBeenCalled()
  expect(execMock).not.toHaveBeenCalled()

  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/exec', () => originalExec)
  mock.module('../finalize-releases', () => originalFinalize)
  mock.module('../install-changepacks', () => originalInstall)
})
