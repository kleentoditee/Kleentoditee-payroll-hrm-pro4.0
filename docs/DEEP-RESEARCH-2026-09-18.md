# Deep Research — KleenToDiTee Payroll HRM Pro 4.0

**Date:** 2026-09-18
**Method:** Phase 0/1 of `docs/CLAUDE-KIMI-PROFESSIONALIZATION-PROMPT.md` — read-only repository audit. No runtime changes, no database resets.
**Baseline commands run this session:** `typecheck` (PASS, all 5 workspaces), `lint` (PASS, 1 warning: `<img>` in `payroll/forms/page.tsx:343`), `test:api` (PASS, 72/72, 3.8s). Build not re-run this session; last verified passing 2026-04-24 per `HANDOFF.md`.

---

## 1. Audit summary

The platform is a **solid, working local operations system**: 41 Prisma models, 15 mounted API route groups, 65 admin pages, 11 tracker pages, and 72 passing API tests covering payroll calc, statutory config, government forms, work time, QuickBooks import parsing, and password reset. Payroll (periods → runs → finalize → export → paystubs → BVI forms) and finance (AR/AP documents, payments, expenses, deposits, accounting import) are the deepest, most complete verticals.

Against the professionalization prompt, the **release blockers are structural, not cosmetic**:

1. **Misleading navigation is confirmed live in code.** Sidebar "Paystubs" and "Payroll exports" both point to `/dashboard/payroll/runs`; primary-nav "Bookmarks" points to `/dashboard/reports`; "Users & roles" and "Activity log" appear twice. Dedicated pages already exist (`/dashboard/payroll/paystubs/preview`, `/dashboard/payroll/forms`) but the nav never points to them — lowest-effort, highest-visibility fix.
2. **Security is local-dev grade.** JWT bearer tokens in `sessionStorage` (XSS-readable), login/reset throttles held in in-memory `Map`s (lost on restart, per-process), no CSRF tokens, no MFA, no session/device management.
3. **BVI statutory configuration is hard-coded with a single effective year.** `statutory-config.ts` defaults: SSB 4%/4.5%, NHI 3.75%/3.75%, payroll tax 8% employee with $10,000 exemption, employer class 1/2 = 2%/6%. OrgSettings can override rates, but there are **no versioned per-tax-year tables, no effective-from/to dates, no source URLs, no verification dates**. SSB ceiling $53,400 and NHI ceiling $106,800 need official verification before any live run.
4. **Finance is operational record keeping, not accounting.** No journal/journal-line models, no balanced debit/credit posting, no bank reconciliation, no period close. The reports API is a single summary endpoint. This must be labeled accurately.
5. **Document storage is local-disk only**; the S3/R2 provider is an intentional fail-closed `throw` (`document-storage.ts:97`). Fine for local dev; blocks multi-device hosting.
6. **No leave/time-off, no departments/job titles/managers, no onboarding/offboarding, no historical-payroll/YTD import** — time-off exists only as a request *type* in StaffRequests with no balances or payroll impact.
7. **No automated UI/e2e tests.** The 72 tests are API/unit level. All visual/mobile claims remain unverified this session.

---

## 2. Completion matrix

Working states: ✅ verified-complete (API + model + UI + tests) · ◐ partial · ❌ broken/duplicate · ➖ removed/not built · ? not exercised this session (code inspected only).

### Auth & platform

| Area | Route | API | DB model | Permission | State | Mobile | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Login | `/login` | `POST /auth/login` | User/UserRole | public | ✅ | ? | unit | keep |
| First-user register | `/login` → register | `POST /auth/register` (first only) | User | public bootstrap | ✅ | ? | unit | keep |
| Session | all | `GET /auth/me` | User | bearer JWT | ◐ sessionStorage, no CSRF/MFA | — | unit | **blocker: cookie session + CSRF + MFA** |
| Forgot/reset password | `/forgot-password`, `/reset-password` | reset token routes | PasswordResetToken | public, throttled | ◐ throttle is in-memory Map | ? | unit (password-reset.test) | move throttle to DB/Redis |
| Accept invite | `/accept-invite` | invite routes | UserInvitation | token | ✅ | ? | ? | keep |
| Dev emergency login | — | `POST /auth/dev-emergency` | — | dev-only, env-gated, 403 in prod | ✅ fail-closed | — | ? | keep dev-only |
| Users & roles | `/dashboard/users`, `/new`, `/[id]` | `/admin/users*` | User/UserRole | platform_owner | ✅ | ? | unit | keep |
| Audit log | `/dashboard/audit` | `GET /audit/recent` | AuditLog | owner/payroll/hr/finance | ✅ | ◐ | ? | keep |
| Settings | `/dashboard/settings` | `GET /settings/org` (read; PATCH path not confirmed) | OrgSettings | owner/finance | ◐ statutory editable but unversioned | ? | statutory tests | **blocker: versioned statutory tables** |

