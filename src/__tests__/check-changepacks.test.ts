import { expect, mock, test } from 'bun:test'
import { resolve } from 'node:path'
import type { ChangepackResultMap } from '../types'

test('checkChangepacks parses JSON from exec stdout (chunked)', async () => {
  const originalExecModule = { ...(await import('@actions/exec')) }

  const payload: ChangepackResultMap = {
    'package.json': {
      logs: [
        {
          type: 'PATCH',
          note: 'Update to v1.0.1',
        },
      ],
      version: '1.0.0',
      nextVersion: '1.0.1',
      name: 'My Project',
    },
  }

  const json = JSON.stringify(payload)
  const part1 = json.slice(0, Math.floor(json.length / 2))
  const part2 = json.slice(Math.floor(json.length / 2))

  const execMock = mock(async (_cmd, _args, options) => {
    options?.listeners?.stdout?.(Buffer.from(part1))
    options?.listeners?.stdout?.(Buffer.from(part2))
    return 0
  })

  mock.module('@actions/exec', () => ({ exec: execMock }))

  const { checkChangepacks } = await import('../check-changepacks')
  const result = await checkChangepacks()

  expect(execMock).toHaveBeenCalledWith(
    resolve(process.platform === 'win32' ? 'changepacks.exe' : 'changepacks'),
    ['check', '--format', 'json'],
    expect.any(Object),
  )
  expect(result).toEqual(payload)

  mock.module('@actions/exec', () => originalExecModule)
})

test('checkChangepacks propagates JSON.parse error on invalid stdout', async () => {
  const originalExecModule = { ...(await import('@actions/exec')) }

  const execMock = mock(async (_cmd, _args, options) => {
    options?.listeners?.stdout?.(Buffer.from('{ invalid json'))
    return 0
  })

  mock.module('@actions/exec', () => ({ exec: execMock }))

  const { checkChangepacks } = await import('../check-changepacks')

  await expect(checkChangepacks()).rejects.toThrow(SyntaxError)

  mock.module('@actions/exec', () => originalExecModule)
})
