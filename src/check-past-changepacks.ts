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
        const originalSha =
          updateVersionsPr.merge_commit_sha || updateVersionsPr.head.sha
        pastSha = updateVersionsPr.merge_commit_sha
          ? `${updateVersionsPr.merge_commit_sha}~1`
          : updateVersionsPr.head.sha
        debug(
          `Found closed Update Versions PR #${updateVersionsPr.number}, SHA: ${pastSha}`,
        )

        try {
          // Fetch original SHA first (can't fetch SHA with ~1 modifier)
          await exec('git', ['fetch', '--deepen=1', 'origin', originalSha], {
            silent: !isDebug(),
          })
        } catch (error: unknown) {
          debug(`Failed to fetch original SHA: ${error}`)
          // Continue anyway, the diff might still work
        }
      } else {
        debug('No closed Update Versions PR found, using HEAD~1')
      }
    } catch (error: unknown) {
      debug(`Failed to fetch closed PRs: ${error}`)
    }

    if (!pastSha) {
      try {
        // Otherwise, deepen the shallow clone
        await exec('git', ['fetch', '--deepen=1'], {
          silent: !isDebug(),
        })
      } catch (error: unknown) {
        debug(`Failed to fetch: ${error}`)
        // Continue anyway, the diff might still work
      }
    } else {
      let commitCountOutput = ''
      await exec('git', ['rev-list', '--count', 'HEAD', pastSha], {
        silent: !isDebug(),
        listeners: {
          stdout: (data: Buffer) => {
            commitCountOutput += data.toString()
          },
        },
      })
      if (parseInt(commitCountOutput, 10) > 3) {
        return {}
      }
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
      // Save original branch/ref before checking out past commit
      const originalRef = context.ref
      const originalBranch = originalRef.replace(/^refs\/heads\//, '') || 'main'

      // rollback to past commit only .changepacks folder
      await exec('git', ['checkout', compareSha], {
        silent: !isDebug(),
      })
      await installChangepacks()
      const changepacks = await runChangepacks('check')
      // Checkout back to original branch to fix detached HEAD
      await exec('git', ['checkout', originalBranch], {
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
