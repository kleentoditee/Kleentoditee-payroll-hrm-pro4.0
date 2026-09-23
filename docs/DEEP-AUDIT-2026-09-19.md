# KleenToDiTee Payroll HRM: Deep Audit


**Audit date:** 2026-09-19  
**Repository:** `C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0`  
**Audited checkout:** `cleanup/project-workflow-audit` at `5163b84` plus the current uncommitted worktree  
**Verdict:** The project contains a substantial working prototype, but it is not ready for live subscriber payroll, production accounting, or BVI year-end filing. The immediate blockers are missing production migrations, no tenant isolation, uncommitted implementation work, an incomplete accounting ledger, and unverified statutory configuration.

The word **VERIFIED** below means the implementation was found in code and the relevant automated checks passed. It does not mean production acceptance testing was completed. **PARTIAL** means some vertical layers exist but the workflow, migration, compliance proof, or production operation is incomplete. **UNVERIFIED** means the audit could not prove the behavior by running it.

## 1. Build & Merge Health

### Commands and actual results

| Check | Result | Evidence / consequence |
|---|---|---|
| `git status --porcelain` | **FAIL release gate** | 214 modified, deleted, or untracked paths in the main worktree. Most of Batches 1-8 are not committed. A clean checkout does not contain the audited product state. |
| `git branch -a` | **PASS informational** | Main checkout is `cleanup/project-workflow-audit`, not `codex/consolidate-live-build`. |
| `git log --oneline -20` | **PASS informational** | Main checkout HEAD is `5163b84 feat(staff-hub): Phase 3...`; `origin/main` is behind at `421e761`. |
| `git worktree list` | **PASS informational** | Five worktrees exist. The three named agent lanes are clean and their commits are ancestors of the audited checkout. |
| `npm run build` | **PASS** | Database package compiled; Next.js 16.3.5 built admin (55 routes) and tracker (12 routes); API TypeScript compiled. |
| `npm run typecheck` | **PASS** | All workspaces passed. |
| `npm run test:api` | **PASS** | 111/111 tests passed. These are primarily unit/service tests, not end-to-end browser or tenant-isolation tests. |
| `npm run lint` | **PASS with warning** | One Next.js warning at `apps/admin-web/src/app/dashboard/payroll/forms/page.tsx:343` for raw `<img>`. |
| `npm audit --json` | **FAIL** | 4 high findings in `@prisma/config`, `deepmerge-ts`, `mysql2`, and `prisma`; the suggested remediation changes Prisma major version. Do not apply blindly. |
| `prisma migrate status` | **FAIL release gate** | Eight migrations are present and all report unapplied in the local database because it was managed with schema push. More critically, migrations are absent for several implemented models. |
| Runtime HTTP check | **PARTIAL / operational failure** | Admin `:3000/login` and tracker `:3001/login` returned 200; API `:8787/health` and `/health/ready` refused connection. Pages can open while login and saved actions fail. |

### Worktree and merge state

| Worktree / branch | State versus audited checkout | Dirty state | Judgment |
|---|---|---:|---|
| Main `cleanup/project-workflow-audit` | Audited state | 214 paths | **Critical uncommitted WIP.** This is the only place most recent functionality exists. |
| `agent/codex/integration-qa` | 11 commits behind; 0 unique commits | Clean | Merged/absorbed; no stranded committed work. |
| `agent/claude/finance-core` | 17 commits behind; 0 unique commits | Clean | Merged/absorbed; no stranded committed work. |
| `agent/cursor/employee-tracker` | 23 commits behind; 0 unique commits | Clean | Merged/absorbed; no stranded committed work. |
| `codex/consolidate-live-build` | 8 commits behind; 0 unique commits | N/A | Stale integration branch; do not treat it as current. |
| `frontend/auth-client-cookie-ready` | 1 committed change ahead (`56feb29`) | 10 paths | **Stranded auth lane.** It also contains dirty shared-client work. The main checkout contains a different cookie-auth implementation, so this must be reconciled deliberately, not merged blindly. |

### Migration blocker

The migration directory has only the initial migration plus organization settings, employee authorization/email, payroll compliance, statutory forms/signature, and daily-location time. It has **no migration** for:

