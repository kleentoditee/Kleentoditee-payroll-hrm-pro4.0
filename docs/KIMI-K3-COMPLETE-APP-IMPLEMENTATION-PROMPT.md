# Kimi K3 Prompt: Complete KleenToDiTee Payroll HRM

Copy everything below into Kimi K3. This is an implementation assignment, not a request for another high-level plan.

---

## Your assignment

You are the principal engineer responsible for completing and professionalizing **KleenToDiTee Payroll HRM**. You are expected to inspect the existing application, preserve working features, repair broken and incomplete features, implement the missing accounting and communications systems, test the entire product, and commit all reviewed work.

Work in this repository:

```text
C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0
```

Do not create another prototype or redesign the application from scratch. The AI is responsible for doing the implementation, not only writing a report for the owner. Continue autonomously unless you require a real provider credential, an irreversible legal/accounting decision, or access that only the owner can supply.

Read these existing audits before changing code:

```text
docs/CLAUDE-KIMI-PROFESSIONALIZATION-PROMPT.md
docs/DEEP-RESEARCH-2026-09-18.md
docs/current-system-inventory.md
docs/WEB_DEPLOYMENT.md
README.md
HANDOFF.md
```

## Product direction

KleenToDiTee is becoming a hosted payroll, HR, time, scheduling, finance, and accounting system for KleenToDiTee and future subscribing businesses. It must work professionally on Windows computers, laptops, tablets, and phones through the web.

The product may use QuickBooks, BambooHR, Gusto, and similar systems as workflow references. It must not synchronize with QuickBooks Online. Do not build QBO OAuth or a live QuickBooks dependency. The existing feature is **Accounting Import**, which imports supported files.

This is a **British Virgin Islands application, not Belize**. Do not add Belize laws, taxes, forms, terminology, or defaults.

## Non-negotiable behavior

1. Perform a deep review of the entire repository and running application before the first commit.
2. Preserve all working functionality and all legitimate existing changes.
3. Do not reset the dirty worktree, delete unrecognized work, or run destructive database resets.
4. Every visible tab, button, form, report, download, preview, and status must work end to end or be removed from production navigation.
5. Do not add placeholders, “Coming soon,” mock totals, fake controls, demo-only results, or developer/AI repair notes to production screens.
6. Complete vertical workflows: database, migration, API, permissions, audit, UI, errors, mobile layout, automated tests, and visual verification.
7. Use archive, void, reversal, and immutable history for accounting/payroll records. Do not hard-delete posted or finalized history.
8. Do not claim that software-generated financial statements are audited, reviewed, certified, or legally approved. Label them **management-prepared** or **unaudited** unless an authorized professional has actually supplied an assurance report.
9. Do not state that BVI filings are compliant until current official requirements have been verified and the owner has approved the filing configuration.
10. Commit all reviewed, intended source changes. Never commit secrets, `.env`, uploads, database dumps, deployment backups, build output, temporary files, or generated local test artifacts.

## Verified current foundation

The repository is an npm-workspaces TypeScript application:

- Next.js admin application on port 3000.
- Next.js employee tracker on port 3001.
- Hono API on port 8787.
- PostgreSQL and Prisma in `packages/db`.
- JWT/role-based authentication, user invitations, password reset, suspension, and audit logs.
- Employee create/edit/archive/restore, BVI work authorization, photos, documents, payroll details, and tracker access.
- Staff requests, schedules, announcements, employee tracker, rewards foundations, and role-based administration.
- Multi-location daily time entry, submission, approval, calculated hours, and payroll integration.
- Pay periods, pay runs, preview, finalization, exports, paid/void states, paystubs, historical/YTD import foundations, payroll reports, and BVI government-form foundations.
- Chart of accounts, customers, suppliers, products/services, invoices, bills, payments, bill payments, expenses, deposits, and basic summary reports.
- SMTP code currently sends password-reset and invitation messages only.
- WhatsApp currently opens a generic browser link and does not send through a WhatsApp provider.
- A notification schema exists, but general email/WhatsApp delivery is not implemented.
- Local employee document storage works; production S3/R2 storage is not implemented.

