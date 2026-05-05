# Parallel AI Workflow

This project can move faster with Codex, Claude, and Cursor working at the same time, but not by editing the same files at the same time. The safe pattern is one branch and one worktree per agent.

> **North star:** continue this monorepo, harden it for production. **No rewrite, no microservices, no new modules before the P0 hardening track.** See [ROADMAP_PRODUCTION_HARDENING.md](ROADMAP_PRODUCTION_HARDENING.md).

## Why Worktrees

Git worktrees let one repository have multiple checked-out branches in separate folders. Each agent gets its own folder, branch, local changes, and test cycle while still sharing the same GitHub repo.

Recommended local worktree root:

```text
C:\dev\kleentoditee-worktrees
```

This keeps active Node and Prisma work outside OneDrive, which reduces the `EPERM` file-lock problems this project has already seen.

## Create A Worktree

From the canonical repo (paths with spaces — keep the working directory quoted):

```powershell
.\scripts\new-agent-worktree.ps1 -Agent claude -Lane finance-core
.\scripts\new-agent-worktree.ps1 -Agent cursor -Lane employee-tracker
.\scripts\new-agent-worktree.ps1 -Agent codex -Lane integration-qa
```

If PowerShell blocks the script with `cannot be loaded because running scripts is disabled on this system`, use the per-process unblock instead of changing system policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-agent-worktree.ps1 -Agent claude -Lane finance-core
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
3. The integration lane reviews the branch and merges via a small focused PR. Today, recent merges have gone **directly to `main`** as small PRs (see `git log main`); the historical multi-lane staging branch `codex/consolidate-live-build` still exists upstream and may still be used when several lanes need to land together. Confirm the target with the integration lead before opening a PR against it.
4. Other lanes rebase from whichever target was merged into (`main` for the small-PR flow; `codex/consolidate-live-build` for staging) before continuing.

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

