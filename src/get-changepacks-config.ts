import { resolve } from 'node:path'
import { debug, isDebug } from '@actions/core'
import { exec } from '@actions/exec'
import type { ChangepackConfig } from './types'

/**
 * Get the changepacks config
 * @returns {ChangepackConfig} the changepacks config
 */
export async function getChangepacksConfig(): Promise<ChangepackConfig> {
  let output = ''
  debug(`getting changepacks config`)
  const bin = resolve(
    process.platform === 'win32' ? 'changepacks.exe' : 'changepacks',
  )
  debug(`changepacks path: ${bin}`)
  await exec(bin, ['config'], {
    listeners: {
      stdout: (data) => {
        output += data.toString()
      },
      stderr: (data) => {
        output += data.toString()
      },
    },
    silent: !isDebug(),
  })
  debug(`changepacks output: ${output}`)
  return JSON.parse(output)
}