Do not assume this list means every workflow is correct. Prove each item by exercising it.

## Confirmed architectural gaps

### No real multi-company subscriber isolation

The current schema does not show organization, tenant, workspace, company, or subscription ownership on business records. Before offering the app to subscribers, implement true multi-tenancy.

Required design:

- `Organization` or `Tenant` entity with legal name, trading name, BVI identifiers, fiscal year, currency, timezone, accounting basis, status, and plan.
- Membership table connecting users to organizations and organization-scoped roles.
- Every employee, payroll, time, HR, finance, document, notification, audit, report, import, and settings record must belong to exactly one organization.
- Server-side tenant scoping on every query and mutation. Never rely only on hidden navigation.
- Unique constraints must be organization-aware where appropriate.
- Platform-owner support access must be explicit, time-limited where possible, visible, and audited.
- Object-storage keys, exports, cache keys, queues, and logs must preserve tenant boundaries.
- Cross-tenant isolation tests must prove that one subscriber cannot view, guess, download, update, export, or delete another subscriber's data.
- A safe migration must assign all existing KleenToDiTee records to the first organization without losing data.

Do not build subscription billing until the accounting and data-isolation foundation is stable unless a current product requirement explicitly demands it. Model plan/status limits cleanly so billing can be added later.

## Highest-priority requirement: professional accounting and financial statements

The owner must be able to maintain complete books and generate professional year-end financial statements from this application without paying another software company to produce them. Future subscribers must be able to generate their own statements from their own isolated records.

This does **not** remove the need for an accountant or auditor when law, financing, assurance, or professional judgment requires one. The application must produce complete management financial statements and filing-support packages, while clearly distinguishing management preparation from independent assurance.

### Build a real double-entry accounting core

The current finance module is document-based and does not contain a complete general ledger. Implement:

- decimal-safe money storage and calculations;
- organization-scoped chart of accounts with account code, type, subtype, normal balance, reporting category, parent account, active status, and opening date;
- fiscal years and accounting periods with open, soft-close, and locked states;
- journal entry and journal line models with source type/id, date, memo, currency, debit, credit, organization, creator, approver, posted/voided state, and audit metadata;
- database-enforced or transaction-enforced rule that every posted journal balances to zero within a strict decimal tolerance;
- immutable posted journals; corrections must use reversal and replacement entries;
- manual journals with approval controls and supporting attachments;
- opening balances and a controlled conversion/import process;
- recurring journals and year-end adjusting journals where useful;
- retained earnings/year-end closing workflow without destroying prior-period detail;
- audit trail from a financial-statement amount to account, journal, source transaction, and attached evidence.

### Create an idempotent posting engine

Every operational transaction must create correct journal entries exactly once. Repeated requests must not duplicate postings.

Cover at minimum:

- invoice issue, customer payment, unapplied payment, credit/refund, and invoice void;
- supplier bill, bill payment, supplier credit/refund, and bill void;
- direct expense, deposit, bank transfer, owner contribution/draw, asset purchase/disposal, loan proceeds/payment, and fees;
- payroll gross wages, employee deductions, employer NHI/SSB, payroll tax liabilities, net-pay liability/cash, payment, void, and reversal;
- bad debt/write-off where authorized;
- configurable control accounts for AR, AP, banks, payroll liabilities, retained earnings, income, cost of sales, and expenses.

Posting must occur in one database transaction with the business document. Use unique source keys to prevent duplicate journals.

### Banking and reconciliation

Implement:

- bank and cash accounts;
- statement import with duplicate detection;
- matching to payments, deposits, expenses, transfers, payroll, and journal entries;
- reconciliation sessions with opening balance, statement ending balance, cleared transactions, difference, completion lock, and later controlled undo;
- outstanding payment/deposit reports;
- bank-register running balance and drill-down;
- reconciliation audit history.

### Accounting reports

Produce accurate, filterable, drillable reports using posted journal lines as the source of truth:

- unadjusted and adjusted trial balance;
- general ledger and account detail;
- balance sheet / statement of financial position;
- profit and loss / income statement;
- cash flow statement using a documented method, with a reconciliation to cash movement;
- statement of changes in equity;
- AR aging and customer balances;
- AP aging and supplier balances;
- payroll liabilities and payment status;
- expenses, revenue, gross profit, and labor cost by customer/job/location;
- budget versus actual only after the core ledger is correct.

Reports need current period, prior period, year-to-date, comparison, cash/accrual basis where supportable, drill-down, print, PDF, CSV, and spreadsheet export. Every subtotal and total must reconcile to the trial balance.

### Professional year-end financial-statement package

Add an **Accounting > Financial statements** workspace where each subscriber can select an organization and fiscal year and prepare a controlled statement package.

The package must support:

- company legal/trading name, registration/TIN details, registered address, reporting period, currency, and accounting basis;
- cover page and table of contents;
- statement of financial position;
- statement of profit or loss/income statement;
- statement of cash flows;
- statement of changes in equity;
- notes and accounting policies that are editable, versioned, and organization-specific;
- comparative prior-year columns where prior data exists;
- rounding and display units without changing ledger precision;
- schedules for receivables, payables, fixed assets/depreciation, loans, payroll liabilities, tax balances, and related accounts;
- preparer/reviewer fields, management approval, signature/date, draft watermark, final lock, revision history, and finalization audit;
- management representation/approval section without pretending to be an auditor's report;
- professional paginated PDF, print view, spreadsheet export, and machine-readable data export;
- a snapshot of report mappings, journal balances, notes, and source-version metadata so a finalized package remains reproducible later.

The PDF must be visually tested for pagination, repeated headers, page numbers, readable totals, currency labels, negative-number format, signature placement, and no clipping.

### BVI filing-support outputs

Implement separate outputs and do not confuse them:

1. **Inland Revenue package**: configurable year-end financial statements and any applicable Inland Revenue return/supporting schedules. The official Return of Notional Remuneration and Financial Statement says it is submitted with the financial statement within 90 days of the financial year-end. Verify the current rule directly with Inland Revenue before enabling a “Ready to file” status.
2. **BVI Business Companies annual financial return**: the official 2023 Schedule includes cash/cash equivalents, loans/receivables, investments/financial assets, tangible and intangible assets, other assets, total assets, accounts payable, long-term debt, other liabilities, total liabilities, shareholder equity, revenue, cost of sales, gross profit, operating expenses, other expenses, income-tax expense, total expenses, and net income.
3. **Registered-agent filing support**: the annual financial return is generally filed with the registered agent, while official exemptions include certain companies that file annual tax returns and financial statements with Inland Revenue. The app must ask which obligation applies and must not generate duplicate filing instructions as fact.

Official references to verify and store with a verification date:

- BVI Business Companies (Financial Return) Order, 2023:
  https://www.bvifsc.vg/sites/default/files/bvi_business_companies_financial_return_order_2023.pdf
- BVI FSC annual-return information:
  https://www.bvifsc.vg/news/industry-updates/industry-circular-26-2025-filing-initial-annual-returns
- BVI Inland Revenue Department:
  https://gov.vg/inland-revenue-department
- Return of Notional Remuneration and Financial Statement:
  locate the current form on the official `bvi.gov.vg` or `gov.vg` site and verify it has not been replaced before implementing.

Do not hardcode filing deadlines as permanent truths. Store rule versions, source links, verified dates, effective dates, subscriber applicability, reminders, and an owner confirmation. Use “filing support” rather than claiming the app electronically files a return unless an official supported submission integration is actually implemented.

## Fix WhatsApp communication correctly

The existing employee-sharing button uses:

```text
https://api.whatsapp.com/send?text=...
```

It does not include a recipient number and commonly leads through a web/contact-selection flow. Replace the misleading behavior with two clearly different modes.

### Mode A: open a direct employee chat

- Normalize BVI and international phone numbers to E.164 digits.
- When an employee has a valid WhatsApp-capable number, use the official click-to-chat pattern:

```text
https://wa.me/<international-number>?text=<encoded-message>
```

