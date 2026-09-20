# Project Cleanup Audit

Branch: `cleanup/project-workflow-audit`

PR title: `Cleanup: project audit, duplicate removal, and reliable workflow verification`

## Monorepo structure

- `apps/admin-web`: Next.js admin console on `http://localhost:3000`.
- `apps/employee-tracker`: Next.js employee tracker on `http://localhost:3001`.
- `apps/api`: Hono API on `http://localhost:8787`.
- `packages/db`: Prisma schema, generated client wrapper, database scripts, seed.
- `packages/ui`: placeholder shared UI package.
- `scripts`: local Windows/dev helper scripts and smoke checks.
- `.github/workflows/ci.yml`: GitHub Actions baseline with Node 20 and PostgreSQL service.

## Current apps and ports

| App | Command | Port |
| --- | --- | --- |
| Admin web | `npm run dev:admin` | `3000` |
| Employee tracker | `npm run dev:tracker` | `3001` |
| API | `npm run dev:api` | `8787` |
| All apps | `npm run dev:all` | `3000`, `3001`, `8787` |

`dev:all` is for advanced/manual use. Normal local startup is `npm run start:local`.

## Current package scripts

Root workflow scripts:

- `db:doctor`: prints `.env`, redacted `DATABASE_URL`, PostgreSQL reachability, Docker CLI/running state, and next steps.
- `db:check`: fails fast if PostgreSQL is not reachable.
- `db:wait`: waits for PostgreSQL to become reachable.
- `db:up`: starts Docker Compose PostgreSQL when Docker Desktop is installed/running.
- `db:push`: local/prototype schema sync against PostgreSQL using `--skip-generate` to avoid Windows Prisma engine file-lock churn.
- `db:seed`: checks PostgreSQL first, then seeds demo/dev data.
- `dev:ports:free`: clears ports `3000`, `3001`, and `8787` using the existing PowerShell helper.
- `start:local`: runs `dev:ports:free`, `db:wait`, `db:push`, `db:seed`, then `dev:all`.
- `typecheck`, `lint`, `test`, `test:unit`, `test:smoke`, `build`, `ci`.

Removed aliases:

- `boot`: stale alias that skipped seed and was still shown in old UI/docs.
- `db:sync`: duplicate alias that did not match the reliable local startup flow.
- `setup:windows`: duplicate first-run alias; documented flow is now explicit.

## Current database workflow

Expected local PostgreSQL URL:

```text
postgresql://kleentoditee:kleentoditee@localhost:5432/kleentoditee?schema=public
```

Supported local database paths:

- Docker PostgreSQL: `npm run db:up`, `npm run db:wait`, `npm run start:local`.
- Native Windows PostgreSQL: start the Windows service, confirm `.env` matches the native install, then `npm run db:doctor`, `npm run start:local`.

PostgreSQL is the main schema provider. SQLite remains only as an explicit offline fallback via `packages/db/prisma/schema.sqlite.prisma`.

## Current startup workflow

Recommended:

```powershell
cd "C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0"
npm run db:doctor
npm run start:local
```

If PowerShell blocks `npm.ps1`, use:

```powershell
npm.cmd run db:doctor
npm.cmd run start:local
```

`start:local` does not launch app servers unless PostgreSQL wait, schema push, and seed succeed.

## Current CI workflow

`.github/workflows/ci.yml`:

- checks out code
- sets up Node 20 with npm cache
- runs `npm ci`
- runs Prisma generate
- starts PostgreSQL service
- deploys migrations when migration folders exist
- runs typecheck
- runs lint
- runs unit tests
- runs build

Local `npm run ci` runs Prisma generate, typecheck, lint, API tests, and build. If Windows reports `EPERM` while replacing Prisma's query engine DLL, stop dev servers and rerun `repair-prisma-generate.bat` or `npm run dev:ports:free` before retrying.

## Current documentation files

Reviewed:

- `README.md`
- `docs/LOCAL_DEVELOPMENT_WINDOWS.md`
- `docs/current-system-inventory.md`
- `docs/PR-LOCAL-DEV-HANDOFF.md`
- `docs/employee-tracker-sharing.md`
- `docs/hr-employee-records.md`
- `docs/staff-requests.md`
- `docs/staff-hub-schedule-messages-rewards.md`
- `docs/user-role-administration.md`
- `docs/AI-PARALLEL-WORKFLOW.md`
- `docs/coderabbit-report-for-chatgpt-review.md`

Expected Claude docs that are not currently present:

- `docs/ROADMAP_PRODUCTION_HARDENING.md`
- `docs/SECURITY_CHECKLIST.md`
- `docs/AUTH_SESSION_MIGRATION_PLAN.md`
- `docs/QA_TEST_MATRIX.md`
- `docs/DOC_DRIFT_FINDINGS.md`

Documentation drift fixed in this cleanup:

- `README.md` now points to `db:doctor` and `start:local`.
- `docs/LOCAL_DEVELOPMENT_WINDOWS.md` now shows the `dev:ports:free` step inside `start:local`.
- `docs/current-system-inventory.md` now reflects PostgreSQL and actual smoke/test scripts.
- `docs/PR-LOCAL-DEV-HANDOFF.md` no longer recommends `npm run boot` or `start-local.bat` as the current app startup path.
- Admin login help now recommends `npm run start:local` instead of `npm run boot`.

