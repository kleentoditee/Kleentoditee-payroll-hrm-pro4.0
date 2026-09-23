# Gate D Acceptance Record — Subscriber Release Readiness

Date: 2026-09-21
Branch: `cleanup/project-workflow-audit`
Gate evidence: `tmp/gate-d-verify.mjs` (live, two orgs) — **53/53 PASS**, zero residue
Plan reference: `docs/FINAL-SHIPPING-PLAN-CELERY-QBO-2026-09-20.md` §Gate D

> Gate D asks four things: a clean subscriber organization completes the full
> journey without developer intervention; migration stays optional and gated;
> security/tenant-isolation/dependency/storage/monitoring/email/mobile/incident
> checks pass; and no placeholders, dead controls, developer notes, or
> unsupported compliance claims remain. Results below, bullet by bullet.

---

## 1. Clean subscriber journey — no developer intervention

A fresh organization shell (`gate_d_org`) was provisioned, then **every
subsequent step ran through product APIs as the subscriber's own invited
admin** — no DB writes, no developer tooling:

| Journey step | How it was done | Result |
|---|---|---|
| Subscriber admin onboarding | Operator invite → emailed accept URL → subscriber sets own password → own login | PASS |
| Company + statutory setup | `PUT /settings/org` (BVI rates, CLASS_1, monthly schedule) | PASS, persisted |
| Chart of accounts | `POST /finance/accounts` (1000 Checking, 6100 Wages) | PASS |
| Employee onboarding (single) | `POST /people/employees` | PASS |
| Employee onboarding (bulk) | CSV import, all-or-nothing | PASS, 1 created |
| Bank payout details (PII) | `PATCH /people/employees/:id` | PASS (2/2) |
| Time | submit ×2 → bulk approve | PASS (updated 2) |
| Payroll | period → run → rebuild → finalize → **BVI bank payout export** → mark-paid | PASS; bank file TOTAL 6,457.50 == approved net 6,457.50 exactly; file downloadable |
| Bank reconciliation | statement CSV preview → commit → session → clear 2 lines → complete | PASS, completed in balance (difference 0); completed session refuses changes (409) |
| Statements | trial balance (debits == credits, 14,035 == 14,035), P&L, balance sheet, AR/AP aging | PASS |
| Backup / restore | `scripts/export-production-data.ps1` → backup `20260921-230351`; `scripts/restore-drill.ps1` into scratch DB | **RESTORE DRILL PASSED** (Users 2, Employees 7, Organizations 1) |

Backup hashes: postgres.dump sha256 `f0b2b697…`, employee-files.zip sha256 `72e4a0af…`.

**Provisioning note (product shape):** the only non-self-service step is creating
the empty organization shell. Self-service `/auth/register` is the per-deployment
bootstrap and closes permanently after the first user (verified: 403). New
subscriber orgs are provisioned by the platform operator and the subscriber's
first admin joins by email invitation — this is the intended B2B onboarding
shape, recorded here explicitly so the release notes state it honestly.

## 2. Migration optional and gated

- The entire journey above ran **without touching migration** — it is strictly
  optional per subscriber.
- Bypass attempts refused: commit before validate/approve → 400; approve before
  validate → 400. (The full validate→approve→commit→reconcile path is proven by
  Gate 18 — 45/45 — and Gate C — 32/32.)

## 3. Security, isolation, dependency, storage, monitoring, email, mobile, incident

| Area | Check | Result |
|---|---|---|
| Auth | Unauthenticated request to protected route → 401; session cookie HttpOnly | PASS |
| Bootstrap security | Self-registration closed after first user (403) | PASS |
| Tenant isolation | Subscriber admin on foreign org → uniform 403 (no enumeration); org-scoped queries via AsyncLocalStorage scope (Batch 12 architecture) | PASS |
| CSRF | Mutations require `x-kt-csrf` matching the session jar (exercised by every mutation above) | PASS |
| Monitoring | `/health` 200; email transport monitor reports honestly (`SMTP not configured` in dev, would 503 invites in production) | PASS |
| Email | Invite email persisted in delivery queue (status QUEUED) — no silent drops when SMTP is absent; queue + retry endpoints live | PASS |
| Storage | Private local storage with hashed keys; document-storage unit tests in suite; archived migration attachments hash-verified (Gate C) | PASS |
| Mobile (employee-tracker) | `tsc --noEmit` clean | PASS |
| Dependency health | api `tsc` clean; admin-web `tsc` clean; **209/209 unit tests PASS**; `npm audit --omit=dev`: 0 critical, **4 high — all inside Prisma's own dependency tree** (see known finding below) | PASS with disclosed finding |
| Incident readiness | `docs/OPERATIONS.md` runbook (backup/restore/restart procedures, drill-proven); audit log written for every mutation (Batch 12+ gates) | PASS |

### Known dependency finding (disclosed, not a blocker)

`npm audit --omit=dev` reports 4 high-severity advisories, all reachable only
through Prisma's bundled dependencies: `deepmerge-ts` stack exhaustion (inside
`@prisma/config`, config-loading surface) and `mysql2` auth-downgrade/zlib
advisories (Prisma's MySQL driver — **this product runs Postgres only; the
mysql2 code path is never loaded**). (Audit's mechanical suggestion of
`prisma@6.19.3` predates this repo's Prisma 7.10 line — remediation means
tracking the current Prisma line, not downgrading.) **Decision:** risk-accepted
for subscriber release on the Postgres-only deployment; scheduled as
post-release maintenance (Prisma line upgrade in a dedicated batch with a full
migration + gate re-run).

## 4. Placeholders, dead controls, developer notes, compliance claims

- Source-wide sweep (`TODO|FIXME|HACK|coming soon|not implemented|under
  construction|lorem ipsum` across `apps/**/src`): **zero real hits** (only the
  false-positive substring in `previousPhotoDocuments`).
- Compliance-claim sweep (`audited|certified|guarantee|fully compliant`):
  **zero unsupported claims** — the only matches are the correct
  *"management-prepared, unaudited"* disclaimers on financial statements and
  legitimate references to audited platform-support access.
- Every gate to date ends with verified zero residue; this gate's cleanup was
  DB-verified (org, employees, users, batches all 0) and org A confirmed
  untouched (7 employees).

## Verdict

**GATE D PASS — 53/53 live checks**, backup/restore drill passed on a fresh
backup, all typechecks and 209/209 unit tests green, static sweeps clean, one
dependency finding disclosed with a scheduled remediation path.

Remaining owner actions before announcing subscriber availability:

1. Configure production SMTP (invites hard-fail safely until then — by design).
2. Schedule the post-release Prisma major upgrade (finding above).
3. Publish release notes stating the operator-provisions-org onboarding shape
   and the "management-prepared, unaudited" statement positioning.

## Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Owner | ______________________ | ______________________ | ________ |

*Gate executed and evidence collected by the Kimi lane on 2026-09-21;
gate script output 53/53 PASS retained in session logs.*