- `StatutoryRateVersion`
- `AuthRateLimit`
- `PayrollYtdOpeningBalance`
- `LeavePolicy`, `UNPAID_LEAVE`, and related payroll item fields
- `JournalEntry` and `JournalLine`

A fresh production deployment using `prisma migrate deploy` therefore cannot create the database required by Batches 1, 2, 3, 5, or 8. Local schema-push success conceals this defect.

## 2. Batch 1-8 Implementation Verification

| Batch | Status | Verified evidence | Missing / risk |
|---|---|---|---|
| 1. Navigation + statutory rate versions | **PARTIAL** | Navigation includes paystub preview, leave balances, payroll reports, and accounting import. `StatutoryRateVersion` exists in `packages/db/prisma/schema.prisma`; settings and seed code read/write it. | No migration. Payroll still calculates from mutable singleton `OrgSettings`, not an effective-dated, approved rate version frozen into each run. Seeded source/approval fields are unverified. |
| 2. HttpOnly cookie auth + CSRF | **PARTIAL** | `apps/api/src/lib/auth-cookies.ts`, `middleware/auth.ts`, both frontend `auth-storage.ts` files, and global API clients implement `kt_session`, readable `kt_csrf`, and `x-kt-csrf`. Tests pass; tracker checks the CSRF cookie rather than attempting to read HttpOnly session. | Bearer-token fallback remains. `apps/api/src/app.ts` CORS does not allow `x-kt-csrf` and does not enable credentials, so a truly cross-origin deployment will fail preflight/cookie use. No migration for rate limits; no MFA or session/device management. |
| 3. Historical/YTD import | **PARTIAL** | `PayrollYtdOpeningBalance`, `/payroll/ytd-opening-balances`, parser/preview/commit/delete logic, `/dashboard/payroll/ytd-import`, and tests exist. Payroll calculation consumes opening gross. | No migration. Aggregate opening balances do not recreate historical pay runs or payslips. Money is stored as `Float`. Imports can be deleted instead of locked/reversed. |
| 4. Payroll register and reconciliation | **VERIFIED (limited scope)** | `apps/api/src/lib/payroll-reports.ts`, report routes in `routes/payroll.ts`, admin `/dashboard/payroll/reports`, and tests are present. | This verifies register arithmetic and frozen-line reconciliation only. It is not a payroll-liability-to-GL reconciliation package and has no professional PDF/report snapshot. |
| 5. Leave/time off | **PARTIAL** | `UNPAID_LEAVE`, `LeavePolicy`, leave-day logic, staff-request routes, admin leave page, tracker balance card, and unpaid-leave fixed-pay proration exist; tests pass. | No migration. Policies are global, basic annual allowances, not tenant/employee/location scoped. No accrual schedule, carryover, holiday calendar, part-time proration, or robust payroll-period boundary rules. |
| 6. npm audit triage | **VERIFIED** | No `overrides` remain in package files; the failed override experiment was reverted. | Current audit is 4 high findings, not 3. Risk still requires a tested dependency remediation plan. |
| 7. Prisma 7.10 upgrade | **VERIFIED** | Prisma/client/adapter packages use 7.10; `packages/db/prisma.config.ts` exists; datasource URL is removed from schemas; `packages/db/src/index.ts` caches the real client rather than the proxy; no `--skip-generate` remains; build/tests pass. | Dependency audit remains red. Production migration history was not brought up to date. |
| 8. Double-entry GL slice 1 | **PARTIAL** | `JournalEntry`/`JournalLine`, decimal journal amounts, balancing validation, source-key idempotency, reversal journals, trial balance/ledger/journal reports, and admin pages exist. Invoice, payment, bill, bill-payment, expense, and payroll posting/reversal are in the same Prisma transaction as source status changes. Tests pass. | No migration; no tenant scope; deposits are not posted; no manual journals/approval, periods/locks, opening conversion, bank reconciliation, P&L, balance sheet, cash flow, retained earnings close, or final statement package. `sourceKey` and account codes are globally unique. Original journal status is not marked reversed; reports include entries without a status filter. Many source amounts are still `Float`. |

## 3. Requirements Completion Matrix