### People (HR)

| Area | Route | API | DB model | Permission | State | Mobile | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Employee list | `/dashboard/people/employees` | `GET /people/employees` | Employee | people-view roles | ✅ SSN/NHI/IRD masked in list | ◐ | unit | keep |
| Employee record | `/dashboard/people/employees/[id]` | `GET/PATCH/DELETE /people/employees/:id` | Employee + docs | people-edit roles | ✅ mask/show, audit, archive | ◐ | unit | keep |
| Create employee | `…/employees/new` | `POST /people/employees` | Employee | people-edit | ✅ work-permit conditional fields | ◐ | unit | keep |
| Profile photo | employee record | photo upload/crop endpoints | Employee.profilePhotoPath | people-edit | ✅ | ? | ? | keep |
| Documents | employee record | `/people/employees/:id/documents*` | EmployeeDocument | PII docs: owner/hr/payroll only | ◐ local disk only; S3 fail-closed; no malware scan | ? | document-storage tests | **blocker for hosting** |
| Deduction templates | `/dashboard/people/templates*` | `/people/templates*` | DeductionTemplate | people-edit | ✅ | ? | ? | keep (migrate to versioned statutory) |
| Staff requests queue | `/dashboard/people/requests` | `/admin/staff-requests*` | StaffRequest | owner/hr/ops/supervisor | ✅ lifecycle + audit; **no leave balances** | ◐ | ? | keep; add leave domain separately |
| Tracker sharing | employee record | `GET …/tracker-share` | User.employeeId | people-edit | ✅ | — | ? | keep |

### Time

| Area | Route | API | DB model | Permission | State | Mobile | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Time entries | `/dashboard/time/entries*` | `/time/entries*` | TimeEntry | owner/hr/payroll edit | ✅ multi-location rows | ◐ | unit | keep |
| Approvals | `/dashboard/time/approvals` | `bulk-approve`, `count` | TimeEntry | manager roles | ✅ | ◐ | ? | keep |
| Employee self time | tracker `/time` | `/time/self/*` | TimeEntry | employee_tracker_user | ✅ draft/submit | ✅ mobile-first | check:tracker-login | keep |
| Work schedule (admin) | `/dashboard/schedule` | `/admin/schedules*` | WorkAssignment | staff-edit roles | ◐ single assignments; no recurring/crews/copy-week/conflict warnings | ◐ | ? | **gap: scheduling depth** |
| Announcements | `/dashboard/announcements` | `/admin/announcements*` | StaffAnnouncement | staff-edit roles | ✅ | ✅ | ? | keep |
| Tracker home/rewards/messages | `/`, `/rewards`, `/messages` | `/staff/self/*` | Quiz/Reward/Announcement | employee | ✅ engagement only, not pay | ✅ | ? | keep |

### Payroll

