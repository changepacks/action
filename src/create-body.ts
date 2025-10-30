import type { ChangepackResult } from './types'

export function createBody(changepack: ChangepackResult): string {
  const majorLogs = changepack.logs.filter((log) => log.type === 'MAJOR')
  const minorLogs = changepack.logs.filter((log) => log.type === 'MINOR')
  const patchLogs = changepack.logs.filter((log) => log.type === 'PATCH')
  const logs = [`# ${changepack.name}@${changepack.nextVersion}`]
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
  return logs.join('\n')
}
