# Windows Local Development

KleenToDiTee Payroll HRM Pro 4.0 uses PostgreSQL for the production-style local workflow. The repo Docker Compose file starts PostgreSQL with:

- Host: `localhost`
- Port: `5432`
- Database: `kleentoditee`
- User: `kleentoditee`
- Password: `kleentoditee`

The matching local `DATABASE_URL` is:

```powershell
postgresql://kleentoditee:kleentoditee@localhost:5432/kleentoditee?schema=public
```

## Start Locally

Step 1: Open Docker Desktop and wait until it says it is running.

Step 2: Open PowerShell from the repo root:

```powershell
cd "C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0"
```

Step 3: Run the full local startup:

```powershell
npm.cmd install
npm.cmd run db:doctor
npm.cmd run start:local
```

`start:local` runs:

```powershell
npm.cmd run dev:ports:free
npm.cmd run db:wait
npm.cmd run db:push
npm.cmd run db:seed
npm.cmd run dev:all
```

You can also run those commands one at a time when troubleshooting.

`dev:all` remains available for advanced/manual use only. It starts admin, employee tracker, and API immediately, so use it only after PostgreSQL is reachable, schema sync has succeeded, and seed has run.

## PowerShell Blocks npm.ps1

If PowerShell blocks `npm` with an execution policy error, use `npm.cmd` as shown above.

Optional current-user policy fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Docker Desktop Is Not Running

If you use Docker Desktop, open Docker Desktop and wait for it to finish starting, then run:

```powershell
npm.cmd run db:up
npm.cmd run db:wait
npm.cmd run start:local
```

If Docker Desktop is not installed:

```powershell
winget install -e --id Docker.DockerDesktop
```

Restart Windows after installation, open Docker Desktop once, then rerun the startup commands.

## Native PostgreSQL

If you use native PostgreSQL instead of Docker Desktop:

1. Open Windows Services.
2. Start the `postgresql-x64` service.
3. Confirm `.env` has a `DATABASE_URL` matching your PostgreSQL username, password, port, and database.
4. Run:

```powershell
npm.cmd run db:check
npm.cmd run start:local
```

PostgreSQL must be listening at the host and port in `DATABASE_URL` before Prisma commands run.

## App URLs

- Admin: http://localhost:3000
- Employee tracker: http://localhost:3001
- API: http://localhost:8787
