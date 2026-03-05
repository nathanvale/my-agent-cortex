---
title: "feat: Add /dx-git:split workflow for splitting WIP branches into multiple PRs"
type: feat
status: active
date: 2026-03-05
origin: docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md
---

# feat: Add /dx-git:split workflow

## Enhancement Summary

**Deepened on:** 2026-03-05  
**Sections enhanced:** 9  
**Research agents used:** `best-practices-researcher`, `framework-docs-researcher`, `architecture-strategist`, `security-sentinel`, `performance-oracle`, `code-simplicity-reviewer`, `pattern-recognition-specialist`, `spec-flow-analyzer`, `repo-research-analyst`, `learnings-researcher`

### Key Improvements

1. Added an execution-safe apply pipeline (`git apply --check` then `git apply --3way`) with deterministic rollback behavior.
2. Added explicit edge-case handling for renames, binary patches, empty branches, and unassigned/deleted files.
3. Added contract/test updates to keep command frontmatter, workflow references, and safety-hook expectations in sync.

### New Considerations Discovered

- Use `git switch -c <branch> <start-point>` consistently to avoid ambiguous checkout behavior and align with modern Git guidance.
- Preserve CLI-first workflow architecture (no MCP escalation) unless cross-client/stateful/schema-critical triggers appear (see `docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md`).

## Section Manifest

Section 1: Overview + Problem Statement - Validate demand/fit and outcome metrics for split workflow adoption.  
Section 2: Proposed Solution + Interaction Model - Improve UX prompts, branch/file assignment flow, and dry-run clarity.  
Section 3: Technical Considerations - Harden patch apply strategy, branch safety, and rollback guarantees.  
Section 4: Acceptance Criteria - Add verifiable safety and behavior assertions (edge cases and failures).  
Section 5: Implementation Order - Add guardrail tests and command/workflow contract updates.  
Section 6: Verification - Expand test matrix for conflict, rename, and dirty-tree scenarios.  
Section 7: Sources - Add authoritative Git/GitHub references and institutional learnings.

## Quick Start

```bash
/dx-git:split            # preview split plan (no mutations)
/dx-git:split --confirm  # execute split branches
# On each created branch:
/dx-git:commit-push-pr
```

## Overview

Add a `/dx-git:split` command to the dx-git plugin that helps split a WIP-heavy feature branch into multiple clean feature branches. The key insight from the arena research: **split before you squash** -- once you squash, you lose the granularity needed to split.

This solves the common agentic coding scenario: you've been heads-down, WIP checkpoints piling up, and you realize the work is actually 2-3 separate PRs. Today you'd have to manually cherry-pick or soft-reset -- error-prone and easy to lose work. This command makes it safe and guided.

### Research Insights

**Best Practices:**
- Keep split output branches narrowly scoped (single concern per branch) to reduce PR review overhead and merge risk.
- Preserve default command ergonomics used in existing dx-git commands: preview first, mutate only on explicit confirm.
- Keep the workflow CLI-native and stateless (matches current plugin architecture and avoids unnecessary orchestration complexity).

**Performance Considerations:**
- Compute merge-base once and reuse it through the entire run to avoid repeated graph traversal.
- Collect file stats with one `git diff --name-status` pass, then derive prompts from that dataset.

**Implementation Details:**
```bash
DEFAULT_BRANCH=<detected-default-branch>
BASE=$(git merge-base "$DEFAULT_BRANCH" HEAD)
git diff --name-status "$BASE..HEAD"
```

**Edge Cases:**
- If `BASE == HEAD`, stop with a clear no-op message: no branch-local work to split.
- If only one logical group exists after assignment, suggest `/dx-git:squash` instead of split.

**References:**
- https://git-scm.com/docs/git-merge-base
- https://git-scm.com/docs/git-diff

## Problem Statement

Agentic coding sessions produce 15-30 micro-commits per session (SFEIR Institute). Developers accumulate WIP checkpoints, then face a decision point:

