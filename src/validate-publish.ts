import { endGroup, error, info, setFailed, startGroup } from '@actions/core'
import { detectWorkspaceInternalDeps } from './detect-workspace-internal-deps'
import { formatPublishError } from './format-publish-error'
import { runChangepacks } from './run-changepacks'

export async function validatePublish(
  targets: readonly string[],
  publishOptions: readonly string[],
): Promise<boolean> {
  info(`dry-run target: ${targets.join(', ')}`)
  const { filtered, skipped } = await detectWorkspaceInternalDeps([...targets])
  if (skipped.length > 0) {
    info(
      `dry-run skipped (workspace-internal dep — rust-lang/cargo#1169): ${skipped.join(', ')}`,
    )
  }
  if (filtered.length === 0) {
    info(
      'dry-run summary: 0 validated (all targets skipped as workspace-internal deps)',
    )
    return true
  }

  startGroup('dry-run')
  try {
    const result = await runChangepacks(
      'publish',
      '--dry-run',
      ...filtered.flatMap((path) => ['-p', path]),
      ...publishOptions,
    )
    const failures: string[] = []
    const successes: string[] = []
    for (const [path, publishResult] of Object.entries(result)) {
      if (publishResult.result) {
        info(`${path} dry-run succeeded`)
        successes.push(path)
        if (publishResult.stdout) {
          info(`dry-run stdout: ${publishResult.stdout}`)
        }
      } else {
        const message = `${path} dry-run failed: ${formatPublishError(publishResult)}`
        error(message)
        failures.push(message)
      }
    }
    if (failures.length > 0) {
      setFailed(failures.join('\n'))
      return false
    }

    const missing = filtered.filter((path) => !(path in result))
    info(
      `dry-run summary: ${successes.length}/${filtered.length} validated (${successes.join(', ') || 'none'})`,
    )
    if (missing.length > 0) {
      info(`dry-run skipped (delegated downstream): ${missing.join(', ')}`)
    }
    return true
  } catch (caught: unknown) {
    error(`publish --dry-run crashed: ${caught}`)
    setFailed(caught instanceof Error ? caught : String(caught))
    return false
  } finally {
    endGroup()
  }
}
