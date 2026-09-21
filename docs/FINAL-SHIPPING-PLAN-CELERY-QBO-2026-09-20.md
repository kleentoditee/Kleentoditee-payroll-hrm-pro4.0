# Final Shipping Plan: Celery and QuickBooks Findings

**Date:** 2026-09-20  
**Status:** ACTIVE ADDENDUM to `docs/SHIPPING-PLAN.md`. Batch 16 remains in progress. This plan adds the required QuickBooks migration gate and combines it with the accepted Celery HR recommendations.

## Product decision

KleenToDiTee will remain its own BVI payroll, HR, accounting, and cleaning-operations platform.

- QuickBooks Online is a source for a controlled **file migration**, not an OAuth connection or live synchronization.
- Celery is a payroll and HR workflow benchmark, not a dependency or interface to copy.
- KleenToDiTee remains the system of record after the migration cutover.
- QuickBooks must remain available in read-only/reference use until migration reconciliation and owner acceptance are complete.
- No migration is allowed directly into the production organization before a staging rehearsal passes.

## Research basis and limitation

This plan is based on:

- Intuit's official QuickBooks Online export and reporting instructions;
- a read-only inspection of the signed-in KleenToDiTee QuickBooks Online company;
- a source-level audit of KleenToDiTee's current accounting importer and finance schema;
- the signed-in Celery trial inspection documented in `docs/CELERY-COMPARISON-2026-09-20.md`;
- the current Batches 10-16 shipping plan and completed finance/accounting gates.

No QuickBooks data was created, edited, exported, or downloaded during the review, and no credentials were entered or handled by the reviewer. The live inspection establishes visible record counts and workflows, but the export package must still inventory hidden/inactive records, the complete date range, enabled subscription features, and every source type before migration approval.

Official Intuit guidance says QuickBooks Online can export reports and lists to Excel in a ZIP, while estimates, purchase orders, statements, attachments, recurring templates, the account list, and products/services may require separate exports. It also supports report exports to Excel/CSV/PDF and a General Ledger report with debit, credit, and cleared status.

Sources:

- [Export QuickBooks Online data](https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/export-reports-lists-data-quickbooks-online/L1xleDrLp_US_en_US)
- [Export reports to Excel or CSV](https://quickbooks.intuit.com/learn-support/en-us/help-article/report-management/export-reports-excel-quickbooks-online/L7iAoP97n_US_en_US)
- [Run a General Ledger report with debits and credits](https://quickbooks.intuit.com/learn-support/en-us/help-article/profit-loss-reports/create-report-shows-debits-credits-transaction/L1zvqNX0e_US_en_US)
- [Export customer data](https://quickbooks.intuit.com/learn-support/en-us/help-article/import-export-data-files/export-customer-data-excel/L0ZerVWiO_US_en_US)
- [Export employee data](https://quickbooks.intuit.com/learn-support/en-us/help-article/migrate-services/import-export-employee-data/L8cdennop_US_en_US)
- [QuickBooks class tracking](https://quickbooks.intuit.com/learn-support/en-us/help-article/class-list/create-manage-classes-quickbooks-online/L1QzEOUxM_US_en_US)

## Signed-in QuickBooks company findings

The private values and record names are intentionally omitted. The live company contains:

- **185 customers**, including open customer balances;
- **72 suppliers**, with no current open AP balance visible on the supplier summary;
- **147 products and services**, including service, non-inventory, and bundle records, categories, sales descriptions, sales prices, purchase costs, income accounts, and expense accounts;
- **at least 75 chart-of-account rows**, including bank/cash, receivables, current/fixed assets, loans, accrued liabilities, payroll accounts, equity, revenue, cost of sales, and operating expenses;
- **six active employee contacts**, some with incomplete contact details;
- **38 invoices in the current three-month view**, including overdue, not-yet-due, deposited, and voided records;
- historical invoice and estimate numbering that demonstrates a much larger transaction history than the current view;
- current audit activity for estimates, invoices, emailed documents, voids, customer changes, and customer-payment applications;
- QuickBooks time-entry and time-activity reports, although the inspected current week had no time entries;
- multiple bank/register accounts with material differences between bank-feed balances and QuickBooks book balances.

These findings make a list-only migration unacceptable. At minimum, estimates, invoice lines, payment applications, product categories/accounts, historical ledger detail, audit evidence, and bank reconciliation controls must be preserved or explicitly archived.

## Current KleenToDiTee position

### Already implemented and valuable

KleenToDiTee already has:

- organization-scoped customers, suppliers, products/services, accounts, invoices, bills, expenses, customer payments, bill payments, deposits, and journals;
- fiscal periods, period locks, posting and reversal controls;
- bank-statement import, matching, reconciliation, and bank registers;
- P&L, balance sheet, cash flow, changes in equity, AR/AP aging, payroll liabilities, locked snapshots, and year-end close;
- accounting import screens for CSV/XLSX preview, column mapping, validation, and commit;
- parser support for customers, vendors, accounts, products, invoices, bills, expenses, payments, and deposits;
- payroll, employee, document, time, and BVI statutory functionality that QuickBooks Online does not replace.

### Current importer is not approved for real company migration

The present importer must not be used to migrate the owner's full books yet. The audit found these release-blocking defects:

1. Duplicate lookups and find-or-create helpers do not consistently include `orgId`, which can cause cross-organization collisions in a subscriber environment.
2. Rows commit one at a time without one database transaction, so a failure can leave a partially imported file.
3. There is no persistent import-batch record, file checksum, source identity, row result, retry state, approval, reversal, or restore point.
4. Invoice and bill imports collapse source detail into one summary line and can lose products, accounts, quantities, rates, tax, classes, locations, and memos.
5. Customer and supplier opening balances are written into notes instead of balanced opening journals and AR/AP documents.
6. Imported invoice paid amounts are not tied to payment applications; imported customer payments remain unapplied.
7. Imported transactions are not proven to post balanced journal entries through the same posting engine as native transactions.
8. Missing mappings may silently create fallback customers, suppliers, or accounts, hiding migration mistakes.
9. There is no control-total gate against QuickBooks Trial Balance, Balance Sheet, P&L, AR aging, AP aging, bank balances, or retained earnings.
10. The 5 MB, 5,000-row, single-file flow cannot receive a complete QuickBooks export ZIP or large historical ledger safely.
11. Unsupported data includes journal entries, bill-payment applications, transfers, checks, sales receipts, credit memos, refunds, estimates, purchase orders, recurring templates, classes, locations, projects, budgets, inventory history, reconciliation history, and attachment relationships.
12. The audit log records only a summary when rows are created. It does not provide source-file and row-level lineage.

## Meaning of "all QuickBooks data"

No spreadsheet import can guarantee every QuickBooks feature maps one-to-one. For this project, "all data" means every source record is accounted for in one of three destinations:

1. **Native record** - data KleenToDiTee can operate on, such as customers, open invoices, payments, bills, accounts, products, bank activity, and journals.
2. **Locked historical accounting record** - prior-period transaction detail retained in the ledger with source date, type, number, name, memo, class/location, and debit/credit values, but not falsely presented as a fully editable native invoice or bill.
3. **Searchable legacy archive** - source attachments and unsupported/non-posting records retained with metadata and links to imported entities where possible.

Every QuickBooks record must appear in the migration inventory as imported, archived, intentionally excluded, duplicate, or rejected. Nothing may disappear silently.

## Required QuickBooks export package

Create one dated, read-only migration folder. Keep the original files unchanged and calculate a SHA-256 hash for each file.

### Core export

- QuickBooks **Export data** ZIP with all available reports and lists enabled and the full available date range.
- Company information and accounting settings: legal name, addresses, tax identifiers, home currency, fiscal year, accounting method, invoice terms, and numbering preferences.
- Account List with account number, name, type, detail type, description, active status, parent account, and balance.
- Customer Contact List and Vendor Contact List, including inactive records where possible.
- Product/Service List with type, SKU, descriptions, income account, expense account, rates/cost, taxable status, active status, and inventory fields if used.

### Transaction and control reports

- General Ledger for the complete history, with debit, credit, cleared status, transaction type, number, account, name, date, memo, class, and location where available.
- Transaction Detail by Account for the complete history.
- Trial Balance at each fiscal year end and at the migration cutover date.
- Balance Sheet, Profit and Loss, and Statement of Cash Flows for each retained fiscal year and the cutover date.
- AR Aging Detail and AP Aging Detail at cutover.
- Customer Balance Detail and Vendor Balance Detail.
- Bank and credit-card register reports, reconciliation reports, and original bank statements where available.

### Operational transaction exports

- Invoices and invoice lines.
- Customer payments and invoice applications.
- Sales receipts, credit memos, refunds, and estimates.
- Bills and bill lines.
- Bill payments and bill applications.
- Expenses, checks, deposits, transfers, and journal entries.
- Purchase orders.
- Recurring Template List.

### Dimensions and related records

- Classes and subclasses.
- Locations.
- Projects/jobs and customer subrecords.
- Budgets.
- Employees/contact report.
- Payroll reports and tax/liability reports only if QuickBooks Payroll was used; employee contact export alone does not include payroll history.
- Attachments ZIP.
- Audit-log export or retained screenshots/reports for the migration period where export is available.
- Time Activities by Employee Detail and Recent/Edited Time Activities for the complete available history.

## Migration architecture to build

### Persistent migration control

Add organization-scoped models equivalent to:

- `AccountingImportBatch`: source system, migration mode, cutoff date, status, totals, creator, reviewer, approval, commit/reversal timestamps.
- `AccountingImportFile`: original name, type, size, SHA-256, storage key, parser version, date range.
- `AccountingImportRow`: file, source row, source type/id/reference, normalized payload, validation result, action, destination entity, error/warning.
- `ExternalSourceRef`: organization, source system, source company id, source entity type/id, destination entity type/id, immutable uniqueness.
- `MigrationReconciliation`: QuickBooks control totals, KleenToDiTee totals, difference, reviewer, acceptance evidence.
- `LegacyDocument`: unsupported source document or attachment with searchable metadata and optional destination links.

Store files in the private storage provider being completed in Batch 16. Never store migration workbooks in a public web directory or commit them to Git.

### Import lifecycle

Use one explicit state machine:

`uploaded -> inventoried -> mapped -> validated -> approved -> importing -> reconciled -> accepted`

Failure states:

`rejected`, `failed`, and `reversed`.

Requirements:

- preview and validation never mutate accounting data;
- commit is atomic per approved batch or deterministic chunk with resumable checkpoints;
- source references make re-import idempotent;
- correcting an accepted posting uses reversal and a new batch, not destructive edits;
- all organization lookups include `orgId`;
- file type is detected from content, not only filename;
- formulas/macros/external links are rejected or flattened safely;
- large files are streamed or processed in bounded chunks;
- every row has a visible final disposition and downloadable error report.

### Migration modes

Support two safe modes:

1. **Full-detail mode** - available only when complete line-level exports are present and all control reports reconcile.
2. **Cutover mode** - recommended for older closed years: import prior history as locked ledger detail and legacy documents, then import the current/open period as native invoices, bills, payments, expenses, and bank activity.

Do not import both historical transactions and an opening balance for the same accounts and dates. The wizard must detect and block that double-counting choice.

### Mapping rules

- QuickBooks classes map to an accounting reporting dimension or cost centre, not automatically to HR departments.
- QuickBooks locations map to accounting locations. Customer work sites remain operational sites unless the owner explicitly links them.
- QuickBooks projects/jobs map to customer jobs and may link to operational sites.
- Celery-inspired departments and positions remain HR organization records.
- Product/service accounts must already exist or be explicitly mapped; the importer must not silently create generic accounts.
- Parent accounts, customers/subcustomers, inactive status, transaction number, source dates, and source currency must be preserved.
- Product category, service/non-inventory/bundle type, purchase cost, sales price, income account, and expense account must be preserved.
- Employee/time-activity imports must map to an existing employee and customer job/site; unmatched records remain rejected or archived, never assigned by name guessing.
- Unsupported inventory valuation must remain archived until an inventory subledger exists; do not pretend quantity-on-hand alone recreates inventory accounting.

## Combined capability priorities

| Priority | QuickBooks finding | Celery finding | KleenToDiTee action |
|---|---|---|---|
| P0 | Migration must be atomic, traceable, and reconciled | Production documents and communication must be reliable | Finish Batch 16 storage/email/backup/e2e and add migration control before real imports |
| P0 | Trial Balance, AR/AP, cash, and retained earnings must agree | Payroll/statutory outputs need owner sign-off | Require accounting and payroll cutover acceptance before sole-source use |
| P1 | Classes, locations, and projects drive profitability | Departments and cost centres drive HR/payroll reporting | Add separate structured dimensions with explicit mappings |
| P1 | Historical transaction relationships must survive | Career history and contracts must be effective-dated | Preserve immutable accounting and employment history |
| P1 | Attachments need export/archive/linking | Employee/company documents need sharing and reminders | Use private storage plus searchable document metadata |
| P1 | Bank/payment applications and reconciliation are essential | Bank payroll files reduce manual payment work | Import applications/reconciliations and add validated bank-payment export |
| P2 | Recurring templates and budgets improve operations | Leave policies, public holidays, schedules, and imports improve HR | Build after cutover-critical records are stable |
| P3 | Large integration ecosystem is optional | Native mobile/recruiting/performance are optional | Keep deferred from v1 |

## Final delivery sequence

### Batch 16 - Production delivery and communication (currently active)

Complete the existing scope:

- private S3/R2-compatible storage;
- queued email with retries, logs, and provider validation;
- WhatsApp direct links with correct app/web fallback;
- monitoring, scheduled backup, restore proof, incident procedure;
- desktop, tablet, and phone end-to-end workflows.

**Gate 16:** all existing tests/builds pass; staging backup/restore succeeds; storage is private; invitation/reset/paystub email is observable; critical phone workflows pass.

### Batch 17 - Accounting migration safety

- Fix all organization-scoping defects in the current importer and add adversarial two-organization tests.
- Add import batch/file/row/source-reference/reconciliation models and additive migration.
- Make commit atomic/idempotent/restartable with reversal support.
- Route imported native transactions through the normal posting engine.
- Replace note-only opening balances with controlled opening journals and AR/AP opening documents.
- Preserve transaction lines and payment/bill-payment applications.
- Add ZIP inventory, file hashes, secure storage, downloadable validation errors, and mapping templates.

**Gate 17:** a deliberately failing import leaves zero partial data; repeat import creates zero duplicates; cross-tenant source IDs cannot collide or leak; imported journals balance; source-to-destination lineage is complete.

### Batch 18 - QuickBooks coverage and rehearsal

- Add source adapters for journal entries, bill payments, sales receipts, credits/refunds, transfers/checks, estimates, purchase orders, time activities, classes, locations, projects/jobs, product categories, attachments, audit evidence, and legacy archive records.
- Add cutover/full-detail choice and double-count prevention.
- Inventory the signed-in QuickBooks company and record every available/used data type.
- Export a complete rehearsal package and import it into staging.
- Reconcile Trial Balance, Balance Sheet, P&L, AR, AP, bank/credit-card balances, retained earnings, and transaction counts.
- Generate a signed migration exception report for unsupported or intentionally archived data.

**Gate 18:** all control differences are zero or individually explained and owner-approved; no unknown/unclassified source records remain; staging financial statements agree to QuickBooks at the cutover date.

### Batch 19 - HR structure inspired by Celery

- Department, position, work schedule, manager, accounting cost centre, and location masters.
- Effective-dated employment contracts and career history.
- Clear separation and optional mapping among HR department, accounting class/cost centre, customer job, and operational site.
- Contract/document expiry reminders and employee asset register.
- Migration of existing role/default-site strings without losing values.

**Gate 19:** historical employee terms are preserved; managers see only authorized staff; department/cost-centre reports reconcile to company totals.

### Batch 20 - Leave, bulk operations, and payment delivery

- Leave Policy v2: policy assignment, hours/days basis, accrual, carryover, caps, BVI public holidays, special leave, time-for-time, and work-schedule-aware calculations.
- Bulk employee onboarding and reusable payroll-mutation imports with batch reversal.
- BVI bank-payment export after actual bank format samples are validated.
- Remaining relevant BVI payroll outputs and edge-case tests.

**Gate 20:** leave balances reproduce from source events; payroll-import rows are traceable and reversible; bank file total equals approved net payroll exactly; statutory outputs reproduce from locked payroll snapshots.

### Gate C - Internal cutover from QuickBooks

Do not cancel QuickBooks at this gate.

- Freeze the agreed QuickBooks cutover period.
- Take final exports and hashes.
- Restore the latest KleenToDiTee backup in a clean environment.
- Run the approved import.
- Reconcile all accounting controls and open documents.
- Run payroll in parallel and compare employee-level/statutory totals.
- Owner and accounting reviewer sign the migration and statutory acceptance records.

Use KleenToDiTee for new activity only after Gate C passes. Keep QuickBooks read-only for at least one completed month-end and year-end evidence cycle, or longer if the accountant advises.

### Gate D - Subscriber release

- A clean subscriber organization completes setup, employee onboarding, time, payroll, bank reconciliation, statements, and backup/restore without developer intervention.
- Migration is optional per subscriber and cannot bypass validation/reconciliation.
- Security, tenant isolation, dependency, storage, monitoring, email, mobile, and incident checks pass.
- No placeholders, dead controls, developer notes, or unsupported compliance claims remain.

## QuickBooks migration acceptance checklist

- [ ] Source company identity and QuickBooks subscription/features recorded.
- [ ] Full export inventory and SHA-256 manifest complete.
- [ ] Cutoff date and migration mode approved.
- [ ] Every file and row has a final disposition.
- [ ] Chart of Accounts hierarchy/types approved.
- [ ] Customers, suppliers, products, classes, locations, jobs, and inactive records counted.
- [ ] Invoice/bill line totals and open balances agree.
- [ ] Customer and supplier payment applications agree.
- [ ] Trial Balance debits equal credits and match QuickBooks.
- [ ] Balance Sheet and retained earnings match.
- [ ] P&L by fiscal year and cutover period matches.
- [ ] AR/AP aging matches by document.
- [ ] Bank and credit-card balances/reconciliations match.
- [ ] Attachments and unsupported records are archived and searchable.
- [ ] Import reversal and clean re-run proven in staging.
- [ ] Backup/restore proven before production cutover.
- [ ] Owner and accounting reviewer approvals recorded.

## Explicitly out of scope

- QuickBooks OAuth, API synchronization, bank-feed credential sharing, or background sync.
- Copying QuickBooks or Celery branding, layouts, or proprietary code.
- Automatic tax/legal conclusions from imported data.
- Claiming imported financial statements are audited or officially filed.
- Native mobile apps, recruiting, performance management, benefits marketplaces, or broad third-party integration ecosystems before subscriber release.
