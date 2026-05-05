# Multi-Agent Task Board

Use this file as the live coordination board for Codex, Claude, Cursor, and the human owner.

> **North star:** continue this monorepo, **harden it for production**. **No rewrite, no microservices, no new modules before the P0 hardening track.** See [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md).

## Current Integration Branch

- **Primary integration target: `main`.** Recent merges have been small, focused PRs against `main` directly (see `git log main`).
- The legacy multi-lane integration branch `codex/consolidate-live-build` still exists upstream and is the historical reference for the active lanes table below; new work should target `main` via small PRs unless a coordinator says otherwise.
- Rule: **finish locally, verify, commit, push** (one focused PR per concern).
- CodeRabbit: local CLI works through WSL; rerun after rate limits clear.

## Active Lanes

| Lane | Agent | Branch Pattern | Worktree Path | Owned Areas | Status |
| --- | --- | --- | --- | --- | --- |
| Integration QA | Codex | `agent/codex/integration-qa` | `C:\dev\kleentoditee-worktrees\codex-integration-qa` | docs, scripts, auth/shell polish, CodeRabbit fixes, final verification | Finance Tasks 9 + 10, tracker, and CodeRabbit fix pass pushed; CodeRabbit rerun waits on service rate limit |
| Finance Core | Claude | `agent/claude/finance-core` | `C:\dev\kleentoditee-worktrees\claude-finance-core` | finance API/UI, finance models, export/report logic | Tasks 9 + 10 merged; pull `codex/consolidate-live-build` before next slice |
| Employee Tracker | Cursor | `agent/cursor/employee-tracker` | `C:\dev\kleentoditee-worktrees\cursor-employee-tracker` | `apps/employee-tracker/**`, tracker UX, mobile employee flows | On `codex/consolidate-live-build`; pull to refresh worktree |

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
npm.cmd run build
```

> Note: `npm run test --workspace api` runs only `apps/api/src/lib/payroll-utils.test.ts`. There is no broader test runner today. Smoke-test scripts named `smoke:core`, `smoke:admin`, `smoke:all` referenced in older PR descriptions are **not** wired into `package.json` on `main`. See [docs/QA_TEST_MATRIX.md](docs/QA_TEST_MATRIX.md).

3. Run CodeRabbit when available:

```powershell
wsl bash -lc "cd '/mnt/c/Users/HomePC/OneDrive/Documents/GitHub/Kleentoditee-payroll-hrm-pro4.0' && coderabbit review --agent -t uncommitted -c .coderabbit.yaml"
```

4. Commit with a clear message.
5. Push your branch.
6. Update this board with what changed, what passed, and what is next.

## Suggested Next Parallel Slices (production hardening track)

These follow the priority order in [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md). Pick from the top; hold P1 work until P0 is in flight.

| Slice | Priority | Best Agent | Why |
| --- | --- | --- | --- |
| GitHub Actions CI for `typecheck` / `lint` / `build` / `test --workspace api` | P0-1 | Codex (Integration QA) | Unblocks every other PR's "green" claim; small, contained config change. |
| Validate `JWT_SECRET` length and refuse SQLite `DATABASE_URL` in production boot | P0-2 + P0-3 | Codex / Claude | Tiny edit to `apps/api/src/env.ts`; closes [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) S-1, S-2. |
| Register `/auth/dev-emergency` only when `NODE_ENV !== "production"` (compile-time exclusion, not runtime 403) | P0-2 | Claude | Closes [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) D-1; one route registration change. |
| httpOnly cookie session + CSRF (Phase 1 of [docs/AUTH_SESSION_MIGRATION_PLAN.md](docs/AUTH_SESSION_MIGRATION_PLAN.md)) | P0-2 | Claude / Codex pair | Larger; needs coordinated change in API and both web clients. Confirm CSRF strategy with the human owner first. |
| Postgres + `prisma migrate` workflow for non-local environments | P0-3 | Codex | Schema migration files + docker-compose updates; do **not** rip out SQLite for local dev. |
| S3-compatible object storage for HR documents | P0-4 | Claude | Replace `apps/api/src/lib/employee-files.ts` filesystem path with R2/S3 client; add MIME and size limits. |
| Expose or remove `scripts/smoke-finance-{a,b,c}.mjs` | doc-aligned | Codex | Closes drift finding 1 in [docs/DOC_DRIFT_FINDINGS.md](docs/DOC_DRIFT_FINDINGS.md). |
| Admin/tracker readability fixes | P1 (defer) | Cursor | Hold until CI and auth/storage hardening are in flight. |
