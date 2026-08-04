import { resolve } from 'node:path'
import { debug, getInput, isDebug, warning } from '@actions/core'
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
  let stdout = ''
  let stderr = ''
  debug(`running changepacks ${command}`)
  const bin = resolve(
    process.platform === 'win32' ? 'changepacks.exe' : 'changepacks',
  )
  debug(`changepacks path: ${bin}`)
  const language = getInput('language')
  const languageArgs = language ? ['-l', language] : []
  try {
    await exec(
      bin,
      command === 'publish'
        ? ['publish', '-y', '--format', 'json', ...languageArgs, ...args]
        : [
            command,
            '--format',
            'json',
            ...(command === 'update' ? ['-y'] : []),
            ...languageArgs,
            ...args,
          ],
      {
        listeners: {
          stdout: (data) => {
            const s = data.toString()
            debug(`stdout: ${s}`)
            stdout += s
          },
          stderr: (data) => {
            const s = data.toString()
            debug(`stderr: ${s}`)
            stderr += s
          },
        },
        silent: !isDebug(),
      },
    )
  } catch (err: unknown) {
    if (command !== 'publish' || !stdout) {
      // A fatal CLI failure is reported as plain text on stderr with no JSON on
      // stdout, so surface that text instead of a bare "exit code 1".
      const detail = stderr.trim() || stdout.trim()
      throw detail
        ? new Error(`changepacks ${command} failed: ${detail}`, { cause: err })
        : err
    }
    // Publish may exit non-zero for partial failures while still emitting
    // per-package JSON on stdout. Preserve stderr for debug visibility so
    // we never feed human-readable error text into JSON.parse.
    warning(`changepacks publish exited with error: ${err}`)
    if (stderr) {
      warning(`changepacks stderr: ${stderr}`)
    }
  }
  debug(`changepacks stdout: ${stdout}`)
  if (stderr) {
    debug(`changepacks stderr: ${stderr}`)
  }
  return JSON.parse(stdout)
}
