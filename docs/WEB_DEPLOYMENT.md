# KleenToDiTee web deployment

The repository includes `render.yaml` for a production web deployment with four managed parts:

- Admin web app
- Staff Hub web app
- Private API service
- PostgreSQL database

The API is private. Both public web apps send browser requests through their own same-origin proxy, so the database and API do not need a public address. Employee documents are stored on the API service's encrypted persistent disk.

## Before deployment

1. Push the reviewed application files to the GitHub repository.
2. Create or sign in to a Render account and choose **New > Blueprint**.
3. Select this repository. Render reads `render.yaml` from the repository root.
4. Enter the SMTP values requested during Blueprint creation. These are required for password-reset emails.
5. Create the Blueprint and wait for the database, API, Admin, and Staff Hub to become healthy.

## Move existing computer data

1. Run `powershell -ExecutionPolicy Bypass -File scripts/export-production-data.ps1` before deployment. The timestamped backup is written under `deployment-backups` and is excluded from Git.
2. Restore `kleentoditee-postgres.dump` into the new Render PostgreSQL database using Render's external database URL and PostgreSQL `pg_restore`.
3. Transfer the contents of `employee-files.zip` into `/var/data/uploads/hr` on the API service's persistent disk using Render SSH/SCP.
4. Deploy the services, then compare employee, time-entry, payroll, invoice, and document counts between local and hosted systems.
5. Keep the computer copy unchanged until the hosted system has passed sign-in, payroll-preview, document-download, and backup checks.

For a local recovery test, use `scripts/restore-production-data.ps1` with a backup folder under
`deployment-backups` and the explicit `-ConfirmRestore` switch. Always restore into a separate test
database first; verify record counts and documents before using a restored database for live work.

The migration archives contain sensitive HR and payroll data. Never commit them to GitHub or send them through ordinary email.

## First sign-in

Open `https://kleentoditee-admin.onrender.com/login`. On a new empty database the page shows **Create the first owner account**. This one-time screen creates the platform owner and is disabled automatically after the first user exists.

## Addresses

- Admin: `https://kleentoditee-admin.onrender.com`
- Staff Hub: `https://kleentoditee-staff.onrender.com`

If Render assigns different hostnames, update these API environment variables and redeploy the API:

- `ADMIN_WEB_PUBLIC_URL`
- `EMPLOYEE_TRACKER_PUBLIC_URL`
- `APP_URL`
- `CORS_ALLOWED_ORIGINS`

## Required release checks

- `/health/ready` reports `ok: true`, `database: ready`, and `passwordResetEmail: configured`.
- Create the owner with a unique password of at least 15 characters.
- Review the 2026 BVI SSB, NHI, payroll-tax exemption, and employer tax class in Admin > Settings before processing live payroll.
- Test Admin and Staff Hub on a phone, tablet, and desktop browser.
- Configure custom domains and update the four public URL/CORS settings above.
- Confirm database backups and persistent-disk snapshots are enabled for the selected service plans.