| K3 requirement | Status | What exists | What remains |
|---|---|---|---|
| Subscriber organizations / multi-tenancy | **MISSING - severity 1** | Singleton `OrgSettings`; role-based users. | No `Organization`, membership, `organizationId`, tenant-aware uniqueness, query scoping, storage/export/log boundaries, support-access control, migration, or adversarial cross-tenant tests. The product cannot safely be sold to multiple companies. |
| Authentication/session security | **PARTIAL** | HttpOnly cookie, CSRF double submit, token-version/status recheck, password reset, invitations, roles, audit logs. | Fix CORS/credential deployment contract, retire bearer fallback, add MFA/session revocation/device visibility, tenant membership authorization, security/e2e tests, and migrate rate-limit storage. |
| Employee records | **PARTIAL / broadly usable internally** | Create/edit/archive/restore, email, work authorization, photos, documents, payroll details, tracker access. | Production object storage, tenant scope, retention/access policies, bulk operations, onboarding workflow, and full permission tests. |
| Time tracking by daily location | **PARTIAL / strongest operational area** | Multiple locations per day, hours/break calculations, submit/approve/payroll integration, admin and tracker UIs. | Geofencing/clock proof if required, schedule comparison, overtime rule configuration, tenant/job costing, e2e/mobile acceptance, conflict validation. |
| Leave management | **PARTIAL** | Basic policies, balances, request review, unpaid leave payroll adjustment. | Accrual/carryover/holiday/part-time rules, policy assignment, locked historical balance ledger, tenant scope, richer reports. |
| Scheduling/rostering | **PARTIAL** | Basic work assignments and tracker schedule. | Recurrence, shifts, availability, coverage/conflicts, skills/crew planning, drag/drop, notifications, location/job costing, manager permissions. |
| Payroll run lifecycle | **PARTIAL** | Periods, draft/rebuild, preview, finalization, export, paid/void, paystubs, source time-state transitions, payroll GL accrual. | Migration safety, tenant scope, statutory certification, payment journal, liability settlement, bank integration, period locks, approval separation, full e2e parallel-run proof. |
| Historical payroll | **PARTIAL** | Aggregate YTD openings affect calculations/reports. | Detailed historical pay runs/payslips or a clearly separated legacy-document register; immutable import batch/audit/reversal. |
| BVI NHI | **PARTIAL / rate appears current** | Seed uses 3.75% employee + 3.75% employer and annual ceiling 106,800, matching the official 2026 NHI bulletin. | Effective-dated approved configuration must drive payroll; source URL, verification date, approver, period ceiling conversion, and boundary tests must be mandatory. |
| BVI SSB | **PARTIAL / ceiling unverified** | Seed uses 4% employee + 4.5% employer, matching the official SSB form/booklet. | The seeded annual ceiling 53,400 was not confirmed from a current official 2026 source during this audit. The official booklet located online lists an older 38,610 annual ceiling. Treat 53,400 as **UNVERIFIED**, not production authority. |
| BVI payroll tax | **PARTIAL** | Employee 8%, annual exemption 10,000, Class 1/2 structure, calculation tests, government-form foundation. | Company class defaults to `NOT_SET`; employer rate must be confirmed and approved before every live run. Rate rules are not effectively versioned/frozen by `StatutoryRateVersion`. Current official confirmation and filing acceptance tests are required. |
| No PAYE income tax | **PARTIAL cleanup required** | Runtime statutory configuration disables income tax and tests assert zero. | Schema, reports, paystubs, templates, imports, GL account 2400, seed wording, and test fixtures still carry `incomeTax`. This is confusing and could reintroduce a non-BVI deduction. Remove or rename as a jurisdiction extension that is disabled outside configured jurisdictions. |
| Government NHI/SSB forms | **PARTIAL** | Official-looking previews/PDF-generation foundation, employee rows, signature/date support, tests. | Owner acceptance against current official originals, pagination/overflow cases, filing-period locks, versioned source forms, e2e download tests, and tenant/company scope. |
| Chart of accounts + journal core | **PARTIAL** | Accounts, journal/line, automated postings, trial balance, ledger, journal list. | Tenant scope, reporting hierarchy/normal-balance metadata, manual/approved journals, attachments, fiscal periods, opening balances, recurring/adjusting journals, and migrations. |
| Sales/accounts receivable | **PARTIAL** | Customers, products/services, invoices, send/void, payments and GL postings. | Credits/refunds, write-offs, statements, aging from ledger, tax/configuration depth, numbering controls, email delivery, tenant scope. |
| Purchases/accounts payable | **PARTIAL** | Suppliers, bills, payments, expenses and GL postings. | Supplier credits/refunds, aging from ledger, purchase orders/approvals, attachments, tenant scope. |
| Deposits/undeposited funds | **PARTIAL UI, MISSING GL** | Deposit CRUD/screens exist. | Deposit posting/reversal, undeposited funds clearing, grouping customer payments, bank-register effect, tests. |
| Banking and reconciliation | **MISSING** | Account records can represent bank/cash accounts. | Statement CSV/OFX import, duplicate detection, matching/rules, reconciliation sessions, lock/undo, outstanding items, running bank register, audit history. |
| Fiscal years/period locks | **MISSING** | Date filters only. | Fiscal year and period entities, open/soft-close/locked states, permissioned reopen, close checklist, source-transaction enforcement. |
| Financial statements | **MISSING** | Trial balance and basic operational summaries. | Ledger-derived P&L, balance sheet, cash flow, equity statement, comparatives, notes, mappings, drill-down, report snapshots, PDF/CSV/XLSX. The app cannot presently create a professional annual financial statement package. |
| Year-end close | **MISSING** | None verified. | Adjustments, review/approval, retained earnings close, period lock/reopen, reproducible final package and audit history. |
| BVI annual return / Inland Revenue support | **MISSING** | Requirements documentation and some payroll forms only. | Applicability questionnaire, mapping to official 2023 Schedule, registered-agent workflow, Inland Revenue supporting package, source/version metadata, owner review, draft/final locks, exports. Do not label anything “ready to file” yet. |
| Job/location profitability | **PARTIAL data foundation** | Time entries capture locations; finance and payroll data exist. | Stable customer/job/location dimensions and ledger/report allocation linking labor, revenue, expenses, and gross margin. |
| WhatsApp direct chat | **MISSING** | Generic `api.whatsapp.com/send?text=` link. | E.164 number normalization and `wa.me/<employee-number>?text=...`, invalid-number handling, device tests, no sensitive data. |
| WhatsApp provider sending | **MISSING** | Notification table is only a foundation. | Provider adapter, tenant settings/secrets, consent, templates, queue/retry/DLQ, signed webhooks, delivery status/costs. |
| Transactional email | **PARTIAL** | SMTP invitation and password-reset messages. | Tenant sender/domain controls, templates, queue/retry/idempotency, delivery logs/webhooks/suppression, test email/settings, paystub/request/schedule/invoice events, monitoring. |
| Production document storage | **MISSING** | Local disk storage works; interface exists. | S3/R2 implementation explicitly throws `not implemented`; add private buckets, scoped keys, signed access, malware/content validation, retention, backup/restore tests. |
| Reports and exports | **PARTIAL** | Payroll CSV/register/year summary; GL trial balance/journal/ledger; some finance summaries. | Professional PDF/XLSX, snapshots, comparisons, statement suite, tenant scope, report permissions, exhaustive reconciliation. |
| Multi-currency | **MISSING / incorrect UI** | Most app data assumes one currency. | Currency model/rates/realized-unrealized rules if multi-currency is intended. Two customer pages hardcode `BZD`, which is wrong for BVI; base currency should be configurable and typically USD. |
| Onboarding/recruiting/performance | **MISSING or foundation-only** | Employee invitation and records; rewards/quiz foundations. | Applicant tracking, offer/onboarding checklists, e-signatures, offboarding, goals/reviews, training/compliance workflows. |
| Audit trail / RBAC | **PARTIAL** | Roles, route guards, audit records on several actions. | Tenant-aware permissions, separation of duties, object-level access, financial approval roles, immutable audit export, authorization tests for every sensitive route/download. |
| Mobile/tablet quality | **UNVERIFIED** | Responsive components and separate employee tracker exist. | No completed device matrix or automated visual/e2e suite was found. This audit did not sign into every role/page at all widths; those claims remain unverified. |
| Backups/restore/operations | **PARTIAL scripts only** | Deployment docs and export/restore scripts exist. | Staging restore drill, encrypted scheduled backups, object-store backup, RPO/RTO, monitoring/alerts, incident process, deployment acceptance proof. |
| End-to-end and visual release gates | **MISSING** | 111 API/service tests and successful builds. | Playwright/Cypress workflows, browser role matrix, desktop/tablet/phone screenshots, migration-from-clean and migration-from-existing tests, cross-tenant tests, failure-path tests. |

