# KleenToDiTee Operations Runbook — Batch 16 (2026-09-20)

Covers production delivery infrastructure: storage, email, monitoring, backups,
incident response, and the staging/pilot acceptance procedure for Gate B.

## 1. Object storage (employee documents)

- Provider is selected by `OBJECT_STORAGE_PROVIDER`: `local` (default, `UPLOADS_DIR`),
  `s3`, or `r2`. S3/R2 require `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`;
  R2 also requires `S3_ENDPOINT`. Missing config **fails at boot** — never mid-request.
- Keys are org-scoped (`<orgId>/employees/<employeeId>/<file>`); the provider rejects
  absolute paths and `..` escapes.
- Nothing is public. Downloads either stream through the authenticated API routes or
  redirect to a **presigned GET URL** (5 min default, clamped 30 s–1 h).
- Upload validation: extension allowlist (pdf/png/jpg/jpeg/webp), magic-byte signature
  check, 20 MB cap.

## 2. Transactional email (outbox)

- All email is **queued first** in `EmailMessage` (the delivery log), then sent by the
  background worker (`startEmailWorker`, 60 s interval, `EMAIL_WORKER=off` to disable).
- Retry: exponential backoff `2^attempts` minutes (cap 6 h), 5 attempts default, then
  terminal `FAILED` with `lastError`.
- At-least-once: a crash mid-send leaves the row `QUEUED` — never silently marked sent.
- Admin surface: **Admin → Email queue** (`/dashboard/email-queue`) — summary counts,
  SMTP-configured indicator, manual flush (platform owner), retry failed.
- Monitoring: `GET /health/ready` reports `email.delivery`, `email.queued`, `email.failed`,
  `documentStorage`. `GET /admin/email-transport/verify` runs `SMTP verify()` (platform owner).
- Templates: `password_reset`, `user_invitation` in `apps/api/src/lib/email.ts`.
  Production invitations refuse creation (502) when SMTP is not configured.

## 3. WhatsApp

- Direct `https://wa.me/<number>?text=…` links on the tracker-share card when the employee
  has a phone (BVI default: 7-digit numbers get +1-284). Generic `api.whatsapp.com/send`
  share link remains as fallback.
- Provider sending (WhatsApp Business API) stays optional until the owner supplies
  credentials and consent wording.

## 4. Backups

- **What:** `scripts/export-production-data.ps1` → `deployment-backups/<timestamp>/`
  with a custom-format Postgres dump + employee-files zip.
- **Schedule:** `scripts/register-scheduled-backup.ps1` registers a daily Windows
  Scheduled Task (default 02:17). Verify with `Get-ScheduledTask`.
- **Restore proof:** `scripts/restore-drill.ps1` restores the latest backup into a
  scratch database, checks row counts (users/employees/journals/orgs), and drops the
  scratch DB. Run monthly and after every schema migration batch. When the app user
  lacks CREATEDB, pass `-AdminDatabaseUrl`.
- **Real restore:** `scripts/restore-production-data.ps1 -BackupDirectory <dir> -ConfirmRestore`.
- Last drill: **2026-09-20 PASSED** (backup 20260920-225223: 2 users, 7 employees, 1 org).

## 5. Incident procedure

1. **Detect** — `/health/ready` failing, email queue FAILED count rising, or user report.
2. **Contain** — if data corruption is suspected, stop the API; the queue and journal
   are durable, nothing is lost by stopping.
3. **Assess** — check `EmailMessage.lastError`, audit log (`/dashboard/audit`), Postgres logs.
4. **Recover** — restore from the latest verified backup (section 4); reversals, never
   edits, for posted financial records.
5. **Record** — append an incident note (what/when/impact/root cause/fix) to `TASKS.md`
   and review at the next batch.

## 6. Staging + pilot acceptance (Gate B)

Staging = a second local stack (copy of repo, separate DB + ports, `NODE_ENV=production`,
`EMAIL_WORKER` on). Before subscriber onboarding, the owner runs the pilot checklist:

- [ ] Clean checkout installs and builds (`npm install`, `npm run build` at root)
- [ ] Migrations apply on an empty DB and on the upgraded pilot DB
- [ ] Sign in → create employees → enter time → run payroll → post a payment →
      reconcile → open financial statements → run year-end preview — **without developer help**
- [ ] Invite email delivers end-to-end (SMTP configured)
- [ ] `npm run test:e2e` passes on desktop/tablet/phone
- [ ] `scripts/restore-drill.ps1` passes
- [ ] `npm audit` shows no unreviewed criticals
- [ ] Defects found are fixed and re-verified before Release B approval
