import { chmod, writeFile } from 'node:fs/promises'
import { machine, type } from 'node:os'
import { resolve } from 'node:path'
import { debug, getInput, info, setFailed, warning } from '@actions/core'
import { getOctokit } from '@actions/github'
import { HttpClient } from '@actions/http-client'

const CHANGEPACKS_REPO = { owner: 'changepacks', repo: 'changepacks' } as const
// Latest release plus older releases of the same package we fall back to.
const MAX_FALLBACK_DEPTH = 10
const RELEASE_PAGE_SIZE = 100
// changepacks is a monorepo, so one version bump publishes a release per
// package; scan enough pages to reach MAX_FALLBACK_DEPTH binary releases.
const MAX_RELEASE_PAGES = 3

interface ReleaseAsset {
  readonly name: string
  readonly browser_download_url: string
}

interface Release {
  readonly tag_name: string
  readonly assets: readonly ReleaseAsset[]
}

interface ResolvedAsset {
  readonly release: Release
  readonly asset: ReleaseAsset
}

// Tags are `{name}({path})@{version}`, so everything before the last `@`
// identifies the package that ships the binary.
function packageOf(tagName: string) {
  const separator = tagName.lastIndexOf('@')
  return separator === -1 ? tagName : tagName.slice(0, separator)
}

// A release whose asset upload failed carries no binary, so walk back through
// older releases of the same package instead of failing the whole run.
async function resolveAsset(
  octokit: ReturnType<typeof getOctokit>,
  assetName: string,
): Promise<ResolvedAsset | null> {
  const attempted = new Set<string>()
  const attempt = (release: Release) => {
    const asset = release.assets.find((candidate) =>
      candidate.name.endsWith(assetName),
    )
    if (asset) {
      return asset
    }
    attempted.add(release.tag_name)
    warning(
      `changepacks release ${release.tag_name} has no ${assetName} asset (${attempted.size}/${MAX_FALLBACK_DEPTH}), falling back to an older release`,
    )
    return null
  }

  const { data: latest } =
    await octokit.rest.repos.getLatestRelease(CHANGEPACKS_REPO)
  const latestAsset = attempt(latest)
  if (latestAsset) {
    return { release: latest, asset: latestAsset }
  }
  const packageName = packageOf(latest.tag_name)

  for (let page = 1; page <= MAX_RELEASE_PAGES; page++) {
    const { data: releases } = await octokit.rest.repos.listReleases({
      ...CHANGEPACKS_REPO,
      per_page: RELEASE_PAGE_SIZE,
      page,
    })
    for (const release of releases) {
      if (attempted.size >= MAX_FALLBACK_DEPTH) {
        return null
      }
      if (packageOf(release.tag_name) !== packageName) {
        continue
      }
      if (release.draft || release.prerelease) {
        continue
      }
      if (attempted.has(release.tag_name)) {
        continue
      }
      const asset = attempt(release)
      if (asset) {
        return { release, asset }
      }
    }
    if (releases.length < RELEASE_PAGE_SIZE) {
      break
    }
  }
  return null
}

// Download changepacks binary to the cache directory
export async function installChangepacks() {
  // Download changepacks binary by github release
  const token = getInput('token')
  const octokit = getOctokit(token)
  const os = (
    {
      Linux: 'linux',
      Darwin: 'darwin',
      Windows_NT: 'windows',
    } as const
  )[type()]
  const ma = machine()
  debug(`os: ${os}, arch: ${ma}`)
  const assetName = `changepacks-${os}-${ma}${os === 'windows' ? '.exe' : ''}`
  const resolved = await resolveAsset(octokit, assetName)
  if (!resolved) {
    setFailed('changepacks binary not found')
    return
  }
  const { release, asset } = resolved
  debug(`downloading asset: ${asset.name}`)
  const assetUrl = asset.browser_download_url
  const client = new HttpClient()
  const binResponse = await client.get(assetUrl)
  const binary = Buffer.from((await binResponse.readBodyBuffer?.()) ?? '')
  const binPath = resolve(`changepacks${os === 'windows' ? '.exe' : ''}`)
  await writeFile(binPath, binary)
  if (os !== 'windows') {
    await chmod(binPath, 0o755)
  }
  debug(`wrote binary to ${binPath}: ${binary.length} bytes`)
  info(`changepacks version: ${release.tag_name}`)
}
