import type { ChangepackResult } from './types'

export function createBody(changepack: ChangepackResult): string {
  const majorLogs = changepack.logs.filter((log) => log.type === 'MAJOR')
  const minorLogs = changepack.logs.filter((log) => log.type === 'MINOR')
  const patchLogs = changepack.logs.filter((log) => log.type === 'PATCH')
  const logs = [
    `# ${changepack.name ?? changepack.path}@${
      changepack.nextVersion
        ? `${changepack.version} → ${changepack.nextVersion}`
        : (changepack.version ?? 'Unknown')
    }`,
  ]
  if (majorLogs.length > 0) {
    logs.push('## Major')
    logs.push(...majorLogs.map((log) => `- ${log.type}: ${log.note}`))
  }
  if (minorLogs.length > 0) {
    logs.push('## Minor')
    logs.push(...minorLogs.map((log) => `- ${log.type}: ${log.note}`))
  }
  if (patchLogs.length > 0) {
    logs.push('## Patch')
    logs.push(...patchLogs.map((log) => `- ${log.type}: ${log.note}`))
  }
  if (
    changepack.changed &&
    (majorLogs.length > 0 || minorLogs.length > 0 || patchLogs.length > 0)
  ) {
    // Maybe you forgot to write the following files to the latest version:
    logs.push(
      'Maybe you forgot to write the following files to the latest version',
    )
  }
  return logs.join('\n')
}
