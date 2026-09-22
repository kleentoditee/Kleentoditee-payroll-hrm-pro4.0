# Go-Live Checklist — Owner's Path to Production

Prepared: 2026-09-21 · Branch `cleanup/project-workflow-audit`
All four shipping gates are complete (A pilot, B SaaS foundation, C cutover
rehearsal 32/32, D subscriber readiness 53/53). What remains is execution, not
development. Work top to bottom; each step names its proof.

---

## Phase 1 — Production environment (one-time)

- [ ] **Deploy the API + databases** per `docs/OPERATIONS.md`; confirm
  `/health` returns 200 from the production host.
- [ ] **Set production env**: `NODE_ENV=production`, strong session secret,
  `DATABASE_URL` (production Postgres), `UPLOADS_DIR` on durable storage.
- [ ] **Configure SMTP** (`SMTP_HOST`, `SMTP_FROM`, `SMTP_PORT`/`SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASS`). Verify in Admin → Email transport — until this is
  green, invitations hard-fail by design (503), so no one gets stuck silently.
- [ ] **First-user bootstrap**: open the app, complete the one-time
  registration (creates your organization + platform_owner). Registration
  closes permanently after this — verified in Gate D.
- [ ] **Send a test invitation** to a second mailbox and accept it end-to-end.
- [ ] **Schedule nightly backups** (`scripts/export-production-data.ps1`) and
  confirm where `deployment-backups/` is retained off-machine.
- [ ] **Run one restore drill** against the production backup before go-live
  (`scripts/restore-drill.ps1`) — the drill takes ~1 minute and proves the
  backup is real.

## Phase 2 — Internal cutover from QuickBooks (the real one)

Gate C rehearsed this end-to-end (32/32). Repeat with live data:

- [ ] **Freeze the QuickBooks cutover period** — pick the date; stop entering
  new transactions after it.
- [ ] **Take final QuickBooks exports** (all data types) and record SHA-256
  hashes + a member manifest (same pattern as `tmp/b18-manifest.json`).
- [ ] **Take a fresh KleenToDiTee backup** and run the restore drill.
- [ ] **Import into production** via Migration Center: cutover mode → upload →
  validate → fix any validation errors in the chart → re-validate → approve →
  commit → confirm status *reconciled*.
- [ ] **Reconcile every control**: AR balance, AP balance, trial balance
  debits == credits — all must show *matched* on the batch. Work through the
  full migration acceptance checklist in
  `docs/FINAL-SHIPPING-PLAN-CELERY-QBO-2026-09-20.md` (TB, Balance Sheet,
  retained earnings, P&L by period, AR/AP aging by document, bank balances).
- [ ] **Run the parallel payroll compare** for the first period (engine vs
  your own calculation, employee-level + statutory totals) — the Gate C
  rehearsal's reference table is the template.
- [ ] **Download the exception report and sign it** in Migration Center
  (typed signature, recorded on the batch).
- [ ] **Owner + accounting reviewer sign** the acceptance record
  (`docs/GATE-C-ACCEPTANCE-2026-09-21.md` is the rehearsal template — copy it
  and replace the evidence with the live run).
- [ ] **Use KleenToDiTee for all new activity from this point.**
- [ ] **Keep QuickBooks read-only** for at least one completed month-end
  evidence cycle (or longer if your accountant advises); reconcile the first
  live month-end against it before cancelling the subscription.

## Phase 3 — Subscriber onboarding (per subscriber)

- [ ] **Operator provisions the subscriber organization** (empty shell).
- [ ] **Invite the subscriber's first admin** by email; they set their own
  password (invites expire — resend from Admin if needed).
- [ ] Subscriber admin completes in-product setup (Gate D journey):
  company + statutory settings → chart of accounts → employees (single or bulk
  CSV) → time → first payroll → bank reconciliation → statements.
- [ ] Optional: run their QuickBooks migration (same gated flow as Phase 2 —
  optional per subscriber, never bypassable).
- [ ] First payroll: confirm the BVI bank payout file TOTAL equals approved
  net exactly, and confirm the bank accepts the file format (see release
  notes — generic BVI layout pending your bank's spec).

## Phase 4 — Standing obligations

- [ ] **Verify BVI public holidays against the official gazette yearly**
  (Admin → Leave; seeded dates follow the standard pattern).
- [ ] **Keep the "management-prepared, unaudited" positioning** in any
  customer-facing material — do not represent outputs as audited or filed.
- [ ] **Review the email queue** after any SMTP change (Admin → Email queue).
- [ ] **Scheduled maintenance batch**: Prisma major upgrade (`prisma@6.19.3`,
  breaking) to clear the 4 disclosed audit advisories — run the full gate
  suite after it. See `docs/GATE-D-ACCEPTANCE-2026-09-21.md` §Known finding.
- [ ] **Monthly**: restore drill on the latest backup; confirm off-machine
  retention of `deployment-backups/`.

---

*Every technical verification behind this checklist is already machine-proven;
the checklist converts that evidence into an ordered owner run-book. If any
step fails, stop and consult `docs/OPERATIONS.md` before improvising.*
