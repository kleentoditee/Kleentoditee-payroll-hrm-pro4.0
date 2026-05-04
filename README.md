# KleenToDiTee Payroll HRM Pro 4.0

This repository (`Kleentoditee-payroll-hrm-pro4.0`) is the **active** KleenToDiTee platform — npm workspaces monorepo with the admin console, employee tracker, and Hono API. **`TRADE-DESK-SYSTEM` is a different project — run `npm` only here.**

> **North star:** continue this monorepo, harden it for production, **no rewrite, no microservices, no new modules before hardening**. See [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md) for priorities.

---

## Quickstart (Windows, the supported path)

The repo is developed on Windows under OneDrive. The flow below assumes `cmd.exe` / Explorer; PowerShell tips are in [§ PowerShell quirks](#powershell-quirks).

1. **Install Node 20+.** `node --version` must report ≥ 20.
2. **Open the repo in Explorer.** The canonical path is:

   ```text
   C:\Users\HomePC\OneDrive\Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0
   ```

   The path contains a space (`Documents\GitHub\…` is fine, but anything you copy that contains spaces must be **double-quoted**).
3. **Double-click `start-platform.bat`** (in the repo root). It:
   - checks Node 20+,
   - copies `.env.example` → `.env` if missing,
   - runs `npm install` when needed,
   - runs `db:sync` (`db:generate` + `db:push`),
   - then `dev:all` (API on `:8787` + admin on `:3000`).
4. **First-time only — seed the database.** Stop the platform (Ctrl+C), then double-click `seed-database.bat` (or run `npm run db:seed` from the repo root). Seed **wipes** demo tables and creates:
   - `admin@kleentoditee.local` / `ChangeMe!Dev123` (override with `SEED_ADMIN_*` in `.env` before seeding).
5. **Start the employee tracker (port 3001) when needed.** It's not part of `dev:all`. Open another terminal and run `npm run dev:tracker`.

**Command-line equivalent of `start-platform.bat`:** `npm run boot` from the repo root.

### Local URLs

| What | URL |
|------|-----|
| Admin login | http://localhost:3000/login |
| Admin dashboard | http://localhost:3000/dashboard |
| Audit log | http://localhost:3000/dashboard/audit |
| Employee tracker (separate dev server) | http://localhost:3001 |
| API health | http://127.0.0.1:8787/health |
| Dev DB status (non-prod only) | http://127.0.0.1:8787/dev/db-status |
| Same-origin proxy in `next dev` | http://localhost:3000/__kleentoditee_api/... |

---

## Database

By default the platform runs on **SQLite** for local dev (`DATABASE_URL=file:./dev.db` per [.env.example](.env.example)). No Docker required.

**PostgreSQL is documented as the production target** but is not the local default today. To opt in for local testing, install Docker Desktop, run `docker compose up -d` from the repo root, and set `DATABASE_URL` to the PostgreSQL URL shown in [.env.example](.env.example) before running `npm run db:push`.

The migration to a Postgres-first workflow with `prisma migrate` is tracked in [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md) under priority **P0-3**.

---

## Available `npm` scripts (verified against `package.json`)

Database:

| Script | What it does |
|--------|--------------|
| `npm run db:generate` | Run Prisma `generate` in `packages/db`. |
| `npm run db:push` | `prisma db push` — applies schema to the configured DB without a migration history. |
| `npm run db:push:loss` | Same with `--accept-data-loss`. Use only when you understand the consequences. |
| `npm run db:seed` | Reset and seed demo data (admin user, sample employees, templates, time entries). |
| `npm run db:studio` | Open Prisma Studio. |
| `npm run db:sync` | `db:generate` then `db:push`. |

Dev servers:

| Script | What it does |
|--------|--------------|
| `npm run dev` / `npm run dev:admin` | Admin web only on `:3000`. |
| `npm run dev:tracker` | Employee tracker only on `:3001`. |
| `npm run dev:api` | Hono API only on `:8787`. |
| `npm run dev:all` | API + admin together (Ctrl+C stops both). Tracker is **not** included. |
| `npm run boot` | `db:sync` then `dev:all`. |

Workspace checks:

| Script | What it does |
|--------|--------------|
| `npm run build` | Builds admin-web, employee-tracker, and api. |
| `npm run lint` | Runs `lint` in every workspace that defines one. |
| `npm run typecheck` | Runs `typecheck` in every workspace that defines one. |
| `npm run test --workspace api` | Runs the API package's `tsx --test` suite (currently `payroll-utils.test.ts`). |

> Smoke-test scripts (`smoke:core` / `smoke:admin` / `smoke:all`) referenced in older docs are **not** wired into `package.json` on this branch. The supporting scripts under `scripts/smoke-finance-{a,b,c}.mjs` exist but are not exposed via `npm`. See [docs/DOC_DRIFT_FINDINGS.md](docs/DOC_DRIFT_FINDINGS.md) and [docs/QA_TEST_MATRIX.md](docs/QA_TEST_MATRIX.md) for the planned test layer.

---

## PowerShell quirks

PowerShell on Windows ships with the `Restricted` execution policy by default. Most commands here use `npm.cmd` which side-steps that. If a `.ps1` script is blocked, the recommended approach is **per-process unblock**, not changing system policy:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\new-agent-worktree.ps1 -Agent claude -Lane finance-core
```

When typing commands by hand:

- Prefer **`npm.cmd run <script>`** (works in PowerShell, cmd.exe, and most CI shells).
- For paths with spaces, use **double quotes**: `cd "C:\Users\HomePC\OneDrive\Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0"`.
- Stop dev servers with Ctrl+C; if a port is stuck, run `scripts\kill-dev-ports.ps1` (PowerShell) or `restart-platform.bat` (which kills `:3000` and `:8787` first).

---

## Troubleshooting: Prisma `EPERM` under OneDrive

Storing the repo under **OneDrive** often causes `EPERM: operation not permitted, rename` when `prisma generate` replaces `query_engine-windows.dll.node`, because OneDrive sync locks files in `node_modules`.

In order of preference:

1. **Stop the platform** (Ctrl+C) and close any other terminals open in this folder.
2. Double-click **`repair-prisma-generate.bat`**. It can stop all `node.exe` processes if needed.
3. If it still fails, **move the project off OneDrive** to a path with no `OneDrive` in it (e.g. `C:\dev\Kleentoditee-payroll-hrm-pro4.0`). Helper script: double-click `scripts\copy-project-to-c-dev.bat` (uses robocopy and skips `node_modules` / `.next`). Recreate `.env` in the new location and run `npm install` then `start-platform.bat`.

The yellow Prisma message about `package.json#prisma` is a deprecation notice only — it is not the cause of EPERM.

---

## Login keeps failing / "no user" after seed

The yellow "run db:seed" line on the login page is *generic* help, not a status check. To diagnose:

- On the login screen, click **Check database (users)**, **or**
- Open `http://127.0.0.1:8787/dev/db-status` while the API is running.

If `userCount` is `0`, the seed and the API are pointed at different databases (typical cause: seed was run while dev servers were still using the SQLite file, or two copies of the project exist with different `.env`). **Stop** the platform, run `seed-database.bat` (or `npm run db:seed`) from the **repo root**, then start the platform again.

If `userCount` is `1+` but login still fails, the email/password are wrong — check `SEED_ADMIN_*` in `.env` before re-seeding.

### Last-resort: emergency dev login

If you need to get into the admin during local dev only:

1. Run `enable-emergency-login.bat` (or set `ALLOW_DEV_EMERGENCY_LOGIN=1` in the repo root `.env`).
2. Restart the API and confirm `[api] Emergency passwordless login is ON` in its console.
3. Use the **Emergency** button on the login page.
4. **Remove the setting before any deploy.** The route is gated by `NODE_ENV !== "production"` and the env flag, but tracking it as code-level production exclusion is on the security checklist (see [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) item D-1).

JWTs are currently stored in `localStorage` (development only). Replacing this with httpOnly cookie sessions is tracked in [docs/AUTH_SESSION_MIGRATION_PLAN.md](docs/AUTH_SESSION_MIGRATION_PLAN.md).

---

## Legacy static-app prototype (separate project)

> **This is not the active platform.** It is the original payroll PWA prototype that lives under a different `Playground 4` path. It is documented here only because some long-standing scripts and notes still reference it. The monorepo above is the only thing you should be running for active development.

```powershell
cd "C:\Users\HomePC\OneDrive\Documents\Playground 4\kleentoditee-payroll-pro"
python -m http.server 8081
```

Then open `http://localhost:8081`. Or double-click `start-local.bat` inside that legacy folder. Data lives in browser `localStorage` on the device.

If you only see the legacy app on `:8081`, you are in the wrong folder — the active platform is the path under `Documents\GitHub\Kleentoditee-payroll-hrm-pro4.0`.

---

## Documentation map

Read these in order if you are new:

| Doc | What it answers |
|-----|-----------------|
| [docs/current-system-inventory.md](docs/current-system-inventory.md) | What apps, routes, and models exist today. |
| [docs/ROADMAP_PRODUCTION_HARDENING.md](docs/ROADMAP_PRODUCTION_HARDENING.md) | Priority order for hardening; explicit non-goals. |
| [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md) | Concrete security controls with code anchors. |
| [docs/AUTH_SESSION_MIGRATION_PLAN.md](docs/AUTH_SESSION_MIGRATION_PLAN.md) | Phased plan to move off localStorage JWT. |
| [docs/QA_TEST_MATRIX.md](docs/QA_TEST_MATRIX.md) | Domain × layer test coverage and gaps. |
| [docs/DOC_DRIFT_FINDINGS.md](docs/DOC_DRIFT_FINDINGS.md) | Known doc-versus-code mismatches. |
| [HANDOFF.md](HANDOFF.md) | Human-to-human handoff notes for the canonical workspace. |
| [TASKS.md](TASKS.md) | Multi-agent coordination board. |
| [docs/AI-PARALLEL-WORKFLOW.md](docs/AI-PARALLEL-WORKFLOW.md) | How parallel agents share this repo via worktrees. |
| [docs/PR-LOCAL-DEV-HANDOFF.md](docs/PR-LOCAL-DEV-HANDOFF.md) | Reference PR body for the local-dev hardening change. |

> **Note on roadmap docs:** the security/roadmap/QA docs above land via [PR #4](https://github.com/kleentoditee/Kleentoditee-payroll-hrm-pro4.0/pull/4); links resolve once that PR merges or while reviewing it.

---

## Platform blueprint

Research-backed planning lives under:

- `docs/superpowers/specs/2026-04-20-kleentoditee-platform-blueprint.md`
- `docs/superpowers/plans/2026-04-20-kleentoditee-platform-master-plan.md`
- `docs/architecture/2026-04-20-platform-tech-decisions.md`
- `docs/research/2026-04-20-claude-prebuild-review.md`

These predate the production-hardening track and may name targets (Postgres-first, S3 storage, Auth.js/WorkOS) that are not yet integrated. Treat them as direction, not current state.
