import { chmod, writeFile } from 'node:fs/promises'
import { machine, type } from 'node:os'
import { resolve } from 'node:path'
import { debug, getInput, info, setFailed } from '@actions/core'
import { getOctokit } from '@actions/github'
import { HttpClient } from '@actions/http-client'

// Download changepacks binary to the cache directory
export async function installChangepacks() {
  // Download changepacks binary by github release
  const token = getInput('token')
  const octokit = getOctokit(token)
  const response = await octokit.rest.repos.getLatestRelease({
    owner: 'changepacks',
    repo: 'changepacks',
  })
  const release = response.data
  const os = (
    {
      Linux: 'linux',
      Darwin: 'darwin',
      Windows_NT: 'windows',
    } as const
  )[type()]
  const ma = machine()
  debug(`os: ${os}, arch: ${ma}`)
  const asset = release.assets.find((asset) =>
    asset.name.endsWith(
      `changepacks-${os}-${ma}${os === 'windows' ? '.exe' : ''}`,
    ),
  )
  info(`downloading asset: ${asset?.name}`)
  if (!asset) {
    setFailed('changepacks binary not found')
    return
  }
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
}