```
WIP commits piling up
        |
   "Is this one PR or multiple?"
        |
   ┌────┴────┐
   One PR    Multiple PRs
   |         |
   Squash    ??? (no workflow exists)
   |
   PR
```

The "multiple PRs" path has no tooling today. The `/squash` command handles the single-PR case. This command handles the split case.

### Research Insights

**Best Practices:**
- Define success metrics up front: split completion rate, rollback rate, and average PR size reduction.
- Keep the mental model “group by outcome, not commit history” explicit throughout prompts.

**Performance Considerations:**
- Prompt users with path-grouped summaries (directory clusters) before file-level assignment to reduce cognitive load in large diffs.

**Implementation Details:**
```bash
git log --oneline "$BASE..HEAD"
git diff --stat "$BASE..HEAD"
```

**Edge Cases:**
- Large branches (100+ files) need pagination/partitioning in prompts.
- Generated files should be grouped or excluded by default to avoid accidental branch pollution.

**References:**
- https://git-scm.com/docs/git-log
- https://git-scm.com/docs/git-diff

## Proposed Solution

A new `/dx-git:split` command that delegates to a `## Split` section in `references/workflows.md`. The workflow:

1. **Survey** -- show accumulated changes since main
2. **Group** -- user assigns files to named target branches
3. **Backup** -- create a safety ref before any mutations
4. **Split** -- create branches and apply changes
5. **Report** -- summary of what was created

### Scope Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Granularity | **File-level only** (v1) | Hunk-level splitting doubles complexity; file-level covers 80% of cases |
| Apply strategy | **`git diff` + `git apply`** | Works with WIP checkpoints where commit boundaries are meaningless; avoids cherry-pick conflicts |
| PR creation | **Branches only** | User invokes `/dx-git:commit-push-pr` on each branch. Unix philosophy -- one thing well. |
| Auto-squash | **Yes, per branch** | Each new branch gets a single clean commit. The source was WIP noise anyway. |
| Original branch | **Always preserved** | Backup ref `split-backup/<branch>/<timestamp>`. Never auto-deleted. |
| Dry run | **Default mode** | First run shows the plan; `--confirm` executes. Matches `/dx-git:clean-gone` pattern. |
| Max branches | **2-5** | Error with clear message if user requests more |

### Interaction Model

```
/dx-git:split

Scanning feat/big-feature since main (merge-base abc1234)...

  12 commits (9 WIP checkpoints, 3 conventional)
  16 files changed (+831, -37)

  src/auth/
    1. oauth-client.ts      (+142, -3)
    2. oauth-types.ts        (+67)
    3. session-manager.ts    (+89, -12)

  src/api/
    4. routes.ts             (+34, -2)
    5. middleware.ts          (+22)

  tests/
    6. oauth.test.ts         (+200)
    7. session.test.ts       (+150)

  docs/research/
    8. arena-merge-squash.md (+91)

How many target branches? 3

Branch 1 name: feat/oauth
Branch 1 files: 1, 2, 4, 6

Branch 2 name: feat/session
Branch 2 files: 3, 5, 7

Branch 3 name: docs/arena-research
Branch 3 files: 8

--- DRY RUN ---

Would create:
  feat/oauth          (4 files, +443, -5)
  feat/session         (3 files, +261, -12)
  docs/arena-research  (1 file, +91)

Unassigned files: none
Backup ref: split-backup/feat/big-feature/20260305-1430

Run /dx-git:split --confirm to execute.
```

### Research Insights

**Best Practices:**
- Validate branch names before execution (`git check-ref-format --branch`) to avoid invalid refs and command injection-style input abuse.
- Require explicit handling for unassigned files: block execution unless user confirms skip list.
- Show `base` branch and merge-base hash in both survey and dry-run to make the patch scope auditable.

**Performance Considerations:**
- Build dry-run branch stats from cached per-group diff outputs instead of recomputing all groups multiple times.

