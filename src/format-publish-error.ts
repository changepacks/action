import type { ChangepackPublishResult } from './types'

export function formatPublishError(
  result: Pick<ChangepackPublishResult, 'error' | 'stderr'> | undefined,
): string {
  return result?.error ?? result?.stderr ?? 'unknown error'
}
