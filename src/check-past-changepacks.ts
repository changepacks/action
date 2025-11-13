import { debug, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { installChangepacks } from './install-changepacks'
import { runChangepacks } from './run-changepacks'
import type { ChangepackResultMap } from './types'

// check past commit and rollback, then `changepacks check --format json` if result is not empty, set changepacks of output to publish
export async function checkPastChangepacks(): Promise<ChangepackResultMap> {
  try {
    let changedFiles: string[] = []
    let diffOutput = ''
    let pastSha: string | null = null

    const octokit = getOctokit(getInput('token'))

    try {
      const { data: pulls } = await octokit.rest.pulls.list({
        owner: context.repo.owner,
        repo: context.repo.repo,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 30,
      })

      const updateVersionsPr = pulls.find(
        (pr) => pr.title === 'Update Versions' && pr.merged_at !== null,
      )

      if (updateVersionsPr) {
        pastSha = updateVersionsPr.merge_commit_sha
          ? `${updateVersionsPr.merge_commit_sha}~1`
          : updateVersionsPr.head.sha
        debug(
          `Found closed Update Versions PR #${updateVersionsPr.number}, SHA: ${pastSha}`,
        )
      } else {
        debug('No closed Update Versions PR found, using HEAD~1')
      }
    } catch (error: unknown) {
      debug(`Failed to fetch closed PRs: ${error}`)
    }

    try {
      if (pastSha) {
        // Fetch specific SHA if we have one
        await exec('git', ['fetch', 'origin', pastSha], {
          silent: !isDebug(),
        })
      } else {
        // Otherwise, deepen the shallow clone
        await exec('git', ['fetch', '--deepen=1'], {
          silent: !isDebug(),
        })
      }
    } catch (error: unknown) {
      debug(`Failed to fetch: ${error}`)
      // Continue anyway, the diff might still work
    }

    const compareSha = pastSha || 'HEAD~1'

    try {
      await exec(
        'git',
        ['diff', compareSha, 'HEAD', '--name-only', '--', '.changepacks/'],
        {
          silent: !isDebug(),
          listeners: {
            stdout: (data: Buffer) => {
              diffOutput += data.toString()
            },
            stderr: (data: Buffer) => {
              diffOutput += data.toString()
            },
          },
        },
      )

      if (diffOutput.trim()) {
        changedFiles = diffOutput
          .trim()
          .split('\n')
          .filter((file: string) => file.trim())
      }
    } catch (error: unknown) {
      if (
        /bad revision|unknown revision|ambiguous argument|bad object/i.test(
          diffOutput,
        )
      ) {
        // No previous commit (e.g., shallow clone or first commit)
        debug(`skip past changepacks: ${diffOutput}`)
        return {}
      }
      setFailed(error as Error)
      return {}
    }

    if (changedFiles.length > 0) {
      // rollback to past commit only .changepacks folder
      await exec('git', ['checkout', compareSha], {
        silent: !isDebug(),
      })
      await installChangepacks()
      const changepacks = await runChangepacks('check')
      await exec('git', ['checkout', 'HEAD'], {
        silent: !isDebug(),
      })
      return changepacks
    }
    return {}
  } catch (error: unknown) {
    setFailed(error as Error)
    return {}
  }
}