**Implementation Details:**
```bash
git check-ref-format --branch "$TARGET_BRANCH"
git diff --stat "$BASE..HEAD" -- "${GROUP_FILES[@]}"
```

**Edge Cases:**
- Duplicate file assignment should fail fast with a single conflict report before execution.
- Deleted files in one group and modified files in another group should trigger a hard error in v1.

**References:**
- https://git-scm.com/docs/git-check-ref-format
- https://git-scm.com/docs/git-diff

## Technical Considerations

### Apply Strategy

For WIP-heavy branches (the primary use case), commit boundaries are noise. The approach:

1. Detect default branch (`DEFAULT_BRANCH`), then compute the total diff from merge-base to HEAD: `git diff $(git merge-base "$DEFAULT_BRANCH" HEAD)..HEAD`
2. For each target branch, extract the diff for assigned files: `git diff <merge-base>..HEAD -- <file1> <file2> ...`
3. Create branch from default branch: `git switch -c <branch-name> <default-branch>`
4. Apply the diff: `git apply`
5. Stage and commit with a clean conventional commit message

This avoids cherry-pick entirely -- no conflict risk from interleaved commits, no dependency on commit boundaries.

### Safety Hook Compatibility

Commands the split workflow needs, checked against `git-safety.ts`:

| Command | Blocked? | Notes |
|---------|----------|-------|
| `git diff <base>..HEAD -- <files>` | No | Read-only |
| `git merge-base <default-branch> HEAD` | No | Read-only |
| `git log --oneline <base>..HEAD` | No | Read-only |
| `git switch -c <name> <default-branch>` | No | Creates new branch |
| `git apply` | No | Not in blocked list |
| `git add <specific files>` | No | Specific files allowed |
| `git commit -m ...` | No | On feature branch |
| `git branch split-backup/...` | No | Creates ref |
| `git stash` | No | Stash is allowed |
| `git switch <original-branch>` | No | Safe branch switch |

**Checkout rule clarity:** Avoid `git checkout` entirely in this workflow. Use `git switch` commands for branch creation and switching. The safety hook blocks file-extraction forms like `git checkout <ref> -- <path>`.

### Backup and Rollback

Before any mutations:
```bash
git branch split-backup/feat/big-feature/20260305-1430
```

On failure:
1. Delete any created split branches: `git branch -d <branch>` (safe delete, not `-D`)
2. Switch back to original branch: `git switch <original>`
3. Print: "Split aborted. Your original branch is untouched. Backup ref: split-backup/..."

The backup ref is never auto-deleted. User can clean up manually or via `/dx-git:clean-gone`.

### Uncommitted Changes

If working tree is dirty when `/split` is invoked:
- Auto-checkpoint: `git add -u && git commit --no-verify -m "chore(wip): pre-split checkpoint"`
- Print: "Checkpointed uncommitted changes before split."
- This matches the existing auto-commit-on-stop pattern.

### Cross-Group File Conflicts

When a file appears in commits that logically span multiple groups (v1 limitation):

```
Warning: src/api/routes.ts has changes touching multiple concerns.
Assigning entire file to one group. Which group should own it?
  1. feat/oauth
  2. feat/session
```

File-level assignment is enforced. Hunk-level splitting is deferred to v2.

### Research Insights

**Best Practices:**
- Replace `git checkout -b` with `git switch -c` for clearer branch intent and modern command semantics.
- Preflight each group patch with `git apply --check` before mutation; apply with `git apply --3way` to improve resilience against context drift.
- Use `--` pathspec separator consistently when constructing file-scoped diffs.

**Performance Considerations:**
- Avoid regenerating full diffs in each branch loop; generate group patch once and reuse during dry-run + confirm execution.
- Use NUL-delimited file capture when possible in shell loops to avoid path parsing failures on spaces/special chars.

