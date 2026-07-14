import type { ReleaseIntent } from './check-past-changepacks'
import type { ChangepackResultMap } from './types'

export interface NormalizedReleaseIntent {
  readonly changepacks: ChangepackResultMap
  readonly sourceSha: string | null
}

function isReleaseIntent(
  value: ReleaseIntent | ChangepackResultMap,
): value is ReleaseIntent {
  return (
    'sourceSha' in value &&
    typeof value.sourceSha === 'string' &&
    'changepacks' in value &&
    typeof value.changepacks === 'object' &&
    value.changepacks !== null
  )
}

export function normalizeReleaseIntent(
  value: ReleaseIntent | ChangepackResultMap,
): NormalizedReleaseIntent {
  if (isReleaseIntent(value)) {
    return value
  }
  return { changepacks: value, sourceSha: null }
}
