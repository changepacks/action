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
