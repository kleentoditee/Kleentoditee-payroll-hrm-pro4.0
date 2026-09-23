# Kimi K3 Final Combined Shipping Build Prompt

Copy this entire document into Kimi K3. This is an implementation assignment. Do not return another general audit or redesign proposal.

---

## Role

You are the principal engineer responsible for taking **KleenToDiTee Payroll HRM** from its current verified build to a production-ready internal release and then a subscriber-ready release.

You must inspect the real repository, preserve completed work, finish the active production-delivery work, implement the remaining QuickBooks file-migration and Celery-inspired HR capabilities, verify every workflow, and commit only coherent, tested changes.

Work in:

```text
C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0
```

Use the current integration branch and repository rules. Do not create a replacement prototype. Do not stop after writing a plan. Continue through implementation, database migration, API, UI, permissions, audit history, automated tests, visual checks, documentation, and commits for each accepted batch.

## Read first

Before changing code, read these files in this order:

```text
AGENTS.md
TASKS.md
HANDOFF.md
docs/SHIPPING-PLAN.md
docs/FINAL-SHIPPING-PLAN-CELERY-QBO-2026-09-20.md
docs/CELERY-COMPARISON-2026-09-20.md
docs/KIMI-K3-COMPLETE-APP-IMPLEMENTATION-PROMPT.md
README.md
package.json
packages/db/prisma/schema.prisma
```

The active master plan is `docs/SHIPPING-PLAN.md`. The Celery and QuickBooks document is an active addendum. Older audits are historical evidence, not permission to repeat already completed work.

## Current verified position

Treat this as the starting truth, but verify it against Git and the running application before editing:

- Batch 10 reproducible baseline, migrations, and authentication deployment contract: complete.
- Batch 11 BVI payroll statutory truth and payroll posting lifecycle: code complete. Remaining Gate A operational evidence is an actual backup/restore drill, owner statutory sign-off, and one monitored parallel live payroll run.
- Batch 12 multi-tenant foundation: gate passed with 21/21 adversarial checks.
- Batch 13 accounting integrity and fiscal period control: gate passed with 30/30 live checks.
- Batch 14 banking and reconciliation: gate passed with 32/32 live checks.
- Batch 15 financial statements, year-end close, and BVI filing-support foundation: gate passed with 41/41 live checks.
- Last fully verified baseline before active Batch 16: API tests 168/168, typecheck passed, lint passed with one raw image warning, and all applications built successfully.
- Batch 16 production delivery and communications is active and has uncommitted work in storage, email outbox, WhatsApp links, admin screens, API routes, Prisma, Playwright, and end-to-end tests.

Do not overwrite, reset, discard, or blindly include the current Batch 16 work. Inspect every dirty file and continue from the implementation that is actually present.

## Non-negotiable product decisions

1. This is a **British Virgin Islands** application, not Belize.
2. KleenToDiTee is its own payroll, HR, time, cleaning-operations, finance, and accounting platform.
3. QuickBooks Online is a migration source only. Build **file import**, never QuickBooks OAuth, background synchronization, or a continuing QBO dependency.
4. Celery is a workflow benchmark only. Do not copy its branding, proprietary code, or page designs.
5. After an accepted cutover, KleenToDiTee becomes the system of record. Keep QuickBooks available as read-only evidence through at least one month-end and one year-end evidence cycle, or longer if the accountant advises.
6. Never label system-produced financial statements audited, reviewed, certified, or officially filed. Use `Management-prepared` and `Unaudited` unless an authorized professional supplies assurance.
7. Never make an unverified legal or tax-compliance claim. Statutory rules must have source, effective date, verification date, and owner approval.
8. Never hard-delete posted payroll or accounting history. Use archive for people/master data and void/reversal/replacement for financial history.
9. No visible placeholder, `Coming soon`, fake action, AI repair note, developer explanation, mock total, or dead navigation item may remain in production UI.
10. Do not seed a live database. Do not commit secrets, `.env` files, uploads, exports, backup files, local database files, `.next`, `node_modules`, Playwright artifacts, or test results.

## Shared-worktree safety

This repository is shared by the owner and multiple AI agents.

