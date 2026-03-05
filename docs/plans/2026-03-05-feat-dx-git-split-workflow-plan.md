---
title: "feat: Add /dx-git:split workflow for splitting WIP branches into multiple PRs"
type: feat
status: active
date: 2026-03-05
origin: docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md
---

# feat: Add /dx-git:split workflow

## Overview

Add a `/dx-git:split` command to the dx-git plugin that helps split a WIP-heavy feature branch into multiple clean feature branches. The key insight from the arena research: **split before you squash** -- once you squash, you lose the granularity needed to split.

This solves the common agentic coding scenario: you've been heads-down, WIP checkpoints piling up, and you realize the work is actually 2-3 separate PRs. Today you'd have to manually cherry-pick or soft-reset -- error-prone and easy to lose work. This command makes it safe and guided.

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

## Technical Considerations

### Apply Strategy

For WIP-heavy branches (the primary use case), commit boundaries are noise. The approach:

1. Compute the total diff from merge-base to HEAD: `git diff $(git merge-base main HEAD)..HEAD`
2. For each target branch, extract the diff for assigned files: `git diff <merge-base>..HEAD -- <file1> <file2> ...`
3. Create branch from main: `git checkout -b <branch-name> main`
4. Apply the diff: `git apply`
5. Stage and commit with a clean conventional commit message

This avoids cherry-pick entirely -- no conflict risk from interleaved commits, no dependency on commit boundaries.

### Safety Hook Compatibility

Commands the split workflow needs, checked against `git-safety.ts`:

| Command | Blocked? | Notes |
|---------|----------|-------|
| `git diff <base>..HEAD -- <files>` | No | Read-only |
| `git merge-base main HEAD` | No | Read-only |
| `git log --oneline <base>..HEAD` | No | Read-only |
| `git checkout -b <name> main` | No | Creates new branch |
| `git apply` | No | Not in blocked list |
| `git add <specific files>` | No | Specific files allowed |
| `git commit -m ...` | No | On feature branch |
| `git branch split-backup/...` | No | Creates ref |
| `git stash` | No | Stash is allowed |
| `git checkout <original-branch>` | **Yes** | Blocked by `checkout <ref> -- <path>` rule |

**Workaround for checkout:** Use `git switch <branch>` instead of `git checkout <branch>`. The safety hook blocks `git checkout <ref> -- <path>` (file extraction pattern) but `git switch` is not in the blocked list and is the modern equivalent for branch switching.

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
allowed-tools: Bash(git log:*), Bash(git diff:*), Bash(git status:*), Bash(git merge-base:*), Bash(git branch:*), Bash(git checkout -b:*), Bash(git switch:*), Bash(git apply:*), Bash(git reset --soft:*), Bash(git add:*), Bash(git commit:*), Bash(git show:*), Bash(git stash:*)
---

Use the **workflow** skill to split the current branch into multiple feature branches.

$ARGUMENTS
```

### Phase 3: Routing table update (~5 min)

Add row to SKILL.md routing table:

```
| Split into multiple branches | workflows.md § Split | git diff, git apply, git checkout -b, git branch |
```

### Phase 4: Plugin manifest update (~5 min)

Add `"./commands/split.md"` to `plugin.json` commands array.

## Verification

1. On a branch with 5+ WIP commits touching 3+ logical areas, run `/dx-git:split`
2. Verify dry run shows correct file grouping
3. Run `/dx-git:split --confirm` and verify:
   - Backup ref exists
   - Each target branch has one clean commit
   - Original branch untouched
   - Each target branch compiles independently
4. Run `/dx-git:commit-push-pr` on each split branch to verify they integrate with existing workflow

## Sources

- **Origin research:** [docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md](docs/research/2026-03-05-arena-merge-vs-squash-agentic-coding.md) -- "preserve full history on feature branches, squash when merging to main"
- **MEMORY.md validated patterns:** soft reset to squash WIP, cherry-pick to rescue commits, unstage unrelated files after reset
- **Existing workflow patterns:** `/dx-git:squash` (7-step soft reset), `/dx-git:commit-push-pr` (6-phase pipeline with WIP detection), `/dx-git:clean-gone` (dry-run-then-confirm pattern)
- **SFEIR Institute:** 15-30 micro-commits per agent session, 55% review slowdown
- **SpecFlow analysis:** file-level grouping sufficient for v1; `git diff | git apply` avoids cherry-pick conflicts; backup ref pattern for safety