| Area | Route | API | DB model | Permission | State | Mobile | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Pay periods | `/dashboard/payroll/periods*` | `/payroll/periods*` | PayPeriod | owner/payroll | ✅ monthly/weekly/biweekly schedules | ◐ | unit | keep |
| Pay runs | `/dashboard/payroll/runs*` | runs/rebuild/finalize/export/mark-paid/void/delete | PayRun + PayRunItem | owner/payroll | ✅ frozen items, void reversal, YTD context | ◐ | payroll-service tests | keep |
| Paystub print | `/dashboard/payroll/paystubs/[id]`, `/preview` | `/payroll/paystubs/preview`, `/paystubs/:id` | Paystub | owner/payroll; employee self via tracker | ✅ source-location detail | ◐ | ? | keep |
| Sidebar "Paystubs" label | points to `/dashboard/payroll/runs` | — | — | — | ❌ duplicate/misleading | — | — | **fix nav → paystubs preview** |
| Sidebar "Payroll exports" label | points to `/dashboard/payroll/runs` | — | — | — | ❌ duplicate/misleading | — | — | **fix nav → runs detail w/ exports or remove** |
| Government forms | `/dashboard/payroll/forms` | `/payroll/statutory-forms*` (SVG preview + file) | computed (no form model) | statutory-view roles | ✅ NHI K / SSB I & II rendered from official templates; flagged missing fields | ◐ | statutory-forms tests | keep; visually verify against current agency forms |
| Statutory rates | settings + calc | `statutory-config.ts` | OrgSettings fields | — | ◐ hard-coded defaults, single effectiveYear | — | unit | **blocker: verify vs official BVI sources + version** |
| Historical/YTD import | — | — | — | — | ➖ not built | — | — | **gap: opening balances import** |
| Payroll register/summary reports | — | — | — | — | ➖ no payroll reports beyond forms/exports | — | — | **gap** |

### Finance

| Area | Route | API | DB model | Permission | State | Mobile | Tests | Decision |
|---|---|---|---|---|---|---|---|---|
| Chart of accounts | `/dashboard/finance/accounts` | `/finance/accounts*` | Account | view wide / edit owner+finance | ✅ | ◐ | unit | keep |
| Customers/Suppliers/Products | `/dashboard/finance/{customers,suppliers,products}*` | master-data CRUD | Customer/Supplier/Product | as above | ✅ incl. detail pages | ◐ | ? | keep |
| Invoices | `/dashboard/finance/invoices*` | invoices + send/void | Invoice + InvoiceLine | as above | ✅ states + line totals | ◐ | unit | keep |
| Bills | `/dashboard/finance/bills*` | bills + receive/void | Bill + BillLine | as above | ✅ | ◐ | unit | keep |
| Payments / Bill payments | `/dashboard/finance/payments*`, `bill-payments*` | payments, apply/unapply | Payment + PaymentApplication; BillPayment + … | as above | ✅ allocation logic | ◐ | unit | keep |
| Expenses / Deposits | `/dashboard/finance/expenses*`, `deposits*` | post/void | Expense + lines; Deposit + lines | as above | ✅ | ◐ | unit | keep |
| Reports | `/dashboard/reports` | `GET /finance/reports/summary` only | computed | finance-view roles | ◐ P&L-style summary + CSV; no GL/trial balance/AR/AP aging | ◐ | ? | **gap: reporting depth; label "finance operations"** |
| Accounting import | `/dashboard/imports/accounting`, `/imports/quickbooks` | `/imports/*` | created on commit | finance-edit | ✅ preview + commit, robust QB parsing | ◐ | extensive import tests | keep; "QuickBooks" page name is a misnomer (no QB sync) — consider renaming "Accounting import" |
| General ledger | — | — | ➖ no Journal model | — | ➖ document-centric, no balanced entries | — | — | owner decision: full accounting scope or stay operations |

### Admin shell

| Item | Finding | State | Decision |
|---|---|---|---|
| Primary nav "Bookmarks" | href = `/dashboard/reports`; preview text even says "Quickly access saved tools" — no bookmarks feature exists | ❌ misleading | remove or build bookmarks |
| "Users & roles" in both People and Admin groups | same href, twice | ❌ duplicate | keep one |
| "Activity log" (Admin) + "Audit reports" (Reports) | both → `/dashboard/audit` | ❌ duplicate | keep one |
| Government forms page | exists but not in sidebar at all | ◐ discoverability gap | add under Payroll |
| Nav header comment | "every href is a working route" — true, but several labels masquerade as different screens | ❌ | fix with the above |

### Employee tracker (mobile)

