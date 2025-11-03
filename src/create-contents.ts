import { createBody } from './create-body'
import type { ChangepackResultMap } from './types'

export function createContents(changepacks: ChangepackResultMap): string {
  return `# Changepacks\n${Object.values(changepacks).map(createBody).filter(Boolean).join('\n')}`
}
