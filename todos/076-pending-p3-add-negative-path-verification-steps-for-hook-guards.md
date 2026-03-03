---
status: complete
priority: p3
issue_id: "076"
tags: [code-review, quality, testing, dx-plugin]
dependencies: []
---

# Add negative-path verification matrix for new hook guards

## Problem Statement

The plan defines acceptance criteria but does not provide concrete command-level verification for negative paths (e.g., repo without Biome config, repo without tests, non-git invocation). That increases the chance of partial validation and regressions.

## Findings

- Plan location: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md:75`
- Existing acceptance criteria are outcome-oriented but lack reproducible validation steps.
- Institutional learning indicates environment-sensitive hook behavior has caused regressions before (`docs/solutions/integration-issues/worktree-validation-and-hook-test-environment-system-20260302.md`).

## Proposed Solutions

### Option 1: Add explicit verification matrix to the plan (preferred)

**Approach:** Add a table mapping scenario → setup → expected hook exit/output.

**Pros:**
- Reproducible checks for reviewers and implementers
- Better confidence before merge

**Cons:**
- Slightly longer plan document

**Effort:** Small

**Risk:** Low

---

### Option 2: Add a follow-up test task only

**Approach:** Keep plan short and create a separate test task for negative-path validation.

**Pros:**
- Keeps plan concise

**Cons:**
- Validation may be deferred or missed

**Effort:** Medium

**Risk:** Medium

## Recommended Action


## Technical Details

**Affected files:**
- `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md`

**Related components:**
- `plugins/dx-bun-runner/hooks/bun-test-ci.ts`
- `plugins/dx-biome-runner/hooks/biome-check.ts`

**Database changes (if any):**
- Migration needed? No

## Resources

- Plan: `docs/plans/2026-03-04-fix-dx-plugin-hook-guards-plan.md`
- Known pattern: `docs/solutions/integration-issues/worktree-validation-and-hook-test-environment-system-20260302.md`

## Acceptance Criteria

- [ ] Plan includes at least 3 negative-path verification scenarios
- [ ] Each scenario lists exact command/setup and expected hook behavior
- [ ] Validation steps cover both Stop and PostToolUse hooks touched by this plan

## Work Log

### 2026-03-04 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed acceptance criteria and compared with prior environment-related regression learnings.
- Identified missing reproducible negative-path checks.

**Learnings:**
- Environment-sensitive hook changes benefit from explicit scenario matrices, not only outcome bullets.

## Notes

- Priority is P3 because this improves assurance quality rather than fixing an immediate blocker.
