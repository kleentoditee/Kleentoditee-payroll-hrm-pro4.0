# KleenToDiTee Payroll HRM Pro 4.0 — Handoff

> **North star:** continue this monorepo and **harden it** for production. **No rewrite, no microservices, no new modules before the P0 hardening track.** See [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md).

## Canonical workspace

- Repo path: `C:\Users\HomePC\OneDrive\Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0` (path contains a space — quote it on every shell).
- Treat this repo as the single source of truth for active work.
- The old `Playground 4\kleentoditee-payroll-pro` copy is a **legacy static-app prototype**, not the active platform. Read [README.md](README.md) for the boundary between the two.

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

(`dev:all` starts API + admin only; run `npm run dev:tracker` in another terminal for port **3001**.)

## Key local commands

These map to scripts that **actually exist** in [package.json](package.json) on `main`. `npm.cmd` is preferred over bare `npm` so PowerShell does not block on its execution policy.

- Start admin: `npm.cmd run dev:admin`
- Start API (workspace): `npm.cmd run dev:api` (the `api` package's `start` script also works: `npm.cmd --workspace api run start`)
- Run API + admin together: `npm.cmd run dev:all` (does **not** include the employee tracker)
- Start employee tracker: `npm.cmd run dev:tracker`
- One-shot boot from cold: `npm.cmd run boot` (runs `db:sync`, then `dev:all`)
- Generate Prisma client: `npm.cmd run db:generate`
- Push schema to local DB: `npm.cmd run db:push`
- Seed local DB: `npm.cmd run db:seed`
- Payroll helper test: `npm.cmd run test --workspace api` (currently runs `payroll-utils.test.ts` only)
- Full workspace lint: `npm.cmd run lint`
- Full workspace typecheck: `npm.cmd run typecheck`
- Full build: `npm.cmd run build`

> Smoke-test scripts (`smoke:core`, `smoke:admin`, `smoke:all`) referenced in older notes are **not** wired into `package.json` on `main`. Treat them as planned, not current. The supporting `scripts/smoke-finance-{a,b,c}.mjs` files exist but have no `npm` entry point. See [docs/QA_TEST_MATRIX.md](docs/QA_TEST_MATRIX.md) and [docs/DOC_DRIFT_FINDINGS.md](docs/DOC_DRIFT_FINDINGS.md).

## Important local env note

- The repo lives under OneDrive, but Prisma's query-engine generation collides with OneDrive sync (EPERM). **Keep the SQLite DB file off the OneDrive path** even if the repo stays on it.
- Working `DATABASE_URL` for local dev (writes the DB to `%LocalAppData%`, which is **not** synced):
  - `file:C:/Users/HomePC/AppData/Local/KleenToDiTeePayrollPro/dev.db`
- If `prisma generate` keeps failing with `EPERM`, the durable fix is to copy the entire repo to a non-OneDrive path (e.g. `C:\dev\Kleentoditee-payroll-hrm-pro4.0`). See [README.md](README.md) § Troubleshooting and `scripts\copy-project-to-c-dev.bat`.

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
  - `wsl bash -lc "cd '/mnt/c/Users/HomePC/OneDrive/Documents/GitHub/Kleentoditee-payroll-hrm-pro4.0' && coderabbit review --agent -t uncommitted -c .coderabbit.yaml"`

## Expected next-step verification after pulling

These steps map 1:1 to scripts in `package.json` and to the lone `tsx --test` suite in `apps/api`:

1. `npm.cmd run db:generate`
2. `npm.cmd run db:push`
3. `npm.cmd run test --workspace api` (runs `apps/api/src/lib/payroll-utils.test.ts` only — there is no broader test runner today)
4. `npm.cmd run typecheck`
5. `npm.cmd run lint`
6. `npm.cmd run build` (builds admin-web, employee-tracker, and api)
7. Start admin and API (`npm.cmd run dev:all`), then manual-test:
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
- Admin should use same-origin proxy in dev:
  - `http://127.0.0.1:3000/__kleentoditee_api/...`
