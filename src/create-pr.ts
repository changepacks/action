import { debug, error, getInput, isDebug, setFailed } from '@actions/core'
import { exec } from '@actions/exec'
import { context, getOctokit } from '@actions/github'
import { createBody } from './create-body'
import { runChangepacks } from './run-changepacks'

export async function createPr() {
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

    if (branchExists) {
      debug(`checking out existing branch: ${head}`)
      await exec('git', ['fetch', 'origin', head], {
        silent: !isDebug(),
      })
      await exec('git', ['checkout', head], {
        silent: !isDebug(),
      })
      debug(`merging ${base} into ${head}`)
      await exec('git', ['merge', `origin/${base}`, '--no-edit'], {
        silent: !isDebug(),
      })
    } else {
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
      await exec('git', ['fetch', 'origin', head], {
        silent: !isDebug(),
      })
      await exec('git', ['checkout', '-b', head, `origin/${head}`], {
        silent: !isDebug(),
      })
    }

    debug(`update changepacks`)
    const changepacks = await runChangepacks('update')

    // if not changed, return
    if (
      Object.values(changepacks).every((changepack) => !changepack.nextVersion)
    ) {
      debug(`no changepacks, skip`)
      return
    }

    debug(`add changepacks`)
    await exec('git', ['add', '.changepacks'], {
      silent: !isDebug(),
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
    await exec('git', ['push', 'origin', head], {
      silent: !isDebug(),
    })

    const { data: pulls } = await octokit.rest.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      head: `${context.repo.owner}:${head}`,
      base,
      state: 'open',
    })

    const bodyText = Object.values(changepacks).map(createBody).join('\n')

    if (pulls.length > 0) {
      const prNumber = pulls[0].number
      debug(`PR #${prNumber} exists, updating comment`)
      const comments = await octokit.rest.issues.listComments({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: prNumber,
        per_page: 100,
      })
      const existingComment = comments.data.find(
        (c) =>
          c.user?.login === 'github-actions[bot]' &&
          c.body?.startsWith('# Changepacks'),
      )
      if (existingComment) {
        await octokit.rest.issues.updateComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          comment_id: existingComment.id,
          body: `# Changepacks\n${bodyText}`,
        })
        debug(`updated comment on PR #${prNumber}`)
      } else {
        await octokit.rest.issues.createComment({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: prNumber,
          body: `# Changepacks\n${bodyText}`,
        })
        debug(`created comment on PR #${prNumber}`)
      }
    } else {
      debug(`creating new PR`)
      await octokit.rest.pulls.create({
        owner: context.repo.owner,
        repo: context.repo.repo,
        title: 'Update Versions',
        body: bodyText,
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
