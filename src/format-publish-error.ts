import type { ChangepackPublishResult } from './types'

// `error` is often null even for a failure, with the real cause only on
// stderr, so fall through on blank values instead of just null ones.
export function formatPublishError(
  result: Pick<ChangepackPublishResult, 'error' | 'stderr'> | undefined,
): string {
  return result?.error?.trim() || result?.stderr?.trim() || 'unknown error'
}