### Statutory and filing source check

- **NHI 2026:** Official bulletin confirms 7.5% total, split 3.75%/3.75%, and maximum insurable earnings of 106,800 annually. Source: https://www.vinhi.vg/wp-content/uploads/2025/09/NHI-Maximum-Insurable-Earnings-2026.pdf
- **SSB contribution rates:** Official remittance form confirms employee 4%, employer 4.5%, total 8.5%. Source: https://bvissb.vg/PDF_files/Contribution_FORM2.pdf
- **SSB ceiling:** The current official ceiling matching the seed value 53,400 was not located. The older official booklet shows 38,610 annually. The app's ceiling must remain unapproved until BVI SSB confirms it. Source: https://www.bvissb.vg/PDF_files/ContributionsBooklet.pdf
- **Payroll tax:** The government guide/form supports Class 1 total 10%, Class 2 total 14%, employee 8%, employer 2%/6%, and 10,000 annual exemption, but the guide is old. Source: https://bvi.gov.vg/sites/default/files/resources/Guide%20to%20Payroll%20Tax.pdf
- **BVI company annual return:** The official Order and FSC guidance require the prescribed annual return and generally filing with the registered agent within nine months after financial year-end, subject to statutory exemptions. Sources: https://www.bvifsc.vg/library/legislation/bvi-business-companies-financial-return-order-2023 and https://www.bvifsc.vg/news/industry-updates/industry-circular-26-2025-filing-initial-annual-returns

