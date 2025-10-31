import { debug } from '@actions/core'
import type { ChangepackResult } from './types'

export function createBody(changepack: ChangepackResult): string {
  const majorLogs = changepack.logs.filter((log) => log.type === 'Major')
  const minorLogs = changepack.logs.filter((log) => log.type === 'Minor')
  const patchLogs = changepack.logs.filter((log) => log.type === 'Patch')
  const logs = [
    `## ${changepack.name ?? 'Unknown'}@${
      changepack.nextVersion
        ? `${changepack.version} → ${changepack.nextVersion}`
        : (changepack.version ?? 'Unknown')
    } - ${changepack.path}`,
  ]
  debug(`changepack: ${JSON.stringify(changepack)}`)
  if (majorLogs.length > 0) {
    logs.push('### Major')
    logs.push(...majorLogs.map((log) => `- ${log.note}`))
  }
  if (minorLogs.length > 0) {
    logs.push('### Minor')
    logs.push(...minorLogs.map((log) => `- ${log.note}`))
  }
  if (patchLogs.length > 0) {
    logs.push('### Patch')
    logs.push(...patchLogs.map((log) => `- ${log.note}`))
  }
  if (
    changepack.changed &&
    majorLogs.length === 0 &&
    minorLogs.length === 0 &&
    patchLogs.length === 0
  ) {
    // Maybe you forgot to write the following files to the latest version:
    logs.push(
      'Maybe you forgot to write the following files to the latest version',
    )
  }
  debug(`createBody: ${logs.join('\n')}`)
  return logs.join('\n')
}
