import { writeFile } from 'node:fs/promises'
import { machine, type } from 'node:os'
import { getInput, info, setFailed } from '@actions/core'
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
  const os = {
    Linux: 'linux',
    Darwin: 'darwin',
    Windows_NT: 'windows',
  }[type()]
  const ma = machine()
  info(`os: ${os}, arch: ${ma}`)
  const asset = release.assets.find((asset) =>
    asset.name.endsWith(`changepacks-${os}-${ma}.tar.gz`),
  )
  if (!asset) {
    setFailed('changepacks binary not found')
    return
  }
  const assetUrl = asset.browser_download_url
  const client = new HttpClient()
  const binResponse = await client.get(assetUrl)
  console.log('binResponse', binResponse.readBodyBuffer)
  await writeFile(
    `changepacks${os === 'win32' ? '.exe' : ''}`,
    Buffer.from((await binResponse.readBodyBuffer?.()) ?? ''),
  )
}
