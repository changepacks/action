import { debug, error, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createPr(changepacks: ChangepackResultMap) {
  const base = context.ref.replace(/^refs\/heads\//, '')
  const head = `changepacks/${base}`

  const octokit = getOctokit(getInput('token'))

  // Get base branch info
  const { data: branches } = await octokit.rest.repos.listBranches({
    repo: context.repo.repo,
    owner: context.repo.owner,
  })
  if (!branches.some((branch) => branch.name === 'dev')) {
    const { data } = await octokit.rest.repos.getBranch({
      repo: context.repo.repo,
      owner: context.repo.owner,
      branch: base,
    })
    await octokit.rest.git.createRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `refs/heads/${head}`,
      sha: data.commit.sha,
    })
  }

  await exec('git', ['checkout', '-b', head])

  await exec(
    './changepacks',
    ['update', '--format', 'json', '-y'],

    {
      silent: !isDebug(),
    },
  )
  // switch to head branch
  await exec('git', ['add', '.'])
  await exec('git', ['commit', '-m', 'Update Versions'])
  await exec('git', ['push', 'origin', head])

  const body = {
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: 'Update Versions',
    body: Object.values(changepacks).map(createBody).join('\n'),
    head,
    base,
  }
  debug(`create pr: ${JSON.stringify(body)}`)
  try {
    await octokit.rest.pulls.create(body)
  } catch (err: unknown) {
    error('create pr failed')
    setFailed(err as Error)
  }
}