1. Record the branch, `git status`, recent commits, migration status, and all changed/untracked files before editing.
2. Read `TASKS.md` and claim one lane. Use an isolated worktree when possible.
3. Add a `Shared File Locks` entry before changing Prisma, root package files, environment examples, `apps/api/src/app.ts`, or another shared route/service.
4. Never reset or revert changes you did not create.
5. If an active change affects the same file, understand and extend it rather than replacing it.
6. Commit one coherent, verified slice at a time. Do not combine unrelated owner work.
7. Update `TASKS.md` after each gate with exact verification results and remaining blockers.

## Required execution method

For every batch:

1. Inspect the existing implementation and prove the current behavior.
2. Write a short implementation checklist in `TASKS.md`, with owned files and shared-file locks.
3. Implement the smallest complete vertical slices: schema, additive migration, service, route, permissions, audit, UI, errors, responsive layout, tests.
4. Apply migrations safely. Never use destructive schema push against owner data.
5. Run focused tests while developing.
6. Run the complete verification gate before committing.
7. Start the platform without reseeding owner data and test the real workflow in the browser.
8. Check desktop, tablet, and phone layouts for clipping, horizontal overflow, overlapping controls, inaccessible actions, and excessively long single-page forms.
9. Remove temporary data and generated artifacts without deleting owner records.
10. Run CodeRabbit when available and verify each suggestion before changing code.
11. Commit and push coherent work. Report commit hashes, test counts, screenshots/evidence, and genuine blockers.

Do not proceed to a later batch while the current gate is failing.

## Product-wide workflow standard

Every workflow must have:

- a clear start and completion state;
- organization and role authorization on the server;
- database constraints and transaction boundaries;
- validation that explains the exact field or row to fix;
- loading, empty, success, error, retry, and locked states;
- audit history with actor, organization, action, date, and affected record;
- safe mobile/tablet layout and keyboard accessibility;
- no duplicated submission on refresh or retry;
- visible final status and a way to return to the relevant list/detail page;
- automated tests for success, permission denial, validation failure, and repeat submission.

## Core user workflows that must ship

### 1. Organization setup

Owner creates or reviews the company profile, BVI identifiers, addresses, fiscal year, currency, timezone, accounting basis, statutory class, NHI/SSB identifiers, bank accounts, payroll schedules, statutory rate version, chart of accounts, control accounts, email sender, private storage, and backup destination.

The setup checklist must show what is complete, what blocks payroll, what blocks accounting close, and what is optional. A subscriber cannot finalize payroll or a financial package when required configuration is missing.

### 2. Employee lifecycle

Create employee through compact tabs or steps:

1. Profile: name, email, phone, address, emergency contact, photo.
2. Employment: start date, current/ended status, optional end date, department, position, manager, schedule, default operational site.
3. Immigration: Belonger, Resident, BVIslander, Work Permit, or other approved status. Permit number and expiry appear and become required only for Work Permit.
4. Payroll: pay type, rate/salary, schedule, bank/payment details, deductions, NHI, SSB, payroll tax treatment.
5. Government IDs: organization-approved identifiers with masked display and strict permissions.
6. Documents: private upload, preview/download, expiry date, reminder, archive.
7. Access: invitation, role, tracker status, reset/suspend, communication history.

Employee list requirements:

- employee names and photos open the edit/detail workflow;
- no redundant Edit text button when the name is the clear link;
- Archive is visually separated and confirmed;
- Current and Archived views are distinct;
- restore is available from Archived;
- archive never deletes payroll, time, document, or audit history;
- photo replacement removes the old active reference after the new private file is stored successfully;
- photo crop supports drag, zoom, touch, and stylus and displays the image before saving.

### 3. Time and multi-location work

An employee or authorized admin creates a daily time sheet with multiple work segments on the same day.

Each segment contains customer/job, operational site/location, start, finish, unpaid break, calculated hours, optional task/service, and note. Provide an `Add location` or `Add work segment` action. Validate overlaps and impossible times. Calculate daily and period totals from segments, not from one location field.

Workflow:

`draft -> submitted -> approved` or `rejected/returned -> corrected -> resubmitted`.

