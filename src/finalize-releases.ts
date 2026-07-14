import { getInput, info } from '@actions/core'
import { context, getOctokit } from '@actions/github'

export interface FinalizeReleaseInfo {
  readonly releaseId: number
  readonly tagName: string
  readonly makeLatest: boolean
}

export type FinalizeReleaseMap = Record<string, FinalizeReleaseInfo>

class InvalidFinalizeReleasesInputError extends Error {
  constructor() {
    super('Invalid finalize_releases input')
    this.name = 'InvalidFinalizeReleasesInputError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseFinalizeReleasesInput(input: string): FinalizeReleaseMap {
  let parsed: unknown
  try {
    parsed = JSON.parse(input)
  } catch {
    throw new InvalidFinalizeReleasesInputError()
  }

  if (!isRecord(parsed)) {
    throw new InvalidFinalizeReleasesInputError()
  }

  const releases: FinalizeReleaseMap = {}
  for (const [path, value] of Object.entries(parsed)) {
    if (
      !path ||
      !isRecord(value) ||
      !Number.isInteger(value.releaseId) ||
      typeof value.releaseId !== 'number' ||
      value.releaseId <= 0 ||
      typeof value.tagName !== 'string' ||
      !value.tagName ||
      typeof value.makeLatest !== 'boolean'
    ) {
      throw new InvalidFinalizeReleasesInputError()
    }
    releases[path] = {
      releaseId: value.releaseId,
      tagName: value.tagName,
      makeLatest: value.makeLatest,
    }
  }
  return releases
}

export async function finalizeReleases(
  releases: FinalizeReleaseMap,
): Promise<string[]> {
  const octokit = getOctokit(getInput('token'))
  for (const release of Object.values(releases)) {
    info(`finalizing release: ${release.tagName}`)
    await octokit.rest.repos.updateRelease({
      ...context.repo,
      release_id: release.releaseId,
      draft: false,
      make_latest: release.makeLatest ? 'true' : 'false',
    })
    info(`finalized release: ${release.tagName}`)
  }
  return Object.keys(releases)
}
