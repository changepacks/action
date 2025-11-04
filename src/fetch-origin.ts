import { isDebug } from '@actions/core'
import { exec } from '@actions/exec'

export async function fetchOrigin(branch: string) {
  await exec('git', ['fetch', 'origin', branch], {
    silent: !isDebug(),
  })
}
