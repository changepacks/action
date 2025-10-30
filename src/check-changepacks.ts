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
export async function checkChangepacks(): Promise<ChangepackResultMap> {
  let output = ''
  await exec('./changepacks', ['check', '--format', 'json'], {
    listeners: {
      stdout: (data) => {
        output += data.toString()
      },
    },
  })
  return JSON.parse(output)
}
