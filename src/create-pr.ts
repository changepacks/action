import { debug, error, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createContents } from './create-contents'
import { installChangepacks } from './install-changepacks'
import { runChangepacks } from './run-changepacks'
import type { ChangepackResultMap } from './types'
import { updatePr } from './update-pr'

export async function createPr(mainChangepacks: ChangepackResultMap) {
  const base = context.ref.replace(/^refs\/heads\//, '')
  const head = `changepacks/${base}`

  const octokit = getOctokit(getInput('token'))

  try {
    let branchExists = false
    try {
      await octokit.rest.repos.getBranch({
        repo: context.repo.repo,
        owner: context.repo.owner,
        branch: head,
      })
      branchExists = true
      debug(`branch ${head} exists, will update it`)
    } catch {
      branchExists = false
      debug(`branch ${head} does not exist, will create it`)
    }

    if (!branchExists) {
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
    }

    await exec('git', ['fetch', 'origin', head], {
      silent: !isDebug(),
    })

    debug(`update changepacks`)
    const changepacks = await runChangepacks('update')

    await exec('git', ['reset', '--hard', `origin/${base}`], {
      silent: !isDebug(),
    })

    // if not changed, return
    if (
      Object.values(changepacks).some((changepack) => !!changepack.nextVersion)
    ) {
      await exec('git', ['checkout', '-f', '-b', head, `origin/${head}`], {
        silent: !isDebug(),
      })
      // rollback to base branch
      await exec('git', ['reset', '--hard', `origin/${base}`], {
        silent: !isDebug(),
      })

      await installChangepacks()

      await runChangepacks('update')

      // add all files except changepacks binary
      debug(`add all files except changepacks binary`)
      await exec('git', ['add', '.'], {
        silent: !isDebug(),
      })
      debug(`remove changepacks binary`)
      await exec('git', ['rm', '-f', 'changepacks*'], {
        silent: !isDebug(),
        ignoreReturnCode: true,
      })
      debug(`configure git user`)
      await exec('git', ['config', 'user.name', 'changepacks'], {
        silent: !isDebug(),
      })
      await exec(
        'git',
        ['config', 'user.email', 'changepacks@users.noreply.github.com'],
        {
          silent: !isDebug(),
        },
      )
      debug(`commit changepacks`)
      await exec('git', ['commit', '-m', 'Update Versions'], {
        silent: !isDebug(),
      })
      debug(`push branch: ${head}`)
      await exec('git', ['push', '--force', 'origin', head], {
        silent: !isDebug(),
      })
    }

    const { data: pulls } = await octokit.rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head: `${context.repo.owner}:${head}`,
      base,
      state: 'open',
    })

    if (pulls.length > 0) {
      await updatePr(changepacks, pulls[0].number)
    } else {
      debug(`creating new PR`)

      const body = createContents(mainChangepacks)
      await octokit.rest.pulls.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: 'Update Versions',
        body,
        head,
        base,
      })
      debug(`created PR`)
    }
  } catch (err: unknown) {
    error('create pr failed')
    setFailed(err as Error)
  }
}