| Route | Purpose | State | Decision |
|---|---|---|---|
| `/login`, `/forgot-password`, `/reset-password` | auth | ✅ | keep |
| `/` home | self time summary / landing | ✅ | keep |
| `/time` | multi-location time entry, draft/submit | ✅ | keep |
| `/paystubs`, `/paystubs/[id]` | self-service paystub history/detail | ✅ | keep |
| `/requests` | staff requests create/cancel | ✅ | keep |
| `/schedule` | self schedule view | ✅ | keep |
| `/messages` | announcements | ✅ | keep |
| `/rewards` | quiz/points | ✅ (engagement, not pay) | keep |

---

## 3. Risk-ranked backlog

| # | Risk | Evidence | Depends on | Effort |
|---|---|---|---|---|
| R1 | Live payroll on unverified statutory rates → wrong deductions, penalties | `statutory-config.ts` defaults; single `effectiveYear`; no source URLs; SSB ceiling possibly stale | — | M (verification + versioning schema) |
| R2 | Misleading nav erodes trust; labeled features don't exist | `dashboard-nav.ts:49,50,94` | — | XS |
| R3 | Token theft via XSS; no CSRF; throttle resets on restart | `auth-storage.ts` (sessionStorage), `auth.ts:27-29` in-memory Maps | R4 | L |
| R4 | Session design (HttpOnly cookies) is prerequisite for CSRF and device management | same as R3 | — | L |
| R5 | No historical/YTD payroll import → payroll tax YTD wrong from January | no import models/routes | R1 | L |
| R6 | Local-disk HR documents break on multi-device hosting; no scan/quarantine | `document-storage.ts:97` throw | hosting decision | L |
| R7 | "Finance" implied as accounting but has no ledger; mislabeled scope | no Journal model; one summary report | owner scope decision | XL |
| R8 | No leave/time-off domain (balances, policies, payroll impact) | only StaffRequest types | — | L |
| R9 | No payroll register/summary/reconciliation reports; no time/job-cost reports | routes absent | R1, R5 | M |
| R10 | Scheduling is single-assignment free text; no customers/sites source of truth, crews, recurring, conflicts | WorkAssignment only | — | L |
| R11 | Production ops unproven (backups/restore drills, monitoring, SMTP bounce handling, staging parity) | docs only | hosting | M |
| R12 | npm audit findings + Prisma 7 deprecation (from cleanup audit; re-verify) | PROJECT_CLEANUP_AUDIT.md | — | S |
| R13 | No e2e/visual tests; mobile behavior unverified at 390/768px | test suite is API/unit only | R2 | M |

---

## 4. First implementation batch (highest value, lowest dependency)

**Batch 1 — "truthful navigation + statutory safety" (targets R1, R2):**

1. Fix `apps/admin-web/src/lib/dashboard-nav.ts`:
   - "Paystubs" → `/dashboard/payroll/paystubs/preview` (exists).
   - Remove "Payroll exports" or point it at a real exports view on run detail; do not duplicate Pay runs.
   - Remove primary-nav "Bookmarks" (no such feature) — keep Reports.
   - De-duplicate "Users & roles" (keep under Admin) and "Audit reports"/"Activity log" (keep one).
   - Add "Government forms" (`/dashboard/payroll/forms`) under Payroll.
2. Statutory versioning schema (small migration): `StatutoryRateVersion` table (scheme, year, effectiveFrom/To, rates, ceilings, exemption, sourceUrl, verifiedAt, verifiedBy, approvedBy); seed with current defaults marked **unverified**; surface "unverified" warning in settings and pay-run review.

**Acceptance tests for Batch 1:** every sidebar/primary-nav label resolves to a distinct, purpose-matched page (scripted check); `typecheck`, `lint`, `test:api` still green; settings shows verification status; pay-run review preview unchanged numerically for seeded April 2026 data.

**Batch 2 (next):** cookie-session + CSRF + DB-backed throttle (R3/R4). **Batch 3:** historical/YTD payroll import (R5). **Batch 4:** payroll register + reconciliation reports (R9).

---

## 5. Verification status of this research

- Claims backed by files read this session: nav, statutory config, document storage, auth storage, app mounts, schema model list, page trees, test run output.
- Not verified this session: production build, browser behavior at any width, seeded payroll smoke flow (last passed 2026-04-24 per `HANDOFF.md`), SMTP delivery, `npm audit` current state.
- No code was modified.
