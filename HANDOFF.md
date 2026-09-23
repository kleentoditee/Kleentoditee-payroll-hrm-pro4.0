# KleenToDiTee Payroll Pro Handoff

## Canonical workspace

- Workspace path: `C:\Kleentoditee Payroll HRM`
- Treat this workspace as the single source of truth for active work.
- Do not use old duplicate payroll folders.

## Current focus

- Blueprint stream in progress: `Payroll Core`
- This slice adds:
  - pay periods
  - pay runs
  - frozen pay run items
  - printable paystubs
  - payroll CSV export
  - employee pay schedules (`monthly`, `weekly`, `biweekly`)
  - date-ranged time entries for non-monthly payroll

## Local dev quick links

| What | URL |
|------|-----|
| API health | http://127.0.0.1:8787/health |
| Admin login | http://127.0.0.1:3000/login |
| Users admin | http://127.0.0.1:3000/dashboard/users |
| Payroll periods | http://127.0.0.1:3000/dashboard/payroll/periods |
| Employee tracker | http://127.0.0.1:3001 |

`npm.cmd run start:local` is the normal startup path. It frees ports, waits for PostgreSQL, runs local schema sync, seeds demo/dev data, and starts API + admin + tracker. `dev:all` remains available for advanced/manual use after the database is ready.

## Key local commands

- Check database and next steps: `npm.cmd run db:doctor`
- Start the full local platform: `npm.cmd run start:local`
- Start admin only: `npm.cmd run dev:admin`
- Start API only: `npm.cmd run dev:api`
- Start tracker only: `npm.cmd run dev:tracker`
- Generate Prisma client: `npm.cmd run db:generate`
- Push schema to local DB: `npm.cmd run db:push`
- Seed local DB: `npm.cmd run db:seed`
- API tests: `npm.cmd run test:api`
- Full workspace lint: `npm.cmd run lint`
- Full workspace typecheck: `npm.cmd run typecheck`
- Full workspace build: `npm.cmd run build`
- Tracker login diagnostic (API must be running): `npm.cmd run check:tracker-login`

## Important local env note

- PostgreSQL is the production-style local default. Native PostgreSQL and Docker PostgreSQL are both supported.
- Working `DATABASE_URL` for local dev:
  - `postgresql://kleentoditee:kleentoditee@localhost:5432/kleentoditee?schema=public`

## User workflow preference

- Rule: `finish then push`
- Meaning:
  - build locally until the slice is coherent
  - verify before claiming success
  - then make one clean commit and push

## Parallel agent workflow

- Use `AGENTS.md`, `TASKS.md`, and `docs/AI-PARALLEL-WORKFLOW.md` for Codex/Claude/Cursor coordination.
- Each agent should work in its own git worktree and branch.
- Create worktrees from the canonical repo with:
  - `.\scripts\new-agent-worktree.ps1 -Agent claude -Lane finance-core`
  - `.\scripts\new-agent-worktree.ps1 -Agent cursor -Lane employee-tracker`
  - `.\scripts\new-agent-worktree.ps1 -Agent codex -Lane integration-qa`
- Check for overlapping edits with:
  - `.\scripts\check-agent-overlap.ps1`

## Code review status

- Repo has `.coderabbit.yaml`
- CodeRabbit PR auto-review is configured at repo level
- Local `coderabbit` CLI works through WSL as user `kleentoditee`.
- Local command:
  - `wsl bash -lc "cd '/mnt/c/Kleentoditee Payroll HRM/Kleentoditee-payroll-hrm-pro4.0' && coderabbit review --agent -t uncommitted -c .coderabbit.yaml"`

## Expected next-step verification after pulling

1. `npm.cmd run db:doctor`
2. `npm.cmd run db:push`
3. `npm.cmd run db:seed`
4. `npm.cmd run test:api`
5. `npm.cmd run typecheck`
6. `npm.cmd run lint`
7. `npm.cmd run build`
8. `npm.cmd run start:local`, then test:
   - `/dashboard/payroll/periods`
   - create period
   - create draft run
   - finalize
   - export CSV
   - open paystub

### Verification log

- **2026-04-24:** Steps 1–5 passed on this machine. For step 6, **`db:seed` was run** (resets payroll + time + users; re-creates admin `admin@kleentoditee.local` / `ChangeMe!Dev123`). Seeded time entries use **April 2026** — use a **monthly** period `2026-04-01`–`2026-04-30` (or matching weekly/biweekly ranges from seed) or the draft run will be empty and finalize will fail. API smoke test: create period → `POST /payroll/runs` → finalize → export CSV → `GET /payroll/paystubs/:id` all succeeded for Maria Monthly. **Still do a quick pass in the browser** on `/dashboard/payroll/periods` when convenient (login + UI).
- **2026-04-24:** `start-platform.bat` was normalized to ASCII after `cmd.exe` broke on Unicode punctuation in the launcher banner/help text. Live verification from the canonical repo succeeded again: `http://127.0.0.1:8787/health` returned OK and `http://127.0.0.1:3000/login` returned 200 after launching outside the sandbox.
- **2026-04-24 (integration):** After merging `agent/cursor/employee-tracker` on `agent/codex/integration-qa`, `npm run db:generate`, `typecheck`, `lint`, `test --workspace api`, and full `build` (admin, employee-tracker, api) passed. New schema needs `db:push` and **`db:seed`** adds `maria.tracker@kleentoditee.local` (same password as admin) for `/time/self/*` and port **3001** tracker. Browser smoke of tracker: **optional**; payroll periods flow unchanged.

## If login breaks again

- Check API health: `http://127.0.0.1:8787/health`
- Check DB status: `http://127.0.0.1:8787/dev/db-status`
- Employee tracker: `npm.cmd run check:tracker-login` (uses seed tracker email by default; set `TRACKER_EMAIL` / `TRACKER_PASSWORD` if needed)
- Admin should use same-origin proxy in dev:
  - `http://127.0.0.1:3000/__kleentoditee_api/...`
