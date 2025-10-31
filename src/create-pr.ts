import { debug, error, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export async function createPr(changepacks: ChangepackResultMap) {
  const base = context.ref.replace(/^refs\/heads\//, '')
  const head = `changepacks/${base}`

  const octokit = getOctokit(getInput('token'))

  try {
    // Try to delete existing head branch if it exists
    debug(`attempting to delete branch: ${head}`)
    try {
      await octokit.rest.git.deleteRef({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: `refs/heads/${head}`,
      })
      debug(`deleted existing branch: ${head}`)
    } catch {
      debug(`branch ${head} does not exist or already deleted`)
    }
    debug(`get base branch: ${base}`)
    const { data } = await octokit.rest.repos.getBranch({
      repo: context.repo.repo,
      owner: context.repo.owner,
      branch: base,
    })
    debug(`base branch commit: ${data.commit.sha}`)
    await octokit.rest.git.createRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `refs/heads/${head}`,
      sha: data.commit.sha,
    })
    debug(`create branch: ${head}`)
    await exec('git', ['checkout', '-b', head], {
      silent: !isDebug(),
    })

    debug(`update changepacks`)
    await exec('./changepacks', ['update', '--format', 'json', '-y'], {
      silent: !isDebug(),
    })
    debug(`add changepacks`)
    // switch to head branch
    await exec('git', ['add', '.'], {
      silent: !isDebug(),
    })
    debug(`commit changepacks`)
    await exec('git', ['commit', '-m', 'Update Versions'], {
      silent: !isDebug(),
    })
    debug(`push branch: ${head}`)
    await exec('git', ['push', 'origin', head], {
      silent: !isDebug(),
    })

    const body = {
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: 'Update Versions',
      body: Object.values(changepacks).map(createBody).join('\n'),
      head,
      base,
    }
    debug(`create pr: ${JSON.stringify(body)}`)
    await octokit.rest.pulls.create(body)
  } catch (err: unknown) {
    error('create pr failed')
    setFailed(err as Error)
  }
}
