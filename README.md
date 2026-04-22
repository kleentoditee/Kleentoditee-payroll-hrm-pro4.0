# Kleentoditee Payroll Pro

**This repo** (`kleentoditee-payroll-pro`) is the KleenToDiTee platform. **`TRADE-DESK-SYSTEM` is a different project** — run npm only here.

**From a fresh machine, use one entry point:** double-click **`start-platform.bat`** in the repo root. It checks **Node 20+**, creates **`.env`** from `.env.example` if needed, runs **`npm install`** when required, then **`db:sync`** and **`dev:all`**. You only need a separate `winget` install if Node is missing (the script prints the exact command). First-time users: double-click **`seed-database.bat`** (or run `npm run db:seed` in this folder). Seed **wipes** demo tables and creates the admin (see below).

**Command-line equivalent:** `npm run boot` (same as the batch file after dependencies exist).

**If you still cannot sign in** after trying the health checks, copy the project to a path **outside** OneDrive (e.g. `C:\dev\...`), re-run `npm install` and `db:seed`, then start the platform again. In development only, the login page has a last-resort **emergency** button: run **`enable-emergency-login.bat`** in the repo root (or set `ALLOW_DEV_EMERGENCY_LOGIN=1` in the repo root `.env`), restart the API, confirm the log line `[api] Emergency passwordless login is ON`, then use the button; remove the setting before any real deployment.

This is a replacement payroll app with a more professional workflow and mobile-friendly editing.

## Highlights

- Cleaner dashboard for monthly payroll status
- Pop-up editors for employees and timesheets so editing works well on phones
- Payroll calculations for gross, deductions, and net pay
- Payroll run history, CSV export, JSON backup, and print support
- PWA support for install on phones when served from `localhost` or HTTPS

## Run locally

### Legacy payroll prototype (static PWA)

```powershell
cd "C:\Users\HomePC\OneDrive\Documents\Playground 4\kleentoditee-payroll-pro"
python -m http.server 8081
```

Then open `http://localhost:8081`.

You can also double-click `start-local.bat` inside this folder to launch the server and open the app automatically.

If you used an older version of this app before, use the new `8081` address so the browser does not keep serving the old cached files.

### Platform upgrade (monorepo — Phase 1 shell + auth + audit)

**1. Environment**

Copy `.env.example` to `.env` in the repo root. By default **`DATABASE_URL` uses SQLite** (`file:./dev.db`) so you do **not** need Docker for local dev.

**Optional — PostgreSQL instead:** install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then from the repo root run `docker compose up -d` and set `DATABASE_URL` in `.env` to the PostgreSQL URL shown in `.env.example`.

**2. Install, schema, seed**

```powershell
cd "C:\Users\HomePC\OneDrive\Documents\Playground 4\kleentoditee-payroll-pro"
npm install
npm run db:push
npm run db:seed
```

After pulling code that changes `packages/db/prisma/schema.prisma`, run **`npm run db:push`** again (and **`npm run db:seed`** if you want fresh templates + admin user — seed **wipes** timesheets, employees, templates, users, and audit).

**Time / timesheets API:** `GET/POST /time/entries`, `POST /time/preview`, etc. (requires auth). Admin UI: `/dashboard/time/entries`.

**4. Run API + admin in one shot**

Double-click **`start-platform.bat`** in the repo root (or run **`restart-platform.bat`** to kill ports 3000/8787 first, then start).

Or from PowerShell **in this folder only**:

```powershell
cd "C:\Users\HomePC\OneDrive\Documents\Playground 4\kleentoditee-payroll-pro"
npm install
npm run boot
```

`boot` = **`db:sync`** (`db:generate` + **`db:push`**) + **`dev:all`**. One window runs **both** servers; **Ctrl+C** stops both.

To sync the database **without** starting servers: `npm run db:sync`