- On mobile, this universal link should hand off to WhatsApp when installed. On desktop, WhatsApp may legitimately offer its desktop/web experience; do not promise browser JavaScript can force an installed app.
- If using `whatsapp://` as a progressive enhancement, provide a timed `wa.me` fallback and test Android, iPhone, Windows desktop app, and browser behavior. Do not leave the user on a blank failed deep link.
- Disable the action with a useful message when the number is missing/invalid.
- Use the official WhatsApp button/brand guidance.
- Never include passwords, reset tokens, government IDs, full pay details, document URLs, or other sensitive information in the message.

Official click-to-chat reference:

https://faq.whatsapp.com/5913398998672934

### Mode B: send automatically from the platform

If the owner wants true server-side WhatsApp delivery, implement the official WhatsApp Business Platform/Cloud API or a reviewed provider. This requires owner-supplied business-account credentials and cannot be faked with a browser link.

Required provider design:

- organization-scoped provider configuration and secrets stored outside the database where possible;
- recipient consent/opt-in and opt-out records;
- approved message templates for business-initiated messages;
- webhook signature verification;
- queued sending, idempotency, delivery/read/failure statuses, retry with backoff, and dead-letter handling;
- cost/rate-limit visibility;
- notification log linked to organization, employee/customer, event, template version, provider message ID, and status;
- no silent fallback from failed provider sending to exposing private content in a click-to-chat URL.

Test with provider sandbox/test numbers before production. If credentials are unavailable, complete and test the adapter, settings validation, mock provider, queue, webhook handling, and UI, then list only the credential-dependent activation step as blocked.

## Fix email as a complete service

Current SMTP delivery only covers invitations and password resets. Implement a reusable production email service for authorized events such as invitations, password resets, paystub availability, approved/denied requests, schedule changes, announcements, invoices, receipts, statements, and year-end package notifications.

Required work:

- organization-specific sender name/reply-to with verified-domain controls;
- encrypted provider credentials or environment/secret-manager references;
- provider settings page with connection validation and a safe “Send test email” action;
- templated text and HTML messages with branded but email-client-safe layout;
- queued delivery, idempotency, retries, exponential backoff, failure reason, and dead-letter state;
- delivery log and admin retry/cancel controls;
- webhook support for delivered, bounced, complained, and rejected events when the provider supports it;
- suppression list and unsubscribe/preferences for non-transactional notifications;
- never email passwords, government IDs, raw private files, or permanent public paystub/document links;
- paystubs/documents should use a short-lived authenticated link or tell the employee to sign in;
- SPF, DKIM, and DMARC deployment checklist;
- local test transport and production SMTP/provider tests;
- monitoring so an invitation is not shown as successfully sent when delivery failed.

Use generic transport/provider interfaces so subscribers can use approved SMTP or a later transactional provider without rewriting every feature.

## Deep review required before committing

Before the first commit, complete these steps:

1. Record `git status`, current branch, changed/untracked files, and recent commits.
2. Attribute existing changes by feature as far as the diff allows. Do not assume all dirty files are yours.
3. Inspect the Prisma schema, every migration, all API route registrations, admin/tracker route trees, navigation definitions, settings, environment validation, storage, email, notifications, reports, tests, and deployment configuration.
4. Start PostgreSQL and all three applications without reseeding the owner's data.
5. Sign in as each meaningful role and inspect every page, tab, menu item, form, empty state, error state, preview, download, and destructive action.
6. Test desktop, tablet, and phone widths. Capture screenshots for failures and repaired workflows.
7. Run baseline typecheck, lint, unit tests, builds, smoke tests, migration status, and dependency audit.
8. Search for placeholder, coming soon, TODO, FIXME, demo/test wording, duplicate destinations, missing APIs, and dead routes.
9. Produce a completion matrix:

```text
Area | Route/control | API | Model | Permission | Desktop | Tablet | Phone | Tests | Status | Required repair
```

10. Rank defects by data loss/security, payroll/accounting correctness, blocked workflow, mobile usability, and polish.

Do not stop after presenting the matrix. Begin repairing the highest-risk vertical workflow immediately.

## Implementation order

