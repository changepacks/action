# Changepacks Action

GitHub Action automating changepacks version management: PR comments, version update PRs, release creation, and Slack notifications.

**Stack**: TypeScript 5.9 · Bun (build + test) · Node 24 runtime · `@actions/*` SDK

## Structure

```
src/
├── index.ts              # Entry → run()
├── run.ts                # Orchestration: PR vs push vs release flow
├── install-changepacks.ts
├── run-changepacks.ts    # CLI wrapper (check/update/publish), overloaded return types
├── get-changepacks-config.ts
├── fetch-origin.ts
├── check-past-changepacks.ts  # Git history rollback detection (shallow clone aware)
├── create-pr.ts          # Version update PR on changepacks/{baseBranch}
├── create-release.ts     # Tags + GitHub releases with rollback on failure
├── update-pr-comment.ts  # Upsert bot comment on PRs
├── send-slack-notification.ts
├── create-body.ts        # Release body (Major/Minor/Patch sections)
├── create-contents.ts    # PR body aggregator
├── types.ts              # ChangepackResult, ChangepackConfig, etc.
└── __tests__/            # 1:1 test files for every module
```

## Execution Flow

```
run()
├─ installChangepacks()         # Download binary from changepacks/changepacks releases
├─ getChangepacksConfig()       # Parse .changepacks/config.json via CLI
├─ if PR context → updatePrComment()
└─ if push to baseBranch
   ├─ if changepacks have nextVersion → createPr()
   └─ else → checkPastChangepacks() → createRelease() → sendSlackNotification() → publish
```

## Where to Look

| Task | Location |
|------|----------|
| Add new action input | `action.yml` inputs + read via `getInput()`/`getBooleanInput()` in source |
| Change orchestration logic | `src/run.ts` |
| Modify release tag format | `src/create-release.ts` — format: `{name}({path})@{version}` |
| Change PR body format | `src/create-body.ts` + `src/create-contents.ts` |
| Fix git/shallow clone issues | `src/check-past-changepacks.ts` |
| Add new action output | `action.yml` outputs + `setOutput()` call in source |

## Conventions

- **Formatting**: Biome — single quotes, no semicolons, 2-space indent
- **TypeScript**: Strict mode, ESNext target, bundler resolution
- **Module pattern**: One exported async function per file, named after the file
- **Error handling**: try/catch with `@actions/core` error()/setFailed(), finally blocks for cleanup
- **Logging**: `@actions/core` startGroup()/endGroup() for logical sections, debug() gated by isDebug()
- **Git operations**: Via `@actions/exec` with `silent: !isDebug()`
- **GitHub API**: Via `@actions/github` getOctokit()

## Anti-Patterns

- `create-pr.ts` uses `git push --force` on `changepacks/{base}` branch — intentional, do not remove
- `check-past-changepacks.ts` enters detached HEAD temporarily — always checks back out to original branch
- `run.ts` finally block runs `git clean -fd` — ensures no leftover binary artifacts
- Automated commits use author `changepacks <changepacks@users.noreply.github.com>`
- `create-release.ts` rollback: on failure, deletes all created releases AND tags before returning false

## Testing

- **Runner**: `bun:test` (no Jest/Vitest)
- **Pattern**: `import { expect, mock, test } from 'bun:test'`
- **Mocking**: `mock.module()` for dependency injection, save/restore originals per test
- **Structure**: Flat `test()` calls (no `describe` blocks)
- **Coverage**: Enabled via `bunfig.toml`, skip test files and dist/

```typescript
// Standard test skeleton
test('description', async () => {
  const original = { ...(await import('../module')) }
  const myMock = mock(async () => result)
  mock.module('../module', () => ({ fn: myMock }))

  const { fn } = await import('../module')
  await fn()
  expect(myMock).toHaveBeenCalled()

  mock.module('../module', () => original)  // Always restore
})
```

## Commands

```bash
bun build          # Bundle to dist/index.js (CJS, Node target)
bun run lint       # Biome check + tsc --noEmit
bun run lint:fix   # Biome auto-fix + tsc --noEmit
bun test           # Run all tests
bun test --coverage # Tests with coverage report
```

## Notes

- `dist/index.js` is committed — required for GitHub Actions (no build step at runtime)
- Pre-commit hook enforces `bun run lint` + `bun test --coverage`
- Binary downloaded to repo root at runtime, cleaned up in finally block
- Action runs on Node 24 (action.yml) but builds with Bun
- `runChangepacks()` uses TypeScript function overloads: 'publish' returns `Record<string, ChangepackPublishResult>`, 'check'/'update' returns `ChangepackResultMap`
