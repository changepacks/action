import { isDebug } from '@actions/core'
import { exec } from '@actions/exec'

export async function fetchOrigin(branch: string) {
  await exec(
    'git',
    ['fetch', 'origin', `refs/heads/${branch}:refs/remotes/origin/${branch}`],
    {
      silent: !isDebug(),
    },
  )
}
