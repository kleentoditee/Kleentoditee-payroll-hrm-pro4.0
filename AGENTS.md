# AI Agent Rules

This repo is shared by Codex, Claude, Cursor, and the human owner. Follow these rules so multiple agents can work at the same time without overwriting each other.

## Source Of Truth

- Canonical repo: `C:\Users\HomePC\OneDrive\Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0`
- Main integration branch for current work: `codex/consolidate-live-build`
- Use `TASKS.md` before starting. Claim one lane and stay inside its ownership boundary.
- Prefer an isolated git worktree for every agent/lane. Do not switch the main repo between branches while another agent is active.

## Parallel Work Rule

- Do not edit the same file from two agents at the same time.
- If a task needs a shared file, add a short note in `TASKS.md` under `Shared File Locks` before editing.
- Shared files include:
  - `packages/db/prisma/schema.prisma`
  - `package.json`
  - `package-lock.json`
  - `.env.example`
  - `apps/api/src/app.ts`
  - shared route/service files used by more than one lane

## Agent Lanes

- Codex lane: integration, verification, CodeRabbit fixes, scripts, docs, shell/auth polish.
- Claude lane: larger domain design and backend-heavy feature slices.
- Cursor lane: focused UI screens, form polish, tracker/mobile screens, and scoped bug fixes.

The lane assignment can change, but file ownership must be explicit in `TASKS.md`.

## Finish Then Push

For every lane:

1. Work in a dedicated branch/worktree.
2. Keep edits inside the lane ownership.
3. Run the verification listed in `HANDOFF.md`.
4. Run CodeRabbit when available:

```powershell
wsl bash -lc "cd '/mnt/c/Users/HomePC/OneDrive/Documents/GitHub/Kleentoditee-payroll-hrm-pro4.0' && coderabbit review --agent -t uncommitted -c .coderabbit.yaml"
```

5. Commit only coherent, verified work.
6. Push the branch.
7. Update `TASKS.md` with status and next handoff notes.

## Merge Safety

- Pull or rebase from the integration branch before starting a lane.
- If a merge conflict appears, stop and resolve it deliberately. Do not delete another agent's work to make the conflict disappear.
- CodeRabbit review comments are suggestions to verify against the codebase before applying.
- Never commit `.env`, local DB files, `.next`, `node_modules`, or worktree folders.

