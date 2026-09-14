export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error)
  }

  if ('status' in error) {
    return `${error.message} (HTTP ${error.status})`
  }

  return error.message
}
