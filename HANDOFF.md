# KleenToDiTee Payroll Pro Handoff

## Canonical workspace

- Repo path: `C:\Users\HomePC\OneDrive\Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0`
- Treat this repo as the single source of truth for active work.
- The old Playground copy is a backup only.

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

## Key local commands

- Start admin: `npm.cmd run dev:admin`
- Start API: `npm.cmd --workspace api run start`
- Generate Prisma client: `npm.cmd run db:generate`
- Push schema to local DB: `npm.cmd run db:push`
- Seed local DB: `npm.cmd run db:seed`
- Payroll helper test: `npm.cmd run test --workspace api`
- Full workspace lint: `npm.cmd run lint`
- Full workspace typecheck: `npm.cmd run typecheck`

## Important local env note

- Local SQLite should stay off the OneDrive repo path.
- Working `DATABASE_URL` for local dev:
  - `file:C:/Users/HomePC/AppData/Local/KleenToDiTeePayrollPro/dev.db`

## User workflow preference

- Rule: `finish then push`
- Meaning:
  - build locally until the slice is coherent
  - verify before claiming success
  - then make one clean commit and push

## Code review status

- Repo has `.coderabbit.yaml`
- CodeRabbit PR auto-review is configured at repo level
- Local `coderabbit` CLI was not installed in this session, so terminal review commands were not available yet

## Expected next-step verification after pulling

1. `npm.cmd run db:generate`
2. `npm.cmd run db:push`
3. `npm.cmd run test --workspace api`
4. `npm.cmd run typecheck`
5. `npm.cmd run lint`
6. Start admin and API, then test:
   - `/dashboard/payroll/periods`
   - create period
   - create draft run
   - finalize
   - export CSV
   - open paystub

### Verification log

- **2026-04-24:** Steps 1–5 passed on this machine. For step 6, **`db:seed` was run** (resets payroll + time + users; re-creates admin `admin@kleentoditee.local` / `ChangeMe!Dev123`). Seeded time entries use **April 2026** — use a **monthly** period `2026-04-01`–`2026-04-30` (or matching weekly/biweekly ranges from seed) or the draft run will be empty and finalize will fail. API smoke test: create period → `POST /payroll/runs` → finalize → export CSV → `GET /payroll/paystubs/:id` all succeeded for Maria Monthly. **Still do a quick pass in the browser** on `/dashboard/payroll/periods` when convenient (login + UI).
- **2026-04-24:** `start-platform.bat` was normalized to ASCII after `cmd.exe` broke on Unicode punctuation in the launcher banner/help text. Live verification from the canonical repo succeeded again: `http://127.0.0.1:8787/health` returned OK and `http://127.0.0.1:3000/login` returned 200 after launching outside the sandbox.

## If login breaks again

- Check API health: `http://127.0.0.1:8787/health`
- Check DB status: `http://127.0.0.1:8787/dev/db-status`
- Admin should use same-origin proxy in dev:
  - `http://127.0.0.1:3000/__kleentoditee_api/...`
