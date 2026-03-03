---
title: "fix: Add missing prerequisite guards to dx-plugin hooks"
type: fix
status: completed
date: 2026-03-04
---

# fix: Add missing prerequisite guards to dx-plugin hooks

When dx-* plugins are installed in repos that lack the tools they expect (no test files, no Biome config), hooks run anyway and produce confusing errors. Each hook should verify its tool's prerequisites exist before attempting to run.

## Audit Summary

| Plugin | Hook | Event | Guard needed | Status |
|--------|------|-------|--------------|--------|
| dx-bun-runner | bun-test-ci.ts | Stop | Check test files exist | **MISSING** |
| dx-bun-runner | bun-test.ts | PostToolUse | Per-file test existence | Already safe |
| dx-biome-runner | biome-ci.ts | Stop | Check biome.json exists | Already safe |
| dx-biome-runner | biome-check.ts | PostToolUse | Check biome.json exists | **MISSING** |
| dx-tsc-runner | tsc-ci.ts | Stop | Check tsconfig.json exists | Already safe |
| dx-tsc-runner | tsc-check.ts | PostToolUse | Walks up to find tsconfig | Already safe |

## Fix 1: `plugins/dx-bun-runner/hooks/bun-test-ci.ts`

**Problem:** Has changed-TS-files + package.json guards, but no check for test file existence. `bun test` exits 1 with "No tests found!" which the hook reports as an error.

**Fix:** Add `hasTestFiles()` after the package.json guard (line 73):

```ts
/** Check if any test files exist in the repo. */
async function hasTestFiles(root: string): Promise<boolean> {
	const proc = Bun.spawn(
		['git', 'ls-files', '--cached', '--others', '--exclude-standard'],
		{ cwd: root, stdout: 'pipe', stderr: 'pipe' },
	)
	const [output] = await Promise.all([proc.stdout.text(), proc.exited])
	return output
		.trim()
		.split('\n')
		.some(
			(file) =>
				file &&
				(/\.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$/.test(file) ||
					/[_](test|spec)[_]/.test(file)),
		)
}
```

Add after line 73:

```ts
if (!(await hasTestFiles(root))) process.exit(0)
```

## Fix 2: `plugins/dx-biome-runner/hooks/biome-check.ts`

**Problem:** The Stop hook (`biome-ci.ts`) checks for `biome.json`/`biome.jsonc` at line 165, but the PostToolUse hook (`biome-check.ts`) does not. In repos using Prettier or ESLint instead of Biome, `bunx @biomejs/biome check` runs with Biome defaults -- producing false positives that conflict with the repo's actual formatter.

**Fix:** First, add the missing import at the top of the file:

```ts
import { existsSync } from 'node:fs'
```

Then add a biome config check early in `main()`, after parsing hook input and filtering file paths (around line 135):

```ts
// Find git root for config check
const gitRoot = await getGitRoot()
if (!gitRoot) process.exit(0)
if (!existsSync(`${gitRoot}/biome.json`) && !existsSync(`${gitRoot}/biome.jsonc`)) {
	process.exit(0)
}
```

This reuses the same `getGitRoot()` helper already in `biome-ci.ts` -- needs to be added to `biome-check.ts` as well.

## Acceptance Criteria

- [x] `bun-test-ci.ts`: exit 0 silently when no test files exist in the repo
- [x] `biome-check.ts`: exit 0 silently when no `biome.json`/`biome.jsonc` exists at git root
- [x] All hooks continue to work normally in repos that DO have the expected config/files
- [x] No new dependencies -- use existing patterns (`git ls-files`, `existsSync`)
- [x] Verified: `tsc-check.ts` already safe (walks up to find tsconfig, skips files with no config)

## Verification Matrix

| Scenario | Hook | Setup | Expected |
|----------|------|-------|----------|
| No test files in repo | bun-test-ci.ts (Stop) | Repo with .ts files but no .test.ts/.spec.ts files | Exit 0 silently, no "No tests found!" error |
| No biome.json in repo | biome-ci.ts (Stop) | Repo with .ts/.js files but no biome.json/biome.jsonc | Exit 0 silently (already works) |
| No biome.json in repo | biome-check.ts (PostToolUse) | Edit a .ts file in repo without biome.json/biome.jsonc | Exit 0 silently, no Biome invocation |
| Non-git directory | biome-check.ts (PostToolUse) | Edit a .ts file outside any git repo | Exit 0 silently (getGitRoot returns null) |
| Non-git directory | bun-test-ci.ts (Stop) | Run in directory that is not a git repo | Exit 0 silently (already works) |
| Repo with test files | bun-test-ci.ts (Stop) | Repo with .ts files AND .test.ts files | Runs bun test normally (no regression) |
| Repo with biome.json | biome-check.ts (PostToolUse) | Edit .ts file in repo with biome.json | Runs biome check normally (no regression) |

## Context

- The guard pattern is already established: `tsc-ci.ts:112` checks for `tsconfig.json`, `biome-ci.ts:165` checks for `biome.json`
- PostToolUse hooks need the same guards as their Stop-hook counterparts
- `bun-test.ts` is the exception -- its per-file `findTestFile()` + `existsSync()` pattern is sufficient since it never runs a project-wide scan

## Sources

- `plugins/dx-bun-runner/hooks/bun-test-ci.ts` -- Stop hook, missing test file guard
- `plugins/dx-bun-runner/hooks/bun-test.ts` -- PostToolUse hook, already safe
- `plugins/dx-biome-runner/hooks/biome-ci.ts:165` -- Stop hook, has config guard
- `plugins/dx-biome-runner/hooks/biome-check.ts` -- PostToolUse hook, missing config guard
- `plugins/dx-tsc-runner/hooks/tsc-ci.ts:112` -- reference pattern for config guard
