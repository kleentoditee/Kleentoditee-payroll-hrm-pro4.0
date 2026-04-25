# Multi-Agent Task Board

Use this file as the live coordination board for Codex, Claude, Cursor, and the human owner.

## Current Integration Branch

- Branch: `codex/consolidate-live-build`
- Rule: finish locally, verify, commit, push.
- CodeRabbit: local CLI works through WSL; rerun after rate limits clear.

## Active Lanes

| Lane | Agent | Branch Pattern | Worktree Path | Owned Areas | Status |
| --- | --- | --- | --- | --- | --- |
| Integration QA | Codex | `agent/codex/integration-qa` | `C:\dev\kleentoditee-worktrees\codex-integration-qa` | docs, scripts, auth/shell polish, CodeRabbit fixes, final verification | Ready |
| Finance Core | Claude | `agent/claude/finance-core` | `C:\dev\kleentoditee-worktrees\claude-finance-core` | finance API/UI, finance models, export/report logic | Tasks 9 + 10 shipped on branch (4 commits: 10A invoices/bills, 10B payments, 10C expenses/deposits); ready for Task 11 (banking & accounting controls) next |
| Employee Tracker | Cursor | `agent/cursor/employee-tracker` | `C:\dev\kleentoditee-worktrees\cursor-employee-tracker` | `apps/employee-tracker/**`, tracker UX, mobile employee flows | Ready |

## Shared File Locks

Only one lane should edit these at a time. Add a row before touching a shared file.

| File | Locked By | Reason | Status |
| --- | --- | --- | --- |
| `packages/db/prisma/schema.prisma` | None | Shared data model | Free |
| `package.json` / `package-lock.json` | None | Dependencies/scripts | Free |
| `apps/api/src/app.ts` | None | Route mounting | Free |

## Lane Start Checklist

1. Run `git status -sb` in your worktree.
2. Confirm your branch and ownership in this file.
3. Pull/rebase from `codex/consolidate-live-build`.
4. Run `npm.cmd run db:generate` if schema changed recently.
5. Work only inside your owned areas unless you have a shared file lock.

## Lane Finish Checklist

1. Run focused checks for the lane.
2. Run workspace checks when the lane touches shared code:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace api
```

3. Run CodeRabbit when available:

```powershell
wsl bash -lc "cd '/mnt/c/Users/HomePC/OneDrive/Documents/GitHub/Kleentoditee-payroll-hrm-pro4.0' && coderabbit review --agent -t uncommitted -c .coderabbit.yaml"
```

4. Commit with a clear message.
5. Push your branch.
6. Update this board with what changed, what passed, and what is next.

## Suggested Next Parallel Slices

| Slice | Best Agent | Why |
| --- | --- | --- |
| Finance Task 11 — banking & accounting controls (bank txns, rules, reconcile, journal entries) | Claude | Builds on the finance domain just shipped |
| Employee tracker mobile time submit flow | Cursor | Focused frontend/mobile UX |
| Cross-app QA, CodeRabbit pass on Tasks 9 + 10, merge to integration | Codex | Integration and verification lane |

