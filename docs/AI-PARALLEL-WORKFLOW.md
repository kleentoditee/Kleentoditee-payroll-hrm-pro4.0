# Parallel AI Workflow

This project can move faster with Codex, Claude, and Cursor working at the same time, but not by editing the same files at the same time. The safe pattern is one branch and one worktree per agent.

## Why Worktrees

Git worktrees let one repository have multiple checked-out branches in separate folders. Each agent gets its own folder, branch, local changes, and test cycle while still sharing the same GitHub repo.

Recommended local worktree root:

```text
C:\dev\kleentoditee-worktrees
```

This keeps active Node and Prisma work outside OneDrive, which reduces the `EPERM` file-lock problems this project has already seen.

## Create A Worktree

From the canonical repo:

```powershell
.\scripts\new-agent-worktree.ps1 -Agent claude -Lane finance-core
.\scripts\new-agent-worktree.ps1 -Agent cursor -Lane employee-tracker
.\scripts\new-agent-worktree.ps1 -Agent codex -Lane integration-qa
```

Then open the matching folder in the tool:

```text
C:\dev\kleentoditee-worktrees\claude-finance-core
C:\dev\kleentoditee-worktrees\cursor-employee-tracker
C:\dev\kleentoditee-worktrees\codex-integration-qa
```

## Check For Overlap

Run this from the canonical repo:

```powershell
.\scripts\check-agent-overlap.ps1
```

If two worktrees modify the same file, pause and merge one lane before continuing the other.

## Merge Flow

1. Agent finishes a lane in its worktree.
2. Agent verifies, commits, and pushes its branch.
3. Integration lane reviews the branch, runs CodeRabbit, and merges or rebases into `codex/consolidate-live-build`.
4. Other lanes rebase from `codex/consolidate-live-build` before continuing.

## Practical Ownership

- Keep schema changes rare and deliberate. `packages/db/prisma/schema.prisma` is a shared-file lock.
- Add dependencies in one lane at a time because `package-lock.json` is shared.
- API route mounting in `apps/api/src/app.ts` is shared.
- UI routes can usually move in parallel when they live under different folders.

## What Not To Do

- Do not have two tools open the same folder and branch for active coding.
- Do not let agents edit the same file at the same time.
- Do not merge by deleting someone else's changes.
- Do not run Prisma/client generation from multiple worktrees at once.