**Implementation Details:**
```bash
DEFAULT_BRANCH=<detected-default-branch>
BASE=$(git merge-base "$DEFAULT_BRANCH" HEAD)

# Build patch per group safely
PATCH_FILE="/tmp/dx-git-split-$GROUP.patch"
git diff "$BASE..HEAD" -- "${GROUP_FILES[@]}" > "$PATCH_FILE"

# Preflight + apply
if git apply --check "$PATCH_FILE"; then
  git apply --3way "$PATCH_FILE"
else
  echo "Patch preflight failed for $GROUP"
  exit 1
fi

git switch -c "$GROUP_BRANCH" "$DEFAULT_BRANCH"
```

**Edge Cases:**
- Binary changes can make patch inspection harder; fail with explicit guidance if `git apply` rejects unsupported patch chunks.
- Renames/copies may need explicit v1 constraint messaging if patch mapping becomes ambiguous.
- If branch already exists, fail fast and require rename (no implicit force-reset behavior).

**References:**
- https://git-scm.com/docs/git-apply
- https://git-scm.com/docs/git-switch
- https://git-scm.com/docs/git-diff

## Acceptance Criteria

- [ ] `/dx-git:split` command exists and delegates to workflow skill
- [ ] Dry run mode (default) shows file grouping plan without mutations
- [ ] `--confirm` flag executes the split
- [ ] Backup ref created before any mutations
- [ ] Each target branch gets a single clean conventional commit
- [ ] Original branch preserved (never deleted)
- [ ] Uncommitted changes auto-checkpointed before split
- [ ] Clear error if invoked on main/master
- [ ] Clear error if fewer than 2 or more than 5 target branches requested
- [ ] Unassigned files detected and reported
- [ ] Summary printed with branch names, file counts, and diff stats
- [ ] Error messages use stable templates:
  - `Cannot run /dx-git:split on <branch>. Switch to a feature branch.`
  - `Expected 2-5 target branches, got <n>.`
  - `Unassigned files remain: <files>. Assign or confirm skip.`

### Research Insights

**Best Practices:**
- Add explicit criteria for patch preflight and failure behavior.
- Add criteria for branch name validation and duplicate file assignment rejection.

**Performance Considerations:**
- Add a runtime target for interactive runs (for example: under 5 seconds for 30 files on local repos).

**Implementation Details:**
```markdown
- [ ] `git apply --check` passes for every target branch before mutating any branch
- [ ] Invalid branch names are rejected via `git check-ref-format --branch`
- [ ] Duplicate file assignments are rejected before dry-run summary
- [ ] Existing target branches cause deterministic failure with remediation guidance
```

**Edge Cases:**
- Empty group after reassignment should block execution.
- Deleted files must be represented correctly in per-branch commit outcomes.

**References:**
- https://git-scm.com/docs/git-apply
- https://git-scm.com/docs/git-check-ref-format

## Implementation Order

### Phase 1: Workflow reference section (~30 min)

Add `## Split` section to `plugins/dx-git/skills/workflow/references/workflows.md`:

1. Pre-flight checks (branch, clean state, merge-base)
2. Survey (enumerate commits and files)
3. Group (interactive file assignment)
4. Dry run output
5. Backup ref creation
6. Branch creation + diff apply loop
7. Completion summary

### Phase 2: Command file (~10 min)

Create `plugins/dx-git/commands/split.md`:

```yaml
---
name: split
description: Split a WIP-heavy branch into multiple clean feature branches
model: sonnet
argument-hint: [--confirm]
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git merge-base:*), Bash(git branch:*), Bash(git switch:*), Bash(git apply:*), Bash(git add:*), Bash(git commit:*), Bash(git stash:*), Bash(git check-ref-format:*)
---

Use the **workflow** skill to split the current branch into multiple feature branches.

$ARGUMENTS
```

### Phase 3: Routing table update (~5 min)

Add row to SKILL.md routing table:

```
| Split into multiple branches | workflows.md § Split | git diff, git apply, git switch -c, git check-ref-format |
```

### Phase 4: Plugin manifest update (~5 min)

Add `"./commands/split.md"` to `plugins/dx-git/.claude-plugin/plugin.json` `commands` array.

### Research Insights

**Best Practices:**
- Also update workflow-contract tests to include new command/tool permissions where needed.
- Keep `allowed-tools` minimal: include only commands used by the split flow.
- Align command docs with existing phrasing style in other dx-git command files.

**Performance Considerations:**
- Consolidate pre-flight checks (base branch detection, merge-base, status) into one pass.

**Implementation Details:**
```markdown
Phase 5 (tests, ~20 min)
1. Add/extend `plugins/dx-git/hooks/command-workflow-contract.test.ts`
2. Add split safety coverage in `plugins/dx-git/hooks/git-safety.test.ts` if command patterns are new
3. Add workflow doc assertions for `## Split` heading and key command patterns
```

**Edge Cases:**
- Ensure command works in headless mode where prompt responses are unavailable (must fail safely, not mutate silently).
- Ensure command behavior is deterministic when default branch is not `main`.

**References:**
- https://git-scm.com/docs/git-switch
- https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request

## Verification

1. On a branch with 5+ WIP commits touching 3+ logical areas, run `/dx-git:split`
2. Verify dry run shows correct file grouping
3. Run `/dx-git:split --confirm` and verify:
   - Backup ref exists
   - Each target branch has one clean commit
   - Original branch untouched
   - Each target branch compiles independently
4. Run `/dx-git:commit-push-pr` on each split branch to verify they integrate with existing workflow

### Research Insights

**Best Practices:**
- Add failure-path verification, not just happy-path verification.
- Verify branch-level isolation by checking each split branch has only assigned file changes against the detected default branch.

**Performance Considerations:**
- Track execution latency for dry-run and confirm modes on medium-size branches (10-50 files).

**Implementation Details:**
```bash
# Isolation check example for each split branch
git switch feat/oauth
git diff --name-only main...HEAD

# Backup ref check
git show-ref --verify refs/heads/split-backup/feat/big-feature/20260305-1430
```

**Edge Cases:**
- Dirty working tree at invocation should auto-checkpoint or hard-fail with actionable message.
- Simulate `git apply --check` failure and confirm rollback leaves original branch and backup intact.
- Validate behavior when one target branch name already exists locally/remotely.

**References:**
- https://git-scm.com/docs/git-show-ref
- https://git-scm.com/docs/git-apply

## Sources

- **Origin research:** [docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md](docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md) -- "preserve full history on feature branches, squash when merging to main"
- **MEMORY.md validated patterns:** soft reset to squash WIP, cherry-pick to rescue commits, unstage unrelated files after reset
- **Existing workflow patterns:** `/dx-git:squash` (7-step soft reset), `/dx-git:commit-push-pr` (6-phase pipeline with WIP detection), `/dx-git:clean-gone` (dry-run-then-confirm pattern)
- **SFEIR Institute:** 15-30 micro-commits per agent session, 55% review slowdown
- **SpecFlow analysis:** file-level grouping sufficient for v1; `git diff | git apply` avoids cherry-pick conflicts; backup ref pattern for safety
- **Internal learnings:** [docs/solutions/integration-issues/worktree-validation-and-hook-test-environment-system-20260302.md](docs/solutions/integration-issues/worktree-validation-and-hook-test-environment-system-20260302.md) (deterministic tooling/test behavior), [docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md](docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md) (CLI-first decision framework)
- **Git docs:** https://git-scm.com/docs/git-apply, https://git-scm.com/docs/git-switch, https://git-scm.com/docs/git-merge-base, https://git-scm.com/docs/git-diff, https://git-scm.com/docs/git-check-ref-format, https://git-scm.com/docs/git-show-ref
- **GitHub docs:** https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request
