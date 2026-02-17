import { resolve } from 'node:path'
import { debug, getInput, isDebug } from '@actions/core'
import { exec } from '@actions/exec'
import type { ChangepackPublishResult, ChangepackResultMap } from './types'

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
  command: 'publish',
  ...args: string[]
): Promise<Record<string, ChangepackPublishResult>>
export async function runChangepacks(
  command: 'check' | 'update',
  ...args: string[]
): Promise<ChangepackResultMap>
export async function runChangepacks(
  command: 'check' | 'update' | 'publish',
  ...args: string[]
): Promise<ChangepackResultMap | Record<string, ChangepackPublishResult>> {
  let output = ''
  debug(`running changepacks ${command}`)
  const bin = resolve(
    process.platform === 'win32' ? 'changepacks.exe' : 'changepacks',
  )
  debug(`changepacks path: ${bin}`)
  const language = getInput('language')
  const languageArgs = language ? ['-l', language] : []
  await exec(
    bin,
    command === 'publish'
      ? ['publish', '-y', '--format', 'json', ...languageArgs, ...args]
      : [
          command,
          '--format',
          'json',
          ...(command === 'update' ? ['-y'] : ['--remote']),
          ...languageArgs,
          ...args,
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
