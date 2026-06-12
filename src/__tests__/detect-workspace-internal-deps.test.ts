import { expect, mock, test } from 'bun:test'

import { detectWorkspaceInternalDeps } from '../detect-workspace-internal-deps'

function makeMetadata(
  workspaceRoot: string,
  packages: {
    name: string
    manifestPath: string
    dependencies: string[]
  }[],
): string {
  return JSON.stringify({
    workspace_root: workspaceRoot,
    packages: packages.map((p) => ({
      name: p.name,
      manifest_path: p.manifestPath,
      dependencies: p.dependencies.map((name) => ({ name })),
    })),
  })
}

test('returns target unchanged when no Rust paths are present', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const execMock = mock(async () => ({
    stdout: 'should not be called',
    stderr: '',
    exitCode: 0,
  }))
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps([
    'package.json',
    'bridge/python/pyproject.toml',
  ])

  expect(result.filtered).toEqual([
    'package.json',
    'bridge/python/pyproject.toml',
  ])
  expect(result.skipped).toEqual([])
  // Cargo metadata must not even be invoked when there is nothing Rust to
  // inspect: skipping the spawn keeps the action fast on JS/Python-only
  // monorepos.
  expect(execMock).not.toHaveBeenCalled()

  mock.module('@actions/exec', () => originalExec)
})

test('falls back to input on cargo metadata failure', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const execMock = mock(async () => {
    throw new Error('cargo not found')
  })
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps([
    'crates/leaf/Cargo.toml',
    'crates/parent/Cargo.toml',
  ])

  expect(result.filtered).toEqual([
    'crates/leaf/Cargo.toml',
    'crates/parent/Cargo.toml',
  ])
  expect(result.skipped).toEqual([])

  mock.module('@actions/exec', () => originalExec)
})

test('keeps Rust targets whose dependencies are not bumped', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const metadata = makeMetadata('/work/repo', [
    {
      name: 'crate-leaf',
      manifestPath: '/work/repo/crates/leaf/Cargo.toml',
      dependencies: ['external-crate'],
    },
  ])
  const execMock = mock(async () => ({
    stdout: metadata,
    stderr: '',
    exitCode: 0,
  }))
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps(['crates/leaf/Cargo.toml'])

  expect(result.filtered).toEqual(['crates/leaf/Cargo.toml'])
  expect(result.skipped).toEqual([])

  mock.module('@actions/exec', () => originalExec)
})

test('skips Rust targets whose dependencies are also being bumped', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  const metadata = makeMetadata('/work/repo', [
    {
      name: 'crate-leaf',
      manifestPath: '/work/repo/crates/leaf/Cargo.toml',
      dependencies: [],
    },
    {
      name: 'crate-parent',
      manifestPath: '/work/repo/crates/parent/Cargo.toml',
      // Depends on crate-leaf which is also in the bumped set → must be
      // skipped to avoid the rust-lang/cargo#1169 false positive.
      dependencies: ['crate-leaf'],
    },
  ])
  const execMock = mock(async () => ({
    stdout: metadata,
    stderr: '',
    exitCode: 0,
  }))
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps([
    'crates/leaf/Cargo.toml',
    'crates/parent/Cargo.toml',
    // Non-Rust path mixed in to verify it is preserved as-is.
    'bridge/python/pyproject.toml',
  ])

  expect(result.filtered).toEqual([
    'crates/leaf/Cargo.toml',
    'bridge/python/pyproject.toml',
  ])
  expect(result.skipped).toEqual(['crates/parent/Cargo.toml'])

  mock.module('@actions/exec', () => originalExec)
})

test('preserves Rust paths that are not workspace members', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  // `crates/unmapped/Cargo.toml` is in the target list but absent from
  // `cargo metadata` output (could happen if changepacks is tracking a
  // path that is not actually a workspace member, e.g. an example or a
  // pulled-in subdirectory). The detector must NOT remove it — only
  // workspace members with a real bumped-dep collision should be skipped.
  const metadata = makeMetadata('/work/repo', [
    {
      name: 'crate-leaf',
      manifestPath: '/work/repo/crates/leaf/Cargo.toml',
      dependencies: [],
    },
  ])
  const execMock = mock(async () => ({
    stdout: metadata,
    stderr: '',
    exitCode: 0,
  }))
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps([
    'crates/leaf/Cargo.toml',
    'crates/unmapped/Cargo.toml',
  ])

  expect(result.filtered).toEqual([
    'crates/leaf/Cargo.toml',
    'crates/unmapped/Cargo.toml',
  ])
  expect(result.skipped).toEqual([])

  mock.module('@actions/exec', () => originalExec)
})

test('handles Windows-style backslash manifest paths', async () => {
  const originalExec = { ...(await import('@actions/exec')) }
  // Cargo on Windows emits backslash-separated paths; the detector must
  // normalise to forward slashes so the keys match changepacks' relative
  // path format.
  const metadata = JSON.stringify({
    workspace_root: 'C:\\work\\repo',
    packages: [
      {
        name: 'crate-leaf',
        manifest_path: 'C:\\work\\repo\\crates\\leaf\\Cargo.toml',
        dependencies: [],
      },
      {
        name: 'crate-parent',
        manifest_path: 'C:\\work\\repo\\crates\\parent\\Cargo.toml',
        dependencies: [{ name: 'crate-leaf' }],
      },
    ],
  })
  const execMock = mock(async () => ({
    stdout: metadata,
    stderr: '',
    exitCode: 0,
  }))
  mock.module('@actions/exec', () => ({ getExecOutput: execMock }))

  const result = await detectWorkspaceInternalDeps([
    'crates/leaf/Cargo.toml',
    'crates/parent/Cargo.toml',
  ])

  expect(result.filtered).toEqual(['crates/leaf/Cargo.toml'])
  expect(result.skipped).toEqual(['crates/parent/Cargo.toml'])

  mock.module('@actions/exec', () => originalExec)
})