Employee names on time lists open the time detail/editor. Draft rows expose Submit. Submitted rows cannot be silently edited by an approver. Approval records the reviewer and timestamp. Approved time is locked into payroll by source reference so it cannot be counted twice.

### 4. Payroll

Workflow:

1. Create/select a pay period.
2. Import approved time and approved payroll adjustments.
3. Resolve warnings for missing rates, employee identifiers, statutory settings, or overlapping periods.
4. Preview each employee pay calculation before creating/finalizing the run.
5. Open a professional paystub preview for every employee before finalization.
6. Compare totals by employee, department, cost centre, work site, earnings, deductions, employer costs, net pay, and liabilities.
7. Approve/finalize using the versioned statutory configuration.
8. Post the balanced payroll journal exactly once.
9. Mark payment and post settlement.
10. Record NHI/SSB/payroll-tax remittance and post liability settlement.
11. Deliver paystub notification by email and make the authenticated paystub available in the tracker.
12. Void only through an explicit reversal workflow.

Paystub and payslip are the same employee-facing pay statement in this product. Use one consistent term in navigation and user help, preferably `Paystubs`, while supporting `Payslip` only where an official form or customer locale requires it.

Historical payroll workflow:

- allow controlled YTD/opening payroll history from January or the chosen conversion date;
- distinguish imported historical/YTD values from native finalized runs;
- prevent historical values from posting twice to the GL;
- use historical values for statutory/YTD calculation and employee paystub history only when source evidence is stored;
- label imported paystubs clearly and preserve the source file/reference.

### 5. Government forms

NHI and SSB forms must be generated from finalized/locked payroll data and complete employee records.

Requirements:

- all required employee identifiers, name, sex where officially required, earnings, employee contribution, employer contribution, and totals;
- company name, NHI/SSB numbers, period, signature, and date;
- real-time preview when company identifiers, period, signature, or date change;
- smooth touch/stylus signature pad with appropriate thin stroke, pointer-event support, undo/clear, and saved-signature replacement;
- signature and date fit the original official spaces without overlap;
- month names fit their form cells and do not overlap borders;
- both SSB Form I and Form II are present when required;
- PDF/download reproduces the preview and original official layout;
- missing-data list links directly to the employee/company field requiring correction;
- forms remain reproducible from locked payroll snapshots.

### 6. Accounting operations

Native workflows must continue to use the verified double-entry engine:

- customer -> estimate -> invoice -> payment/application -> receipt/credit/refund;
- supplier -> purchase order -> bill -> bill payment/application -> supplier credit/refund;
- expense, deposit, transfer, check, owner contribution/draw, asset, loan, and manual journal;
- open, soft-close, lock, reopen permission, reversal, and year-end close;
- bank statement import -> candidate matching -> reconciliation -> completion/controlled undo;
- drill-down from statements to journal to source document and evidence.

Never bypass fiscal-period locks or create journal entries outside the normal posting service.

### 7. Financial statements and year-end filing support

Workflow:

1. Select fiscal year and accounting basis supported by the ledger.
2. Review unresolved bank reconciliation, AR/AP, payroll liabilities, unposted drafts, control-account differences, and open periods.
3. Post approved adjustments through manual journals.
4. Generate trial balance and compare to subledgers.
5. Prepare Statement of Financial Position, Profit or Loss, Cash Flows, Changes in Equity, and supporting schedules.
6. Edit versioned accounting policies and notes without changing ledger values.
7. Add preparer/reviewer, management approval, signature, and date.
8. Preview a professionally paginated package.
9. Finalize and lock a reproducible snapshot.
10. Export PDF, spreadsheet, CSV where appropriate, and machine-readable evidence.
11. Prepare separate BVI Inland Revenue and registered-agent filing-support packages based on organization applicability.

All totals must derive from posted journal lines and reconcile to the locked trial balance. Reports need prior-period comparison, rounding/display settings, negative-number format, page numbers, repeated headers, no clipping, and drill-down in the web view.

### 8. Communications

Email workflow:

`event -> template snapshot -> queued -> sending -> delivered` or `failed -> retry/dead-letter/cancelled`.