## 4. Competitor Feature Matrix (BVI-Weighted)

Legend: **Strong** = mature native capability; **Partial** = limited/add-on/region-dependent; **No BVI** = product exists but does not provide BVI payroll compliance.

| Feature | This app | QuickBooks Online | Xero | Gusto | BambooHR | Wave | BVI gap severity |
|---|---|---|---|---|---|---|---|
| Payroll + statutory filings | **Partial; BVI-specific but unapproved** | Strong US/selected markets; **No BVI** | Payroll region/add-on dependent; **No BVI** | Strong US; **No BVI** | Strong US/global HR; **No BVI payroll proof** | US/Canada only; **No BVI** | **2**. This app can become genuinely ahead for BVI, but incorrect rates are worse than no feature. |
| Double-entry GL | Partial core | Strong | Strong | Accounting integration, not full GL | Not accounting core | Strong small-business accounting | **2** |
| Invoicing / billing | Partial | Strong | Strong | Limited/non-core | Non-core | Strong | **3** |
| Banking / reconciliation | Missing | Strong | Strong | Non-core | Non-core | Strong where supported | **2** |
| Employee self-service | Partial working foundation | Strong with payroll | Via payroll integrations/regions | Strong | Strong | Partial, region-dependent | **3** |
| Time tracking | Partial, multi-location manual | Strong via QuickBooks Time | Projects/time features | Strong, mobile/geofence | Strong | Limited payroll timesheets | **3** |
| Leave/PTO | Basic | Partial with payroll/time | Region/integration dependent | Strong | Strong | Basic | **3** |
| Scheduling/rostering | Basic | Stronger via Time | Limited/integrations | Moderate | Moderate | Weak | **3** |
| HR records/documents | Partial | Basic payroll HR | Not HR core | Strong | Strongest | Basic | **3** |
| Onboarding/recruiting | Missing | Partial | Not HR core | Strong | Strong | Basic | **3** |
| Performance management | Missing | Weak | Weak | Available | Strong | Weak | **5** |
| Financial reports | Trial balance only | Strong | Strong | Payroll reports only | HR/payroll reports | Strong basic accounting | **2** |
| BVI annual-return package | Missing | Generic statements only | Generic statements only | No | No | Generic statements only | **4**, but a major product opportunity. |
| Multi-currency | Missing; two BZD bugs | Plan/region dependent | Strong | Not accounting core | Not accounting core | Limited/location dependent | **3** |
| Multi-company subscriber isolation | Missing | Mature SaaS isolation | Mature SaaS isolation | Mature SaaS isolation | Mature SaaS isolation | Mature SaaS isolation | **1** |
| Mobile | Responsive code, unverified | Mature mobile | Mature mobile | Mature mobile | Mature mobile | Mobile apps/web limits | **3** |
| Integrations | File import only | Large ecosystem | 1,000+ apps | Broad HR/payroll | Broad HR | Smaller ecosystem | **3** |
| Audit trail | Partial | Strong accounting audit | Strong accounting audit | Strong payroll controls | Strong HR controls | Moderate | **2** |
| Role-based access | Partial/global | Strong/plan dependent | Strong | Strong | Strong | Basic collaborator roles | **1** until tenant/object authorization tests exist. |

