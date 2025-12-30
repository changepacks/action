import { afterAll, expect, mock, test } from 'bun:test'
import type { ChangepackResultMap } from '../types'

afterAll(() => {
  process.exitCode = 0
})

test('sendSlackNotification skips when slack_webhook_url is not set', async () => {
  const originalCore = { ...(await import('@actions/core')) }

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? '' : '',
  )
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(getInputMock).toHaveBeenCalledWith('slack_webhook_url')
  expect(infoMock).toHaveBeenCalledWith(
    'slack_webhook_url is not set, skipping Slack notification',
  )

  mock.module('@actions/core', () => originalCore)
})

test('sendSlackNotification skips when no releases to notify', async () => {
  const originalCore = { ...(await import('@actions/core')) }

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: null,
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(infoMock).toHaveBeenCalledWith('No releases to notify')

  mock.module('@actions/core', () => originalCore)
})

test('sendSlackNotification sends notification successfully', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalFetch = globalThis.fetch

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
  }))

  const fetchMock = mock(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
  }))
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(fetchMock).toHaveBeenCalledWith('https://hooks.slack.com/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: expect.stringContaining('a(packages/a/package.json)@1.1.0'),
  })
  expect(infoMock).toHaveBeenCalledWith('Slack notification sent successfully')

  globalThis.fetch = originalFetch
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('sendSlackNotification warns on fetch failure', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalFetch = globalThis.fetch

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    warning: warningMock,
  }))

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
  }))

  const fetchMock = mock(async () => ({
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
  }))
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(warningMock).toHaveBeenCalledWith(
    'Slack notification failed: 500 Internal Server Error',
  )

  globalThis.fetch = originalFetch
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('sendSlackNotification warns on fetch exception', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalFetch = globalThis.fetch

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  const warningMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
    warning: warningMock,
  }))

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
  }))

  const fetchMock = mock(async () => {
    throw new Error('Network error')
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(warningMock).toHaveBeenCalledWith(
    expect.stringContaining('Slack notification failed:'),
  )

  globalThis.fetch = originalFetch
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('sendSlackNotification sends notification with multiple releases', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalFetch = globalThis.fetch

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
  }))

  let capturedBody = ''
  const fetchMock = mock(async (_url: string, options: { body: string }) => {
    capturedBody = options.body
    return { ok: true, status: 200, statusText: 'OK' }
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [{ type: 'Minor', note: 'feat A' }],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
    'packages/b/package.json': {
      logs: [{ type: 'Patch', note: 'fix B' }],
      version: '2.0.0',
      nextVersion: '2.0.1',
      name: 'b',
      path: 'packages/b/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(capturedBody).toContain('a(packages/a/package.json)@1.1.0')
  expect(capturedBody).toContain('b(packages/b/package.json)@2.0.1')
  expect(capturedBody).toContain('feat A')
  expect(capturedBody).toContain('fix B')
  expect(infoMock).toHaveBeenCalledWith('Slack notification sent successfully')

  globalThis.fetch = originalFetch
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})

test('sendSlackNotification handles empty logs', async () => {
  const originalCore = { ...(await import('@actions/core')) }
  const originalGithub = { ...(await import('@actions/github')) }
  const originalFetch = globalThis.fetch

  const getInputMock = mock((name: string) =>
    name === 'slack_webhook_url' ? 'https://hooks.slack.com/test' : '',
  )
  const infoMock = mock()
  mock.module('@actions/core', () => ({
    getInput: getInputMock,
    info: infoMock,
  }))

  const contextMock = {
    repo: { owner: 'acme', repo: 'widgets' },
  }
  mock.module('@actions/github', () => ({
    context: contextMock,
  }))

  let capturedBody = ''
  const fetchMock = mock(async (_url: string, options: { body: string }) => {
    capturedBody = options.body
    return { ok: true, status: 200, statusText: 'OK' }
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch

  const changepacks: ChangepackResultMap = {
    'packages/a/package.json': {
      logs: [],
      version: '1.0.0',
      nextVersion: '1.1.0',
      name: 'a',
      path: 'packages/a/package.json',
      changed: false,
    },
  }

  const { sendSlackNotification } = await import('../send-slack-notification')
  await sendSlackNotification(changepacks)

  expect(capturedBody).toContain('_No changelog_')

  globalThis.fetch = originalFetch
  mock.module('@actions/core', () => originalCore)
  mock.module('@actions/github', () => originalGithub)
})
