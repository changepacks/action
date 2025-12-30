import { endGroup, getInput, info, startGroup, warning } from '@actions/core'
import { context } from '@actions/github'
import type { ChangepackResultMap } from './types'

export async function sendSlackNotification(
  changepacks: ChangepackResultMap,
): Promise<void> {
  const webhookUrl = getInput('slack_webhook_url')
  if (!webhookUrl) {
    info('slack_webhook_url is not set, skipping Slack notification')
    return
  }

  startGroup('sendSlackNotification')

  const releases = Object.entries(changepacks).filter(
    ([_, changepack]) => !!changepack.nextVersion,
  )

  if (releases.length === 0) {
    info('No releases to notify')
    endGroup()
    return
  }

  const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`

  const releaseBlocks = releases.map(([_, changepack]) => {
    const tagName = `${changepack.name}(${changepack.path})@${changepack.nextVersion}`
    const releaseUrl = `${repoUrl}/releases/tag/${encodeURIComponent(tagName)}`
    const logs = changepack.logs
      .map((log) => `• [${log.type}] ${log.note}`)
      .join('\n')

    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${releaseUrl}|${tagName}>*\n${logs || '_No changelog_'}`,
      },
    }
  })

  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `New Release - ${context.repo.repo}`,
          emoji: true,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Repository: <${repoUrl}|${context.repo.owner}/${context.repo.repo}>`,
          },
        ],
      },
      { type: 'divider' },
      ...releaseBlocks,
    ],
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      warning(
        `Slack notification failed: ${response.status} ${response.statusText}`,
      )
    } else {
      info('Slack notification sent successfully')
    }
  } catch (err) {
    warning(`Slack notification failed: ${err}`)
  } finally {
    endGroup()
  }
}
