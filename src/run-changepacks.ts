import { resolve } from 'node:path'
import { debug, isDebug } from '@actions/core'
import { exec } from '@actions/exec'
import type { ChangepackResultMap } from './types'

/**
 *
 * @returns {ChangepackResultMap} project paths and update types
 * @example
 * {
 *  "package.json": {
 *    "logs": [
 *      {
 *        "type": "MAJOR",
 *        "note": "Update to v1.0.0"
 *      }
 *    ],
 *    "version": "1.0.0",
 *    "nextVersion": "1.0.1",
 *    "name": "My Project"
 *  }
 * }
 */
export async function runChangepacks(
  command: 'check' | 'update' | 'publish',
): Promise<ChangepackResultMap> {
  let output = ''
  debug(`running changepacks ${command}`)
  const bin = resolve(
    process.platform === 'win32' ? 'changepacks.exe' : 'changepacks',
  )
  debug(`changepacks path: ${bin}`)
  await exec(
    bin,
    command === 'publish'
      ? ['publish', '-y']
      : [
          command,
          '--format',
          'json',
          ...(command === 'update' ? ['-y'] : ['--remote']),
        ],
    {
      listeners: {
        stdout: (data) => {
          output += data.toString()
        },
        stderr: (data) => {
          output += data.toString()
        },
      },
      silent: !isDebug(),
    },
  )
  debug(`changepacks output: ${output}`)
  return JSON.parse(output)
}
