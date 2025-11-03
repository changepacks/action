import { debug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { runChangepacks } from './run-changepacks'
import type { ChangepackResultMap } from './types'

// check past commit and rollback, then `changepacks check --format json` if result is not empty, set changepacks of output to publish
export async function checkPastChangepacks(): Promise<ChangepackResultMap> {
  try {
    let changedFiles: string[] = []
    let diffOutput = ''
    let prevCommitHash = ''

    try {
      const isShallowOutput: string[] = []
      try {
        await exec('git', ['rev-parse', '--is-shallow-repository'], {
          listeners: {
            stdout: (data: Buffer) => {
              isShallowOutput.push(data.toString())
            },
          },
          silent: true,
        })
      } catch {}

      const isShallow = isShallowOutput.join('').trim().toLowerCase() === 'true'

      if (isShallow) {
        debug('Shallow clone detected, fetching previous commit')
        try {
          await exec('git', ['fetch', '--deepen=1'], {
            silent: true,
          })
        } catch (fetchError) {
          debug(`Failed to fetch additional commits: ${fetchError as Error}`)
        }
      }

      const logOutput: string[] = []
      await exec('git', ['log', '--format=%H', '-n', '2'], {
        listeners: {
          stdout: (data: Buffer) => {
            logOutput.push(data.toString())
          },
        },
        silent: true,
      })
      const commits = logOutput.join('').trim().split('\n').filter(Boolean)
      debug(`commits: ${commits.join(', ')}`)

      if (commits.length >= 2 && commits[1]) {
        const hash = commits[1].trim()
        prevCommitHash = hash || ''
      } else {
        debug('No previous commit found (shallow clone or first commit)')
        return {}
      }
    } catch (error: unknown) {
      setFailed(error as Error)
      return {}
    }

    try {
      await exec(
        'git',
        ['diff', prevCommitHash, 'HEAD', '--name-only', '--', '.changepacks/'],
        {
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
      await exec('git', ['checkout', prevCommitHash, '--', '.changepacks/'])
      const changepacks = await runChangepacks('check')
      await exec('git', ['checkout', 'HEAD', '--', '.changepacks/'])
      return changepacks
    }
    return {}
  } catch (error: unknown) {
    setFailed(error as Error)
    return {}
  }
}
