import { expect, mock, test } from 'bun:test'

test('fetchOrigin executes git fetch with correct arguments', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({ isDebug: isDebugMock }))

  const { fetchOrigin } = await import('../fetch-origin')
  await fetchOrigin('main')

  expect(execMock).toHaveBeenCalledWith('git', ['fetch', 'origin', 'main'], {
    silent: true,
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('fetchOrigin executes git fetch with silent false when debug mode', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const isDebugMock = mock(() => true)
  mock.module('@actions/core', () => ({ isDebug: isDebugMock }))

  const { fetchOrigin } = await import('../fetch-origin')
  await fetchOrigin('develop')

  expect(execMock).toHaveBeenCalledWith('git', ['fetch', 'origin', 'develop'], {
    silent: false,
  })

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})

test('fetchOrigin executes git fetch with different branch names', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const originalCore = { ...(await import('@actions/core')) }

  const execMock = mock(async () => 0)
  mock.module('@actions/exec', () => ({ exec: execMock }))

  const isDebugMock = mock(() => false)
  mock.module('@actions/core', () => ({ isDebug: isDebugMock }))

  const { fetchOrigin } = await import('../fetch-origin')
  await fetchOrigin('feature/new-feature')

  expect(execMock).toHaveBeenCalledWith(
    'git',
    ['fetch', 'origin', 'feature/new-feature'],
    {
      silent: true,
    },
  )

  mock.module('@actions/exec', () => originalExec)
  mock.module('@actions/core', () => originalCore)
})
