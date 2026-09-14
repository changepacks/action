import { expect, mock, test } from 'bun:test'

test('should call run() when imported', async () => {
  const originalModule = { ...(await import('../run')) }
  const mockRun = mock(() => {})
  mock.module('../run', () => ({
    run: mockRun,
  }))
  await import('../index')

  expect(mockRun).toHaveBeenCalled()

  mock.module('../run', () => originalModule)
})

test('reports rejected run errors through setFailed', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalRun = { ...(await import('../run')) }
  const setFailedMock = mock()
  const error = Object.assign(new Error('Not found'), { status: 404 })

  mock.module('@actions/core', () => ({
    ...originalCore,
    setFailed: setFailedMock,
  }))
  mock.module('../run', () => ({
    run: mock(() => Promise.reject(error)),
  }))
  const indexPath = '../index?rejection'
  await import(indexPath)
  await new Promise(setImmediate)

  expect(setFailedMock).toHaveBeenCalledWith('Not found (HTTP 404)')

  mock.module('@actions/core', () => originalCore)
  mock.module('../run', () => originalRun)
})