## Suspected duplicate files

- Root static prototype files: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`.
  - Status: not removed. They appear to be the old static payroll prototype. They are not part of the current monorepo startup path, but they may still be useful historical reference or rollback material.
- `start-platform.bat` and `restart-platform.bat`.
  - Status: kept. They are Windows convenience launchers and now align with the approved workspace path.
- `seed-database.bat`.
  - Status: kept. It is a clear Windows wrapper for the destructive demo seed.

## Suspected dead files

- `PUSH-ME.txt`.
  - Status: not removed. It may be user handoff material.
- `HANDOFF.md`, `TASKS.md`, `AGENTS.md`.
  - Status: not removed. They appear to be active coordination documents in the current multi-agent workflow.
- `.claude/`.
  - Status: not removed. Local tool configuration may be user-specific.

## Suspected broken scripts

- Restored `start-local.bat` as a guarded legacy-only launcher. It now requires typing `LEGACY` before starting the old static Python app on port `8081`.
- Removed root npm `boot`: it did not run the seed step and was misleading in login/help docs.
- Removed root npm `db:sync`: duplicate partial database workflow; `start:local` is the reliable flow.
- Removed root npm `setup:windows`: duplicate wrapper for install/start; docs now show explicit `npm.cmd install`, `db:doctor`, and `start:local`.

## Files safe to delete

Deleted in this cleanup:

- Ignored local dev logs: `admin-dev*.log`, `api-dev.log`, `api-start*.log`, `dev-all*.log`.

## Files not safe to delete yet

- Root static prototype files: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js`.
- Coordination docs: `HANDOFF.md`, `TASKS.md`, `AGENTS.md`.
- `PUSH-ME.txt`.
- Any business routes, Prisma models, payroll, HR, finance, staff, or auth code.

## Claude documentation check

The expected Claude hardening docs listed in the request are not present in this checkout. Existing docs were checked for command drift and Docker-only assumptions. `README.md`, Windows local docs, and current inventory were updated to match the actual scripts and native PostgreSQL support.

## Cursor frontend/auth-client check

Checked:

- `apps/admin-web/src/lib/api.ts`
- `apps/admin-web/src/lib/auth-storage.ts`
- admin login/dashboard protected-route flow
- `apps/employee-tracker/src/lib/api.ts`
- `apps/employee-tracker/src/lib/auth-storage.ts`
- tracker login/home protected-route flow

Findings:

- Frontends still use `localStorage` bearer tokens. This is known roadmap debt; it was not rewritten in this cleanup branch.
- Frontend API clients use local rewrite paths when `NEXT_PUBLIC_API_URL` is unset.
- Typecheck, lint, and production builds pass for both frontends.

## API/backend check

Checked:

- `apps/api/src/app.ts`
- `apps/api/src/env.ts`
- `apps/api/src/routes/auth.ts`
- Prisma package scripts
- database check/wait/doctor scripts

Findings:

- API starts on `8787`.
- Production env validation rejects missing/unsafe `JWT_SECRET`, missing production CORS origins, local SQLite in production, and enabled dev emergency login in production.
- `/auth/dev-emergency` is development-only and also requires explicit `ALLOW_DEV_EMERGENCY_LOGIN`.
- Database unavailable state is handled by npm database scripts before Prisma stack traces dominate the output.

## CodeRabbit readiness

The PR is ready for CodeRabbit review with these focus areas:

- root script clarity
- Windows path and port cleanup behavior
- docs matching actual startup commands
- whether keeping legacy static prototype files is acceptable
- whether the Prisma 7 deprecation should be addressed now or in a follow-up config PR

## Commands tested

Passed:

- `npm.cmd install`
- `npm.cmd run db:doctor`
- `npm.cmd run db:generate`
- `npm.cmd run db:check`
- `npm.cmd run db:push`
- `npm.cmd run db:seed`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run test`
- `npm.cmd run build`
- `npm.cmd run ci`
- `npm.cmd run start:local` in a controlled launch, then stopped dev ports
- `npm.cmd run test:smoke` while API was available

Observed warnings:

- Prisma warns that `package.json#prisma` seed config is deprecated for Prisma 7.
- Employee tracker Next build warns that `themeColor` metadata should move to viewport exports.
- `npm install` reports three dependency audit findings: one moderate, one high, one critical. No automatic forced audit fix was applied because that can introduce breaking dependency changes.

## Recommended cleanup sequence

1. Keep this branch focused on workflow/scripts/docs and the obsolete static launcher removal.
2. Open owner decision for the root static prototype files before deletion.
3. Add a follow-up dependency audit task for the three npm audit findings.
4. Add a follow-up metadata cleanup task for employee tracker `themeColor` warnings.
5. Add a follow-up Prisma 7 config task to replace `package.json#prisma`.
6. Continue production hardening in the existing monorepo: PostgreSQL migrations, cookie/session migration, object storage, observability, then product gaps.
