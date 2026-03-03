---
status: complete
priority: p2
issue_id: "075"
tags: [code-review, quality, typescript, dx-plugin, biome]
dependencies: []
---

# Add missing import requirements to biome-check plan patch

## Problem Statement

The plan’s proposed `biome-check.ts` patch references `existsSync(...)` but does not specify the required `node:fs` import update. Following the snippet verbatim risks a TypeScript compile/runtime error during implementation.

## Findings

- Plan location: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md:66`
- Current file imports only `resolve` from `node:path` (`plugins/dx-biome-runner/hooks/biome-check.ts:11`).
- Proposed snippet introduces `existsSync` usage without documenting import changes.

## Proposed Solutions

### Option 1: Expand plan snippet with explicit import diff (preferred)

**Approach:** Update plan to include `import { existsSync } from 'node:fs'` and where it should be placed.

**Pros:**
- Reduces implementation ambiguity
- Avoids avoidable lint/typecheck churn

**Cons:**
- Slightly longer plan section

**Effort:** Small

**Risk:** Low

---

### Option 2: Add implementation checklist item

**Approach:** Keep snippet as-is but add checklist item: "Add required `existsSync` import in biome-check.ts".

**Pros:**
- Minimal plan edits

**Cons:**
- Easier to miss than a concrete code diff

**Effort:** Small

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md:61`
- `plugins/dx-biome-runner/hooks/biome-check.ts:11`

**Related components:**
- dx-biome-runner PostToolUse hook

**Database changes (if any):**
- Migration needed? No

## Resources

- Plan: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md`
- Hook source: `plugins/dx-biome-runner/hooks/biome-check.ts`

## Acceptance Criteria

- [ ] Plan explicitly documents required `existsSync` import
- [ ] Implementation instructions are copy-paste-safe without missing imports
- [ ] `biome-check.ts` passes lint/typecheck after applying planned patch

## Work Log

### 2026-03-04 - Initial Discovery

**By:** Codex

**Actions:**
- Cross-checked plan snippet against current imports in `biome-check.ts`.
- Confirmed missing import declaration in plan detail.

**Learnings:**
- Plan snippets that are close to executable should include import-level completeness.

## Notes

- This is a documentation/implementation-quality issue that can create avoidable churn.