Support invitation, password reset, paystub available, staff-request decision, schedule change, announcement, invoice, receipt, statement, and year-end package notification. Never email passwords, government IDs, raw private documents, or permanent public links. Sensitive documents require sign-in or a short-lived authorized link.

WhatsApp direct-chat workflow:

- normalize a valid international number;
- open `wa.me/<number>?text=<encoded message>`;
- allow installed app handoff where the device supports it;
- accept desktop/web fallback as normal;
- disable with a useful error if the number is missing or invalid;
- never place private payroll, identity, or permanent document URLs in the message.

Do not claim this is automatic sending. Automatic WhatsApp requires a later approved Business Platform provider, credentials, consent, templates, webhooks, queue, and cost controls.

## Batch 16: finish production delivery and communications first

Complete the existing active implementation. Do not restart it.

### Private storage

- S3/R2-compatible provider with organization-prefixed keys.
- Private buckets only; no public listing or permanent object URL.
- MIME/content inspection, extension normalization, size limits, malicious filename protection, and checksum.
- Authorized upload, download, replace, and delete/archive behavior.
- Signed URLs must be short-lived and scoped.
- Database update and object replacement must fail safely without losing the previous file.
- Cover employee documents, profile photos, migration source files, statement evidence, and generated exports.

### Email outbox

- Finish the outbox schema/migration already present.
- Generic provider interface, local test transport, production SMTP/provider adapter.
- Idempotency key per business event and recipient.
- Bounded retries with exponential backoff, failure reason, next-attempt time, dead-letter state, retry/cancel admin controls.
- Provider configuration validation and safe test email.
- Delivery log linked to organization, recipient, template version, related entity, and audit event.
- Never show `sent` merely because a row was queued.

### WhatsApp direct links

- Finish the existing utility and replace every recipient-less generic link.
- Test BVI numbers, international numbers, missing/invalid numbers, mobile app handoff, and desktop fallback.

### Operations

- Health/readiness checks that verify API, database, storage configuration, and queue health without exposing secrets.
- Structured logs with organization/user/request correlation and sensitive-field redaction.
- Scheduled database and document backups.
- Restore into a clean staging environment and record timing, checksums, and evidence.
- Incident runbook for authentication, database, storage, email, and migration failure.

### End-to-end coverage

Playwright must prove critical workflows at desktop, tablet, and phone sizes:

- admin sign-in/sign-out/reset/invitation;
- employee create/edit/archive/restore and photo/document handling;
- tracker sign-in and daily time submission;
- admin time approval;
- pay-period/run preview/finalize/paystub;
- government-form preview/download;
- finance posting, bank reconciliation, and financial-statement preview;
- email queue status and WhatsApp direct-chat action.

**Gate 16:** tests, typecheck, lint, builds, migrations, private-storage checks, email observability, backup/restore proof, and critical responsive workflows all pass. Remove generated `test-results` from Git before committing.

## Batch 17: accounting migration safety

The existing `quickbooks-accounting-import.ts` supports CSV/XLSX previews for customers, vendors, accounts, products, invoices, bills, expenses, payments, and deposits. It is not safe for real books yet.

Fix these confirmed blockers:

- all lookup, duplicate, and find-or-create queries must include `orgId`;
- no row-by-row partial commit;
- no missing persistent batch/file/row/source lineage;
- no collapsed invoice or bill lines;
- no opening balances hidden in notes;
- no paid invoice amount without payment applications;
- no unapplied imported payment when source application data exists;
- no imported financial transaction outside the native posting engine;
- no silent fallback creation of generic customer, supplier, product, or account;
- no acceptance without control-total reconciliation;
- no 5 MB/5,000-row/single-sheet assumption for a full migration package;
- no summary-only audit record.

### Add organization-scoped models

Implement equivalent models with appropriate enums, timestamps, indexes, foreign keys, and audit fields:

```text
AccountingImportBatch
  orgId, sourceSystem, sourceCompanyId, mode, cutoffDate, status
  createdBy, approvedBy, acceptedBy, reversedBy
  createdAt, validatedAt, approvedAt, importedAt, reconciledAt, acceptedAt, reversedAt
  inventory totals, imported totals, rejected totals, warning totals
  parserVersion, notes, failureReason

AccountingImportFile
  batchId, orgId, originalName, detectedType, byteSize, sha256
  privateStorageKey, sourceCategory, dateFrom, dateTo
  parserVersion, status, rowCount, metadata

AccountingImportRow
  batchId, fileId, orgId, sourceSheet, sourceRow
  sourceEntityType, sourceEntityId, sourceReference
  normalizedPayload, validationStatus, warnings, errors
  selectedAction, destinationType, destinationId, committedAt

ExternalSourceRef
  orgId, sourceSystem, sourceCompanyId
  sourceEntityType, sourceEntityId
  destinationType, destinationId
  immutable organization-aware uniqueness

MigrationReconciliation
  batchId, orgId, controlName, sourceAmount, destinationAmount
  difference, tolerance, status, evidence, reviewedBy, reviewedAt

LegacyDocument
  orgId, batchId, sourceType, sourceId, title, metadata
  privateStorageKey, sha256, destination links, status
```

### Import state machine

Use this explicit lifecycle:

```text
uploaded -> inventoried -> mapped -> validated -> approved -> importing
         -> reconciled -> accepted
```

Failure/end states:

```text
rejected | failed | reversed
```

Rules:

- Preview, inventory, mapping, and validation never mutate accounting data.
- Only approved batches can import.
- Commit is one database transaction where feasible or deterministic bounded chunks with recorded checkpoints and a whole-batch reversal plan.
- Repeat import with the same source references creates zero duplicates.
- A failed chunk can resume without repeating successful source records.
- Accepted postings are corrected by reversal and a replacement batch.
- Every row ends as imported, archived, intentionally excluded, duplicate, or rejected.
- Every rejected/warning row appears in a downloadable error workbook/CSV.

### Import API

Use the existing route conventions, with endpoints equivalent to:

```text
GET    /imports/accounting/batches
POST   /imports/accounting/batches
GET    /imports/accounting/batches/:id
POST   /imports/accounting/batches/:id/files
POST   /imports/accounting/batches/:id/inventory
PUT    /imports/accounting/batches/:id/mappings
POST   /imports/accounting/batches/:id/validate
POST   /imports/accounting/batches/:id/approve
POST   /imports/accounting/batches/:id/commit
POST   /imports/accounting/batches/:id/reconcile
POST   /imports/accounting/batches/:id/accept
POST   /imports/accounting/batches/:id/reverse
GET    /imports/accounting/batches/:id/errors
GET    /imports/accounting/batches/:id/audit
```

Use platform-owner/finance roles and separation of duties where supported. All mutations require CSRF/auth protections and organization scope.

### Import UI

Create an Accounting Import workspace with:

- dashboard of batches, source, mode, cutoff, status, counts, differences, and owner;
- wizard steps: Source, Upload package, Inventory, Map, Validate, Approve, Import, Reconcile, Accept;
- batch tabs: Files, Rows, Mappings, Results, Reconciliation, Exceptions, Audit;
- clear locked states after approval/import;
- no `sync` wording;
- source label may say `QuickBooks Online file export`, but the feature name is `Accounting Import`.

### Import modes

1. **Full detail:** only when complete line-level exports and control reports are available.
2. **Cutover:** older closed history becomes locked ledger detail/legacy archive; current/open documents become native records.

Block any selection that imports historical transactions and opening balances for the same accounts and dates.

**Gate 17:** deliberate failure leaves no unexplained partial data; repeat import creates no duplicate; two-organization adversarial tests pass; all imported journals balance; source-to-destination lineage is complete; reversal and clean rerun work.

## Batch 18: QuickBooks coverage and staged migration rehearsal

### Source package inventory

The signed-in company inspection found substantial customers, suppliers, products/services, chart of accounts, employees, invoices, estimates, payment applications, audit events, time reports, and multiple bank registers. Do not encode private names or balances in test fixtures.

The complete dated source folder must contain, where available:

- QuickBooks Export Data ZIP for all dates;
- company/accounting settings;
- account list and hierarchy;
- customers and suppliers including inactive records;
- products/services, categories, bundles, income/expense accounts, rates/costs;
- full General Ledger and Transaction Detail by Account;
- Trial Balance, Balance Sheet, Profit and Loss, Cash Flow by retained year and cutover date;
- AR/AP aging and customer/vendor balance details;
- bank/credit-card registers, reconciliation reports, and available statements;
- invoices and lines, payments and applications, estimates, sales receipts, credits/refunds;
- bills and lines, bill payments/applications, expenses, checks, deposits, transfers, journals, purchase orders;
- classes, locations, projects/jobs, budgets;
- employee contacts, time activities, payroll reports if QuickBooks Payroll was used;
- recurring templates, attachments ZIP, and available audit evidence.

Keep originals unchanged, private, and outside Git. Calculate SHA-256 for every file and produce a manifest.

### Add missing adapters

Implement and test adapters for:

- journal entries;
- bill payments and applications;
- sales receipts;
- customer/supplier credits and refunds;
- transfers and checks;
- estimates and purchase orders;
- time activities;
- classes, locations, projects/jobs, and product categories;
- attachments and unsupported legacy documents;
- audit evidence.

Preserve source number, date, memo, currency, line detail, quantities, rates, account, customer/supplier, product/service, class, location, project/job, cleared status, and relationships when the source provides them.

Do not pretend that inventory quantity recreates inventory valuation. Archive unsupported inventory history until a proper inventory subledger exists.

### Dimension mapping

Keep these concepts separate:

- `Operational Site`: where cleaning/restoration work occurred.
- `Customer Job/Project`: customer-facing job or engagement.
- `Accounting Location`: financial reporting dimension.
- `Accounting Class/Cost Centre`: profitability/reporting dimension.
- `HR Department`: employee organization structure.

Provide explicit optional mappings. Never automatically treat them as the same record.

### Reconciliation requirements

At the cutover date prove:

```text
Trial Balance debits = Trial Balance credits
KTD Trial Balance by account = QBO Trial Balance by mapped account
Balance Sheet assets = liabilities + equity
P&L by retained year/period = source P&L
AR aging by open document = source AR aging
AP aging by open document = source AP aging
Bank/credit-card book balances = source book balances
Retained earnings = source retained earnings after mapped year closes
Payment applications = source open/paid document status
Native + archived + excluded + rejected + duplicate = inventoried source count
```

Differences must be zero or individually explained, evidenced, and approved. Unknown/unclassified records block acceptance.

### Staging rehearsal

1. Restore a clean staging backup.
2. Upload the immutable source package.
3. Inventory, map, validate, and approve.
4. Import using the selected mode.
5. Reconcile every control above.
6. Exercise source drill-down and attachment access.
7. Reverse the rehearsal and prove the pre-import state returns.
8. Reimport and prove identical accepted totals with no duplicates.
9. Produce a signed migration exception report.

**Gate 18:** staging statements agree with QuickBooks at cutover; every source record has a disposition; all differences are zero or owner-approved; clean reversal and rerun are proven.

## Batch 19: professional HR structure inspired by Celery

Add organization-scoped master data:

```text
Department
Position
WorkSchedule
Manager/ReportingLine
AccountingCostCentre
AccountingLocation
EmploymentContract
CareerHistory
EmployeeAsset
DocumentExpiryReminder
```

### HR rules

- Departments and positions are structured records, not repeated free text.
- Employment contracts are effective-dated and retain pay, schedule, position, department, manager, employment type, probation, and end terms.
- A new contract/change closes or supersedes the prior effective period; it never rewrites historical payroll context.
- Career history records promotions, transfers, pay changes, status changes, and reason/evidence.
- Work schedules define working days, expected hours, breaks, and holiday/leave calculation basis.
- Managers see only authorized direct/indirect reports according to role rules.
- Assets track issue date, serial/reference, condition, return due, returned date, and notes.
- Document reminders are generated from private employee/company document expiry dates.

### Migration of existing employee data