### Plain competitive conclusion

The app is genuinely differentiated only in its intended **BVI payroll and government-form focus**, plus cleaning-company multi-location time entry. Gusto, QuickBooks Payroll, Xero's payroll partners, BambooHR payroll, and Wave payroll do not provide BVI statutory payroll out of the box. That advantage is currently **potential, not proven**, because SSB ceilings and version selection are not certified and the needed migrations are absent.

Regardless of jurisdiction, the app is far behind QuickBooks, Xero, and Wave in bank reconciliation, complete ledger workflows, financial statements, period close, exports, and reliability controls. It is far behind Gusto and BambooHR in onboarding, configurable leave, communications, performance, and polished mobile workflows. It should not be marketed as equivalent to any of them yet.

Official comparison references used: QuickBooks bank reconciliation/features (https://quickbooks.intuit.com/accounting/bank-reconciliation/), Xero bank reconciliation/reports (https://www.xero.com/us/accounting-software/reconcile-bank-transactions/), Gusto product capabilities (https://gusto.com/product), BambooHR platform (https://www.bamboohr.com/platform/), and Wave availability/features (https://support.waveapps.com/hc/en-us/articles/32449161224852-Create-a-Wave-account and https://www.waveapps.com/).

## 5. Prioritized Gap List

### Severity 1: data loss / security / deployment

1. **No tenant isolation.** Every subscriber would share globally queried tables, account codes, source keys, settings, employees, payroll, files, and reports. Next slice: add Organization + Membership and tenant keys, backfill current data to one organization, then enforce scope in middleware/repositories and adversarial tests before accepting a second company.
2. **Missing migrations for Batches 1/2/3/5/8.** A clean deployment cannot run the audited code. Next slice: generate reviewed additive migrations, test on a production-shaped copy, run deploy-from-clean and upgrade-from-current checks, and document rollback/backup.
3. **214-path dirty worktree and stranded auth lane.** The product cannot be reproduced or safely deployed. Next slice: classify every diff, exclude secrets/artifacts, reconcile auth implementations, and make small verified commits. Do not make a single “everything” commit.
4. **Production document storage absent.** Employee/government documents remain local or fail when S3/R2 is selected. Next slice: private object storage with tenant-scoped keys, signed downloads, validation, backup, and authorization tests.
5. **Authorization proof incomplete.** Roles exist, but no exhaustive object/tenant access tests exist. Next slice: permission matrix tests for payroll, employee documents, paystubs, exports, journals, and admin actions.

### Severity 2: payroll/accounting correctness

6. **Statutory versions do not drive calculations.** Rates can be changed in mutable settings and current seed approval is incomplete. Next slice: effective-date selection, locked run snapshot with source/version/approver, boundary tests, and owner confirmation gate.
7. **SSB ceiling is unverified.** The seed value cannot be accepted as law without a current BVI SSB source. Next slice: obtain official written/current confirmation, record source and effective date, and test weekly/biweekly/semimonthly/monthly caps.
8. **Legacy income-tax concepts remain throughout a no-PAYE BVI system.** Next slice: remove them from BVI UI, reports, imports, seed templates, and GL, or isolate them behind a future jurisdiction module.
9. **Accounting is incomplete.** Deposits do not post; no periods, manual journals, bank rec, financial statements, or closing. Next slice: fiscal periods + deposit/undeposited funds + opening balance conversion before adding more reports.
10. **Source transactions use Float money.** Journals are decimal, but float-derived values can still introduce rounding/reconciliation defects. Next slice: migrate monetary fields/calculation boundaries to decimal-safe types and add invariant tests.
11. **Payroll paid state has no cash/liability-settlement journal.** Finalization accrues wages/liabilities, but marking paid only updates status/time. Next slice: post net wage payment and later statutory remittances through bank/control accounts with idempotent reversals.

### Severity 3: blocked workflows

12. **API startup is not operationally reliable.** Frontends were running while port 8787 was down. Next slice: one supervised launcher with readiness checks, visible failure reason, retry, and clean shutdown; prove login/save/download after cold start.
13. **No bank reconciliation.** Books cannot be trusted against bank statements. Next slice: statement import, duplicate detection, matching, session difference, complete/undo lock, and audit.
14. **Historical import cannot issue historical payslips.** Next slice: either import detailed historical runs/documents or explicitly label opening balances as calculation-only and provide a separate legacy payslip archive.
15. **Email and WhatsApp are incomplete.** Next slice: direct numbered WhatsApp link first; then a reusable queued email service with event templates and delivery status.
16. **Scheduling and leave remain basic.** Next slice: recurrence/conflict/coverage plus assignment notifications; accrual/carryover and policy assignment.

### Severity 4: compliance / filing exposure

17. **No year-end financial statement package or BVI annual-return mapping.** Next slice: only after ledger/bank/close are correct, build reproducible statement snapshots and map them to the official annual-return categories with registered-agent applicability guidance.
18. **Government form acceptance is not proven.** Next slice: current-form version registry, sample employee edge cases, preview/download e2e tests, owner review, and locked finalized output.
19. **Backup/restore is not proven.** Next slice: scheduled encrypted DB/object backups and a documented restore drill in staging.

### Severity 5: UX / polish

20. **No full role/device visual pass.** Next slice: Playwright role workflows and screenshot assertions at phone, tablet, and desktop widths; remove remaining development/correction wording and dead states.
21. **Currency and stale jurisdiction wording.** Replace BZD with organization-configured USD display and remove Belize/test language from live data/tests/docs where it can leak to users.

## 6. Recommended Next Three Batches

### Batch 9: Reproducible database and branch baseline

**Scope:** no new features. Inventory the 214 dirty paths; reconcile or retire the separate auth worktree; add the missing additive migrations for Batches 1/2/3/5/8; preserve existing data; remove generated artifacts from Git scope; create coherent commits.

**Acceptance:** clean checkout installs, migrates an empty database, upgrades a copy of the current database, builds, passes 111 tests/typecheck/lint, starts all services, and completes admin/tracker login plus one read/write workflow. Commit migration and feature groups separately.

### Batch 10: Organization isolation security slice

**Scope:** `Organization`, `OrganizationMembership`, tenant-scoped `OrgSettings`, accounts, employees, payroll, time, documents, audit, imports, journals, notifications, and finance records; backfill all current rows to KleenToDiTee; organization-aware unique keys; server-side scope middleware/repository helpers; explicit platform-support access.

**Acceptance:** two seeded test organizations; automated tests prove that IDs, downloads, exports, searches, updates, and deletes cannot cross tenants; all current workflows still pass; no route trusts a client-supplied tenant ID without membership validation.

### Batch 11: Accounting integrity slice 2

**Scope:** fiscal years/periods with lock enforcement; opening-balance conversion; manual journal draft/approve/post/reverse; deposit and undeposited-funds posting; payroll net-pay and statutory-remittance journals; decimal-safe money migration plan.

**Acceptance:** every source event posts once in the same transaction; reversal restores balances; locked periods reject source edits/posting; trial balance remains balanced; AR/AP/payroll/bank control accounts reconcile in tests; migrations and browser workflows pass. Bank reconciliation and financial statements become the following batches, not squeezed into this one.

## Final Release Decision

**NO-GO for live multi-subscriber use, live payroll authority, or owner-generated statutory financial statements.**  
**Conditional internal-use pilot only:** acceptable after Batch 9, verified BVI statutory settings, tested backup/restore, and a parallel payroll comparison against independently calculated results. Do not process live payroll solely from this application until those controls pass.
