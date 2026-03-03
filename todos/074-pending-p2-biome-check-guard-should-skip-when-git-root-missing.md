---
status: complete
priority: p2
issue_id: "074"
tags: [code-review, quality, reliability, dx-plugin, biome]
dependencies: []
---

# Ensure biome-check guard exits when git root is unavailable

## Problem Statement

The plan’s proposed guard for `biome-check.ts` exits only when a git root exists and no Biome config is found. If `getGitRoot()` returns `null` (non-git context, detached tool invocation), the hook would still run Biome and potentially produce noisy or misleading failures.

## Findings

- Plan location: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md:63`
- Proposed snippet uses `if (gitRoot && !existsSync(...)) process.exit(0)` which does not short-circuit on `gitRoot === null`.
- Current hook behavior already runs without a git-root prerequisite (`plugins/dx-biome-runner/hooks/biome-check.ts:122` onward), so this edge case remains open unless explicitly handled.

## Proposed Solutions

### Option 1: Explicit null-root early return (preferred)

**Approach:** Add `if (!gitRoot) process.exit(0)` before config checks.

**Pros:**
- Deterministic skip in unsupported contexts
- Matches defensive style used in other hooks

**Cons:**
- Slightly more branching in `main()`

**Effort:** Small

**Risk:** Low

---

### Option 2: Fold null check into one conditional

**Approach:** Use `if (!gitRoot || (!existsSync(...biome.json) && !existsSync(...biome.jsonc))) process.exit(0)`.

**Pros:**
- Compact implementation

**Cons:**
- Slightly less readable than split guards

**Effort:** Small

**Risk:** Low

## Recommended Action


## Technical Details

**Affected files:**
- `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md:63`
- `plugins/dx-biome-runner/hooks/biome-check.ts`

**Related components:**
- dx-biome-runner PostToolUse guard behavior

**Database changes (if any):**
- Migration needed? No

## Resources

- Plan: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md`
- Hook source: `plugins/dx-biome-runner/hooks/biome-check.ts`

## Acceptance Criteria

- [ ] Plan snippet updated to short-circuit when `gitRoot` is missing
- [ ] Final implementation in `biome-check.ts` exits `0` when no git root is found
- [ ] Regression test/verification confirms no Biome invocation in non-git context

## Work Log

### 2026-03-04 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed plan guard snippet and compared against current `biome-check.ts` flow.
- Identified missing null-root short-circuit as an edge-case reliability gap.

**Learnings:**
- Hook guards are safer when they treat missing git root as a hard skip condition.

## Notes

- This is an implementation-risk finding in the plan, not a confirmed runtime bug in current production behavior.