- Preserve all current `role` and `defaultSite` values.
- Create or map structured masters without dropping unmatched text.
- Produce a migration exception list for duplicate/ambiguous values.
- Historical payroll and time records retain their original labels/snapshots.

### HR UI

- Add compact master-data pages under People/Settings as appropriate.
- Employee edit remains tabbed and short; do not make one long scrolling form.
- Employment tab shows current contract summary and career timeline.
- Mobile view uses focused sections, not the entire desktop form stacked indefinitely.

**Gate 19:** historical terms are preserved; effective dates do not overlap incorrectly; manager authorization tests pass; department and cost-centre totals reconcile to company totals.

## Batch 20: leave, bulk operations, and payment delivery

### Leave Policy v2

Implement:

- policy assignment by employee/group;
- days or hours basis;
- effective date and opening balance;
- accrual frequency and rate;
- carryover and expiry;
- maximum balance/cap;
- BVI public-holiday calendar with version/source;
- sick, vacation, unpaid, special, compassionate, maternity/paternity or other configured categories;
- time-for-time/TOIL earning and use;
- work-schedule-aware requested units;
- request, review, approval, cancellation, adjustment, and immutable balance event ledger.

Balance must reproduce from opening + accrual + approved adjustments - approved use. Never store an unexplained editable total as the only source of truth.

### Bulk employee and payroll changes

- Downloadable template with stable field names and examples.
- Upload -> map -> validate -> preview -> approve -> commit.
- Row-level results and downloadable errors.
- Batch audit, idempotency, reversal, and organization isolation.
- Support onboarding and approved mutation types such as rate, department, position, schedule, deduction, bank detail, and status with effective dates.

### Bank payment export

- Implement only after the owner supplies the actual bank format/sample and authorization requirements.
- Generate from an approved/finalized pay run only.
- Validate account/name/reference fields.
- File total must equal approved net payroll exactly.
- Record hash, creator, approval, download, and regeneration history.
- Never invent a bank format.

### BVI statutory edge cases

Complete remaining relevant official outputs and boundary tests using versioned approved rules. Do not add Belize terms or an `income tax` deduction label for BVI payroll tax.

**Gate 20:** leave balances reproduce from events; bulk batches are traceable/reversible; bank file total equals net payroll; statutory outputs reproduce from locked payroll snapshots.

## Internal QuickBooks cutover: Gate C

Do not perform this on production until Batches 16-18 pass and the owner explicitly approves the source package and cutoff.

1. Freeze the agreed QuickBooks period.
2. Take the final complete exports and hashes.
3. Take and restore-test the latest KleenToDiTee database/document backup.
4. Run the approved import in the production organization.
5. Reconcile TB, BS, P&L, AR, AP, banks/cards, retained earnings, open documents, applications, and counts.
6. Run payroll in parallel and compare employee-level and statutory totals.
7. Owner and accounting reviewer sign migration and statutory acceptance.
8. Begin new activity in KleenToDiTee only after acceptance.
9. Keep QuickBooks read-only through at least one month-end and year-end evidence cycle.

## Subscriber release: Gate D

A clean subscriber organization must complete this without developer intervention:

1. Create organization and authorized users.
2. Configure company, statutory, payroll, accounting, bank, storage, and email settings.
3. Add/import employees and documents.
4. Enter multi-location time and approve it.
5. Preview, finalize, pay, remit, and deliver payroll/paystubs.
6. Generate NHI/SSB forms from the locked run.
7. Create finance documents and balanced postings.
8. Import/match/reconcile a bank statement.
9. Produce management financial statements and filing-support package.
10. Complete and restore a backup.
11. Optionally perform an accounting migration without bypassing validation/reconciliation.

Security, tenant isolation, storage, monitoring, dependency, email, mobile, backup, restore, and incident gates must pass. No placeholder or unsupported compliance claim may remain.

## Required automated test matrix

### Migration tests