- **Admin console:** [http://localhost:3000](http://localhost:3000) → redirects to **login**, then **dashboard**. Audit log: `/dashboard/audit`. In `next dev`, the browser talks to the API at **`/__kleentoditee_api/...` on port 3000** (rewritten to :8787) so you are not bitten by CORS. **Do not** set `NEXT_PUBLIC_API_URL` in the repo root `.env` for local dev if you use that pattern (see `.env.example`).
- **Seeded admin:** `admin@kleentoditee.local` / `ChangeMe!Dev123` (override with `SEED_ADMIN_*` in `.env` before `db:seed`).
- **First user only:** if you skip `db:seed`, `POST /auth/register` with JSON `{ "email", "password", "name" }` works while the user table is empty.
- **Employee tracker stub:** `npm run dev:tracker` → [http://localhost:3001](http://localhost:3001)
- **API health (no auth):** [http://localhost:8787/health](http://localhost:8787/health)

JWTs are stored in `localStorage` for development only; replace with httpOnly cookies + production auth when you harden the stack.

Research gate and stack decisions: `docs/research/2026-04-20-claude-prebuild-review.md`, `docs/architecture/2026-04-20-platform-tech-decisions.md`.

## How editing works

- `New employee` opens the employee editor
- `New timesheet` opens the timesheet editor
- In `Employees`, press `Edit` on a card to change that employee
- In `Timesheets`, press `Edit` on a card to change that timesheet

The dashboard cards themselves are read-only summaries, so you do not type directly into them.

## Storage

- **Legacy payroll app (port 8081):** data stays in **browser `localStorage`** on that device and origin.
- **New platform (ports 3000 / 8787):** by default, the database file is **SQLite** (`dev.db` under `packages/db/prisma/`, per `DATABASE_URL` in `.env`). **Optional:** point `DATABASE_URL` at PostgreSQL and use `docker compose up -d` (see `.env.example`). The admin UI keeps a **dev JWT** in `localStorage` (replace with secure cookies in production).

## Troubleshooting: Prisma `EPERM` / query engine rename

Storing the repo under **OneDrive** (e.g. `OneDrive\Documents\...`) often causes `EPERM: operation not permitted, rename` when `prisma generate` replaces `query_engine-windows.dll.node`, because the sync process locks files in `node_modules`.

1. **Stop** `start-platform` (Ctrl+C) and close other terminals in this folder.
2. Double-click **`repair-prisma-generate.bat`**. If it asks, you can type **Y** to stop all `node.exe` processes (closes every Node app on the PC) so nothing holds the file open.
3. If it still fails, **move the whole project** to a path that is *not* synced, e.g. `C:\dev\kleentoditee-payroll-pro`, then `npm install` and `start-platform.bat` again.

**Definitive fix for EPERM that keeps coming back:** do not keep a Node / `node_modules` tree under **OneDrive** (Documents in “synced” mode counts). In File Explorer, copy the `kleentoditee-payroll-pro` folder to `C:\dev\` (or `D:\projects\`) so the path has **no** `OneDrive` in it, then from that new folder run `npm install` and `start-platform.bat`. OneDrive renames/locks files while Prisma replaces the query engine, which is what triggers the error.

**Helper (Windows):** double-click `scripts\copy-project-to-c-dev.bat` to robocopy the repo to `C:\dev\kleentoditee-payroll-pro` without `node_modules` and `.next`, then in that new folder run `npm install` and `start-platform.bat` (and copy or recreate `.env` if you rely on a local one).

The yellow Prisma message about `package.json#prisma` is a deprecation notice only; it is not the cause of EPERM.

**Login keeps failing / “no user” after seed:** the yellow “run db:seed” line on the login page is *generic* help, not a status check. On the login screen use **Check database (users)**, or open `http://localhost:8787/dev/db-status` (with the API running). If `userCount` is `0`, seed and the API are not using the same database (usually: seed while the dev servers were still running, or two copies of the project). **Stop** `start-platform`, run `seed-database.bat` or `npm run db:seed` from the **repo root**, then start again. If `userCount` is `1+` but login still fails, the email/password are wrong (check `SEED_ADMIN_*` in `.env` before re-seeding).

## Platform Blueprint

Research-backed planning documents for the next-generation platform live here:

- `docs/superpowers/specs/2026-04-20-kleentoditee-platform-blueprint.md`
- `docs/superpowers/plans/2026-04-20-kleentoditee-platform-master-plan.md`
