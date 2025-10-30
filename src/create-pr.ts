import { debug, error, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createPr(changepacks: ChangepackResultMap) {
  await exec(
    './changepacks',
    ['update', '--format', 'json', '-y'],

    {
      silent: !isDebug(),
    },
  )

  const octokit = getOctokit(getInput('token'))
  debug(`create pr: ${JSON.stringify(changepacks)}`)
  try {
    await octokit.rest.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: 'Update Versions',
      body: Object.values(changepacks).map(createBody).join('\n'),
      head: 'changepacks',
      base: context.ref,
    })
  } catch (err: unknown) {
    error('create pr failed')
    setFailed(err as Error)
  }
}
