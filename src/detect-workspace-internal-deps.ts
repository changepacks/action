import { getExecOutput } from '@actions/exec'

/**
 * Subset of `cargo metadata --no-deps` JSON output we actually need.
 */
interface CargoMetadataPackage {
  name: string
  manifest_path: string
  dependencies: { name: string }[]
}

interface CargoMetadata {
  packages: CargoMetadataPackage[]
  workspace_root: string
}

/**
 * Result of running the skip detector over a publish batch.
 */
export interface WorkspaceInternalDepResult {
  /** Targets that should still go through `changepacks publish --dry-run`. */
  filtered: string[]
  /** Targets that were skipped because they depend on another bumped target. */
  skipped: string[]
}

/**
 * Detect Rust packages in the publish batch whose dependencies are also being
 * bumped in the same run, and remove them from the dry-run target list.
 *
 * `cargo publish --dry-run` resolves every dependency against crates.io
 * before attempting the simulated upload. When a workspace publishes
 * multiple interdependent crates together, the newer versions of the
 * dependencies do not exist on crates.io yet, so the dry-run fails with
 * `failed to select a version for the requirement` even though the real
 * publish (in topological order) would succeed. This is a documented
 * upstream limitation: rust-lang/cargo#1169, rust-lang/cargo#9507,
 * rust-lang/cargo#15622.
 *
 * The skip detector runs entirely in the action so the fix takes effect
 * the moment the action repo is updated, without waiting for a new
 * changepacks CLI binary to roll through GitHub Releases. The downside
 * is that we lose the dry-run signal for the skipped packages; their
 * publish issues will only surface during the real publish step.
 *
 * When `cargo metadata` is unavailable (no cargo on the runner, the
 * working directory is not a workspace, or the command crashes), the
 * detector falls back to returning the input unchanged so the existing
 * dry-run path still runs. This is safe because the worst case is the
 * pre-detector behavior (false-positive dry-run failure), not a worse
 * outcome.
 *
 * @param target - Paths in the publish batch (mixed languages).
 * @returns `filtered` paths to keep + `skipped` paths to surface in logs.
 */
export async function detectWorkspaceInternalDeps(
  target: string[],
): Promise<WorkspaceInternalDepResult> {
  const rustPaths = target.filter((p) => p.endsWith('/Cargo.toml'))
  if (rustPaths.length === 0) {
    return { filtered: target, skipped: [] }
  }

  let meta: CargoMetadata
  try {
    const out = await getExecOutput(
      'cargo',
      ['metadata', '--no-deps', '--format-version', '1'],
      { silent: true, ignoreReturnCode: false },
    )
    meta = JSON.parse(out.stdout) as CargoMetadata
  } catch {
    // Cargo metadata failed (no cargo, not a workspace, etc.). Fall back
    // to existing behavior so the dry-run gate still runs.
    return { filtered: target, skipped: [] }
  }

  // Build a path-to-package map keyed by manifest_path made relative to
  // workspace_root and normalized to forward slashes (matching the way
  // changepacks emits target paths).
  const pathToPackage = new Map<string, CargoMetadataPackage>()
  const root = meta.workspace_root.replace(/\\/g, '/').replace(/\/+$/, '')
  for (const pkg of meta.packages) {
    const abs = pkg.manifest_path.replace(/\\/g, '/')
    const rel = abs.startsWith(`${root}/`) ? abs.slice(root.length + 1) : abs
    pathToPackage.set(rel, pkg)
  }

  // Collect the names of every package being bumped in this run. Only
  // include paths that resolve to a known workspace member; unknown paths
  // (e.g. non-Rust members) cannot contribute to the bumped set.
  const bumpedNames = new Set<string>()
  for (const path of rustPaths) {
    const pkg = pathToPackage.get(path)
    if (pkg) {
      bumpedNames.add(pkg.name)
    }
  }

  // Filter the input: a Rust target is skipped iff any of its dependencies
  // matches a name in the bumped set. Non-Rust targets are always kept.
  const skipped: string[] = []
  const filtered = target.filter((path) => {
    const pkg = pathToPackage.get(path)
    if (!pkg) {
      return true
    }
    const hasBumpedDep = pkg.dependencies.some((d) => bumpedNames.has(d.name))
    if (hasBumpedDep) {
      skipped.push(path)
      return false
    }
    return true
  })

  return { filtered, skipped }
}
