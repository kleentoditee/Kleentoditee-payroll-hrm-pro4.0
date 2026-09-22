# KleenToDiTee Payroll HRM — Subscriber Release Notes (v1.0)

Release date: 2026-09-21 (readiness verified)
Branch: `cleanup/project-workflow-audit`
Gate evidence: Gate A–D acceptance records in `docs/`

---

## What this release is

KleenToDiTee Payroll HRM is ready for subscriber organizations in the British
Virgin Islands: payroll with BVI statutory calculations, HR records, time
tracking, leave, accounting with banking and financial statements, and an
optional, fully reconciled migration path from QuickBooks.

Readiness is evidence-backed end to end:

| Gate | Scope | Result |
|---|---|---|
| Gate A | Internal pilot (payroll truth pack, jurisdiction cleanup) | Passed (Batch 11) |
| Gate B | Subscriber SaaS foundation (multi-tenancy, storage, email, e2e) | Passed (Batch 16) |
| Gate C | Internal cutover from QuickBooks — rehearsal | 32/32 checks |
| Gate D | Subscriber release readiness | 53/53 checks, 209/209 unit tests |

## For new subscribers — how onboarding works

1. **Your organization is provisioned for you.** KleenToDiTee operates one
   organization per deployment/tenant; a new subscriber organization is created
   by the platform operator (self-service sign-up is intentionally limited to
   the very first deployment bootstrap and then closes).
2. **You receive an email invitation.** Your first administrator sets their own
   password from the invitation link — no passwords are ever sent or shared.
3. **Your administrator completes setup in-product**, with no developer help
   needed: company details and BVI statutory settings, chart of accounts,
   employees (one-by-one or bulk CSV), time tracking, payroll, bank
   reconciliation, and financial statements. This exact journey is
   machine-verified in Gate D (53/53).

## What's included

- **Payroll (BVI)**: monthly/weekly/biweekly runs; SSB (4 %/4.5 %, ceiling
  53,400), NHI (3.75 %/3.75 %, ceiling 106,800), payroll tax (8 % over the
  10,000 annual exemption, employer Class 1/Class 2); no income tax; locked
  statutory snapshots that reproduce official-form outputs; BVI bank payout
  file whose TOTAL must equal approved net exactly.
- **HR**: employee records, documents with expiry reminders, departments,
  positions, cost centres, locations, work schedules, effective-dated
  employment contracts, asset register, manager-scoped visibility.
- **Leave**: policy accruals, carryover caps, BVI public holidays,
  time-for-time, work-schedule-aware usage; balances reproduce from the event
  ledger.
- **Time**: employee/tracker time entry, approval workflow, payroll rebuild
  from approved time.
- **Accounting**: chart of accounts, customers/suppliers/products, invoices,
  bills, payments, journals with fiscal periods; trial balance, P&L, balance
  sheet, cash flow, equity, AR/AP aging; bank statement import with duplicate
  detection and controlled, auditable reconciliation sessions.
- **Optional QuickBooks migration**: ZIP/CSV/XLSX upload, strict validation,
  owner approval, commit with AR/AP/trial-balance reconciliation, signed
  exception report, full reversal. Migration can never bypass validation or
  approval — attempted bypasses are refused (verified).
- **Bulk operations**: all-or-nothing employee onboarding imports and payroll
  mutation imports, both with exact batch reversal.
- **Security**: per-organization tenant isolation (uniform 403, no org
  enumeration), HttpOnly session cookies, CSRF protection on every mutation,
  role-based access, full audit logging, manager-scoped employee visibility,
  PII masking for bank and government ID fields.

## Honest positioning (please read)

- **Financial statements are management-prepared and unaudited.** The product
  says this on the statements themselves. Nothing produced by the system is
  represented as audited, certified, or officially filed.
- **BVI public-holiday dates** follow the standard gazette pattern and must be
  verified against the official gazette each year (editable in the UI).
- **The bank payout file** is a generic BVI layout; confirm your bank's exact
  file specification before first use.
- **Email-dependent features** (user invitations, password resets) require SMTP
  to be configured; until then the system fails safely and visibly rather than
  dropping messages.

## Known items scheduled after release

- **Dependency maintenance**: `npm audit` reports 4 high-severity advisories,
  all inside Prisma's bundled dependencies (`deepmerge-ts` via `@prisma/config`,
  and `mysql2` — this product runs PostgreSQL only and never loads the MySQL
  driver). Remediation requires the breaking `prisma@6.19.3` upgrade and is
  scheduled as a dedicated post-release maintenance batch with a full gate
  re-run. Risk-assessed as not exploitable on this deployment.
- **QuickBooks/Xero API pull adapters** (direct sync instead of file upload)
  remain future work; file-based migration is the supported path.
- **Project/job costing masters**: archived `projects` imports are retained as
  evidence and become promotable when job costing lands (same pattern as
  Batch 19 cost centres).

## Upgrade & support notes for the operator

- Production SMTP must be configured before inviting subscriber admins
  (`SMTP_HOST`, `SMTP_FROM`, `SMTP_SECURE`/`SMTP_PORT`, credentials) — see
  `docs/GO-LIVE-CHECKLIST.md`.
- Backup/restore is script-based and drill-proven (`deployment-backups/`;
  restore drill passed on 2026-09-21, Gate C and Gate D evidence).
- Operational runbook: `docs/OPERATIONS.md`.
