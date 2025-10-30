import { debug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { checkChangepacks } from './check-changepacks'
import type { ChangepackResultMap } from './types'

// check past commit and rollback, then `changepacks check --format json` if result is not empty, set changepacks of output to publish
export async function checkPastChangepacks(): Promise<ChangepackResultMap> {
  try {
    let changedFiles: string[] = []
    let diffOutput = ''

    try {
      await exec(
        'git',
        ['diff', 'HEAD~1', 'HEAD', '--name-only', '--', '.changepacks/'],
        {
          listeners: {
            stdout: (data: Buffer) => {
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
      const message = (error as Error)?.message ?? String(error)
      if (
        /bad revision|unknown revision|ambiguous argument|bad object/i.test(
          message,
        )
      ) {
        // No previous commit (e.g., shallow clone or first commit)
        debug(`skip past changepacks: ${message}`)
        return {}
      }
      setFailed(error as Error)
      return {}
    }

    if (changedFiles.length > 0) {
      // rollback to past commit only .changepacks folder
      await exec('git', ['checkout', 'HEAD~1', '--', '.changepacks/'])
      const changepacks = await checkChangepacks()
      await exec('git', ['checkout', 'HEAD', '--', '.changepacks/'])
      return changepacks
    }
    return {}
  } catch (error: unknown) {
    setFailed(error as Error)
    return {}
  }
}