Use dependency order unless the current audit reveals a more urgent data-loss issue:

1. Protect and migrate existing data; repair startup, migrations, and failing tests.
2. Multi-tenant organization model and strict subscriber isolation.
3. Authentication/session hardening, permissions, private object storage, backups, and restore proof.
4. Double-entry ledger, posting engine, fiscal periods, and opening balances.
5. Bank reconciliation and complete accounting reports.
6. Year-end financial-statement builder and BVI filing-support outputs.
7. Payroll/accounting posting and reconciliation.
8. Email queue/provider and WhatsApp direct/provider modes.
9. Complete remaining HR, time, leave, scheduling, reporting, and employee mobile workflows.
10. Deployment, monitoring, security review, staging acceptance, and owner parallel-run sign-off.

## Commit requirements

The repository currently contains a large dirty worktree. Handle it carefully.

- Never use `git reset --hard`, destructive checkout, or blanket cleanup.
- Inspect every diff before staging.
- Update `.gitignore` for local artifacts before staging files.
- Never stage `.env`, credentials, tokens, uploads, backups, database files, `.next`, `dist`, coverage, logs, `tmp`, or one-off rendered test files.
- Include all intended source files, tests, migrations, official form assets that are legally distributable, configuration templates, and current documentation.
- Make coherent commits by completed feature or migration. Do not make one unexplained “fix everything” commit.
- Suggested commit sequence:

```text
chore(audit): capture verified application baseline
feat(tenancy): isolate organization data and migrate existing records
feat(accounting): add balanced journal and posting engine
feat(accounting): add reconciliation and financial statements
feat(compliance): add BVI year-end filing support
feat(notifications): add reliable email and WhatsApp delivery
fix(ui): complete responsive workflows and remove placeholders
test(release): add cross-tenant, accounting, communication, and e2e coverage
docs(release): document deployment, backups, filings, and owner acceptance
```

- Before each commit, review the staged diff and run the tests relevant to that commit.
- Before the final commit, run the complete release suite and review the full diff from the last known committed baseline.
- End with a clean worktree. If a file cannot safely be committed, explain exactly why and ensure it is ignored or deliberately retained outside Git.
- Report every commit hash and subject.

## Release gates

Do not call the product complete until all of these pass:

- no cross-tenant data access in automated adversarial tests;
- trial balance debits equal credits for every organization and period;
- balance sheet balances: assets = liabilities + equity;
- net income agrees between the income statement, equity movement, and closing entries;
- cash-flow ending cash agrees with the balance sheet and bank registers;
- subledgers reconcile to AR, AP, payroll liabilities, and bank control accounts;
- payroll reports, paystubs, government forms, and payroll journal postings reconcile;
- year-end PDF and spreadsheet exports agree to the locked report snapshot;
- BVI annual-return mapping agrees to the official form categories;
- email success/failure/retry/webhook behavior is proven;
- direct WhatsApp links include the intended employee number and encoded message, and provider sending is proven in a sandbox if enabled;
- role permissions and sensitive downloads are tested server-side;
- backup and restore are tested in a separate environment;
- all visible workflows pass desktop, tablet, and phone checks;
- typecheck, lint, tests, build, migration verification, dependency audit, and end-to-end smoke tests pass;
- no placeholders, duplicated fake tabs, development wording, or uncommitted intended work remains.

## How to report progress

At the start, report:

1. verified baseline and data-safety status;
2. route/control completion matrix;
3. accounting and subscriber-isolation architecture;
4. risk-ranked implementation batches;
5. first batch being implemented.

After that, keep reports concise:

- completed behavior;
- migrations and files changed;
- tests and visual checks passed;
- commit hash;
- remaining blockers;
- next implementation batch.

Do not repeatedly ask the owner what to do next when the requirements above answer the question. Make sound engineering decisions, implement them, test them, and commit them. Ask only when legal applicability, provider credentials, irreversible data conversion, or a genuine business-policy choice cannot be safely inferred.

Begin now with the deep repository/runtime review. Protect the existing data, produce the completion matrix, and then implement the first release-blocking vertical workflow.