- duplicate source ID in two organizations remains isolated;
- guessed batch/file/row/storage IDs return no cross-tenant data;
- one malformed row causes the expected all-or-checkpointed behavior with no unexplained posting;
- same batch committed twice produces no duplicates;
- same source file with a changed hash requires explicit replacement/new version;
- interrupted import resumes deterministically;
- reversal returns ledger/subledger controls to the pre-import state;
- invoice/bill lines preserve calculations and accounts;
- payments/bill payments preserve applications;
- opening balances balance and do not double count historical detail;
- imported postings obey locked periods;
- debits equal credits for every imported journal;
- formula, macro, external link, path traversal, MIME spoofing, oversized file, and malformed ZIP cases are rejected safely;
- large files process within bounded memory/time;
- fixture variants cover QBO headings/date/currency/blank row/summary row differences.

### HR/payroll tests

- effective-dated contract overlap prevention;
- historic payroll uses historic contract/rate snapshot;
- manager authorization and cross-tenant denial;
- multi-location segment overlap and total calculations;
- submit/reject/resubmit/approve time flow;
- approved time imports once into payroll;
- paystub preview equals finalized item;
- historical YTD affects statutory calculation without duplicate GL posting;
- work-permit conditional fields;
- archive/restore keeps history;
- leave event ledger reproduces balances;
- government forms reproduce from locked run.

### Delivery/e2e tests

- email queue idempotency, retry, dead-letter, cancel, and safe message content;
- signed storage URL authorization/expiry;
- photo replace/crop/touch/stylus/clear/save;
- desktop, tablet, and phone critical workflows;
- no horizontal overflow or inaccessible final actions;
- generated PDFs have no clipped or overlapping text.

## Required final verification command set

Use repository scripts and record exact results:

```powershell
npm run db:generate
npm run db:migrate:deploy
npm run typecheck
npm run lint
npm run test:api
npm run build
```

Also run focused unit/integration tests, Playwright end-to-end tests, migration status/drift checks, production-style startup, health checks, backup/restore, and browser/PDF visual verification. Do not claim a pass for a command you did not run.

## Commit discipline

Use clear coherent commits. A batch may use separate commits such as:

```text
db: add accounting import control and lineage models
api: make accounting imports atomic idempotent and org scoped
admin: add accounting migration validation and reconciliation workflow
test: prove importer isolation rollback idempotence and reversal
docs: record Batch 17 gate evidence and operating procedure
```

Before every commit:

- inspect the diff and exclude unrelated owner work;
- remove temporary/debug code and generated artifacts;
- verify no secrets or private exports are staged;
- run the relevant tests;
- record shared-file lock release/status in `TASKS.md`.

Push only after the batch gate passes. Never force-push over another agent's branch.

## Stop conditions requiring owner input

Stop only when the next action requires one of these:

- production credentials or secret values;
- irreversible modification of real owner data;
- actual QuickBooks export/cutoff approval;
- statutory classification or form interpretation that needs owner/accountant confirmation;
- actual bank file specification;
- unresolved conflict with another agent's active file ownership;
- a failed safety gate that cannot be fixed without changing an approved business decision.

Do not stop for ordinary implementation choices that can be resolved from existing patterns and tests.

## Required report after each batch

Return a concise implementation report containing:

1. What was completed, by user workflow.
2. Schema migrations and whether they were applied/replay-tested.
3. Security and tenant-isolation evidence.
4. Tests run with exact pass/fail counts.
5. Browser/device/PDF checks performed.
6. Backup/restore or reconciliation evidence where applicable.
7. Commit hashes and pushed branch.
8. Remaining owner-only actions and genuine blockers.
9. The next batch, only if the current gate passed.

## Definition of done

The assignment is complete only when:

- Batches 16-20 pass their gates;
- Gate C is executed only after owner approval and reconciles completely;
- Gate D is passed by a clean subscriber workflow;
- all production navigation leads to working functionality;
- no real records are silently lost, guessed, duplicated, or assigned to the wrong organization;
- payroll, government forms, ledger, bank reconciliation, financial statements, and migration are reproducible from locked evidence;
- desktop, tablet, and phone workflows are usable;
- private files and communications are secure and observable;
- the repository is clean except for clearly documented owner/other-agent work;
- all intended changes are reviewed, committed, pushed, and documented.

Begin by auditing the current Batch 16 working tree against `TASKS.md`. Continue that work safely, pass Gate 16, and only then start Batch 17.
