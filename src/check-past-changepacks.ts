import { debug, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { installChangepacks } from './install-changepacks'
import { runChangepacks } from './run-changepacks'
import type { ChangepackResultMap } from './types'

export interface ReleaseIntent {
  readonly changepacks: ChangepackResultMap
  readonly sourceSha: string
}

interface IncludeSourceOptions {
  readonly includeSource: true
}

// check past commit and rollback, then `changepacks check --format json` if result is not empty, set changepacks of output to publish
export function checkPastChangepacks(
  options: IncludeSourceOptions,
): Promise<ReleaseIntent | null>
export function checkPastChangepacks(): Promise<ChangepackResultMap>
export async function checkPastChangepacks(
  options?: IncludeSourceOptions,
): Promise<ChangepackResultMap | ReleaseIntent | null> {
  const emptyResult = options?.includeSource ? null : {}
  const originalBranch = context.ref?.replace(/^refs\/heads\//, '') || 'main'
  let compareSha = 'HEAD~1'
  let sourceSha = context.sha || 'HEAD'
  let foundUpdateVersionsPr = false

  try {
    const octokit = getOctokit(getInput('token'))
    const { data: pulls } = await octokit.rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    })
    const updateVersionsPr = pulls.find(
      (pr) =>
        pr.title === 'Update Versions' &&
        pr.merged_at !== null &&
        pr.base.ref === originalBranch,
    )

    if (updateVersionsPr) {
      foundUpdateVersionsPr = true
      compareSha = updateVersionsPr.base.sha
      sourceSha = updateVersionsPr.merge_commit_sha ?? updateVersionsPr.head.sha
      debug(
        `Found closed Update Versions PR #${updateVersionsPr.number}, SHA: ${compareSha}`,
      )
    } else {
      debug('No closed Update Versions PR found, using HEAD~1')
    }
  } catch (error: unknown) {
    debug(`Failed to fetch closed PRs: ${error}`)
  }

  try {
    if (foundUpdateVersionsPr) {
      for (const sha of new Set([compareSha, sourceSha])) {
        await exec('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], {
          silent: !isDebug(),
        })
      }
    } else {
      await exec('git', ['fetch', '--deepen=1'], {
        silent: !isDebug(),
      })
    }
  } catch (error: unknown) {
    debug(`Failed to fetch Update Versions base SHA: ${error}`)
    setFailed(error instanceof Error ? error : String(error))
    return emptyResult
  }

  let diffOutput = ''
  let diffError = ''
  try {
    await exec(
      'git',
      ['diff', compareSha, sourceSha, '--name-only', '--', '.changepacks/'],
      {
        silent: !isDebug(),
        listeners: {
          stdout: (data: Buffer) => {
            diffOutput += data.toString()
          },
          stderr: (data: Buffer) => {
            diffError += data.toString()
          },
        },
      },
    )
  } catch (error: unknown) {
    if (
      !foundUpdateVersionsPr &&
      /bad revision|unknown revision|ambiguous argument|bad object/i.test(
        diffError || diffOutput,
      )
    ) {
      debug(`skip past changepacks: ${diffError || diffOutput}`)
      return emptyResult
    }
    setFailed(error instanceof Error ? error : String(error))
    return emptyResult
  }

  if (!diffOutput.trim()) {
    return emptyResult
  }

  try {
    await exec('git', ['checkout', compareSha], {
      silent: !isDebug(),
    })
    await installChangepacks()
    const changepacks = await runChangepacks('check')
    return options?.includeSource ? { changepacks, sourceSha } : changepacks
  } catch (error: unknown) {
    setFailed(error instanceof Error ? error : String(error))
    return emptyResult
  } finally {
    await exec('git', ['checkout', originalBranch], {
      silent: !isDebug(),
    })
  }
}
