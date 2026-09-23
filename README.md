# KleenToDiTee Payroll HRM

Approved local workspace only:

```powershell
C:\Kleentoditee Payroll HRM
```

Do not use any old duplicate payroll folder for this app.

## Start The App

Recommended command-line startup:

```powershell
cd "C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0"
npm run db:doctor
npm run start:local
```

On Windows PowerShell, use `npm.cmd` if `npm.ps1` is blocked:

```powershell
npm.cmd run db:doctor
npm.cmd run start:local
```

`start:local` frees the local dev ports, waits for PostgreSQL, runs local Prisma schema sync, seeds demo data, and then starts the API, admin web, and employee tracker. If the database is not reachable, the app servers do not start.

The batch launcher remains available for double-click startup:

```powershell
C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0\start-platform.bat
```

The launcher verifies the approved workspace root, checks Node 20+, creates `.env` from `.env.example` only when `.env` is missing, installs dependencies only when `node_modules` is missing, then delegates to `npm run start:local`.

`start-local.bat` is legacy-only. It starts the old static prototype on port `8081` after an explicit confirmation prompt. Do not use it for Payroll HRM Pro 4.0.

URLs:

- Admin: http://localhost:3000
- API: http://localhost:8787
- API health: http://localhost:8787/health
- Employee tracker: http://localhost:3001

## Login

Use an existing admin account. If the database is empty, the first user can register from the login page.

`seed-database.bat` is intentionally separate because it resets demo tables and users. Do not run it unless you intentionally want demo data reset.

Forgot password is available from the admin and employee tracker login screens. The reset request always shows the same safe message so it does not reveal whether an email exists. Reset tokens are stored hashed, expire after 60 minutes, and are single-use.

Password-reset and invitation email delivery is wired through SMTP. In local development, a reset link is printed to the API console only when SMTP is not configured. Before production, configure the SMTP variables in `.env.example`; reset and invitation tokens are never exposed in production API responses.

### Local Emergency Password Reset

For local development only, you can reset an existing user's password without seeding or creating duplicate users:

```powershell
cd "C:\Kleentoditee Payroll HRM"
npm run reset-password -- admin@kleentoditee.local
```

The script refuses to run outside `C:\Kleentoditee Payroll HRM` and refuses when `NODE_ENV=production`. It updates only the selected existing user's password with the app's bcrypt hashing method, increments `tokenVersion` to invalidate old sessions, and does not print the new password.

## Database Workflow

Prisma's main schema is PostgreSQL-first for CI, staging, and production. Use PostgreSQL locally when you are validating production behavior.

For Docker PostgreSQL:

```powershell
npm run db:up
npm run db:wait
npm run start:local
```

For native Windows PostgreSQL:

```powershell
npm run db:doctor
npm run start:local
```

Staging and production must use:

```powershell
npm run db:migrate:deploy
```

`npm run db:push` is for prototype/local schema sync only. Do not use `db push` for staging or production.

`start:local` intentionally runs `db:seed` for a reliable demo/dev database. Use `npm run dev:all` only after PostgreSQL is reachable, schema sync has succeeded, and seed has run.

## HR Document Storage

Employee profile photos and HR documents currently use local filesystem storage through the API document storage service. Local development remains the default with `UPLOADS_DIR` or `apps/api/uploads/hr`.

The production target is S3/R2-compatible object storage behind the same service interface:

- encrypted private bucket
- short-lived signed URLs for downloads
- malware scan hook before documents are marked trusted
- retention and legal-hold controls for employee records
- audit logging for upload, download, delete, and restore actions

Object storage env placeholders are listed in `.env.example`. Do not set `OBJECT_STORAGE_PROVIDER=s3` or `r2` until the S3-compatible client is implemented and tested; the current placeholder fails closed.

## Development Commands

Run these from:

```powershell
C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0
```

On first install:

```powershell
npm.cmd install
npm.cmd run db:doctor
npm.cmd run start:local
```

See [Windows Local Development](docs/LOCAL_DEVELOPMENT_WINDOWS.md) for the full Docker Desktop and PostgreSQL startup flow.

`npm run dev:all` is still available for advanced/manual use, but it assumes PostgreSQL is already reachable, schema sync has succeeded, and seed has run. Normal local startup should use `npm run start:local`.

Useful checks:

```powershell
npm run test:api
npm run typecheck
npm run lint
npm run build
```

## Troubleshooting

If the app does not start after reboot:

1. Use `npm run db:doctor`, then `npm run start:local`.
2. Confirm the app is not being launched from an old shortcut or duplicate folder.
3. Close old server windows, then run `C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0\restart-platform.bat`.
4. If Prisma client generation fails, run `C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0\repair-prisma-generate.bat`.

The app should not be copied to a new folder as a repair step.
