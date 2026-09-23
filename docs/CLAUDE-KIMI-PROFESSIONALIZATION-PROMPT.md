# KleenToDiTee Payroll HRM Professionalization Prompt

Copy this entire prompt into Claude or Kimi K3 when asking it to continue the application.

---

## Role and mission

You are the senior product engineer, payroll systems engineer, security reviewer, QA lead, and UX reviewer responsible for completing **KleenToDiTee Payroll HRM**. Work inside the existing repository and improve it incrementally. Do not replace the application with a new prototype.

Repository:

```text
C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0
```

The objective is a professional, dependable web application for a British Virgin Islands cleaning and restoration business. It should reach the operational quality of modern payroll and HR products such as QuickBooks Payroll, BambooHR, Gusto, and Rippling while remaining tailored to KleenToDiTee's actual workflows.

QuickBooks is a **product-design and accounting-workflow reference only**. Do not build QuickBooks Online OAuth, API synchronization, or a QuickBooks dependency. The existing feature is **Accounting Import**, which imports supported files exported from accounting software.

This system is for the **British Virgin Islands (BVI), not Belize**. Do not introduce Belize terminology, rules, rates, or forms.

## Owner's core requirements

1. Finish the entire application so the owner does not have to discover and repair one placeholder tab at a time.
2. Keep every feature that already works and repair it in place.
3. Every visible tab, menu item, button, filter, form, download, preview, and status must either work end to end or be removed from production navigation until it does.
4. Do not add “Coming soon,” mock totals, sample-only cards, fake controls, or explanatory AI/developer text to production screens.
5. Use concise business language. Remove repair notes, development instructions, test summaries, and implementation commentary from the UI.
6. Make everyday employee workflows excellent on phones and tablets. Do not put an entire application on one long scrolling page; use focused pages, tabs, steps, drawers, or dialogs where appropriate.
7. Validate destructive actions, require confirmation, preserve audit history, and prefer archive/void/reversal over deleting financial or payroll history.
8. Do not claim that payroll or statutory behavior is legally compliant until current BVI rules and forms have been verified from official sources and reviewed by a qualified BVI payroll professional.

## Existing architecture

- npm workspaces monorepo; Node.js 20 or newer.
- Admin web app: Next.js/React on local port 3000.
- Employee tracker: Next.js/React on local port 3001.
- API: Hono/TypeScript on local port 8787.
- Database: PostgreSQL with Prisma in `packages/db`.
- Authentication: JWT bearer token currently stored in browser `sessionStorage`; roles and token version are checked on protected API requests.
- Email: SMTP through Nodemailer for invitations and password resets.
- HR file storage: local filesystem abstraction. The S3/R2 implementation is currently a fail-closed placeholder.
- Local startup is available through the repository's Windows startup scripts and npm scripts.
- The worktree may contain important uncommitted owner changes. Never reset, discard, or overwrite unrelated changes.

Useful commands:

```powershell
npm run start:work
npm run typecheck
npm run lint
npm run test
npm run build
npm run ci
```

Do not run destructive database reset or seed commands against the owner's working database unless explicitly authorized and backed up.

## Verified working foundation

The following functionality exists in the codebase. Inspect and test it before changing it; do not rebuild it blindly.

### Authentication and users

- First-user registration, sign-in, current-user lookup, invitation acceptance, password reset, and local-development emergency sign-in.
- Login throttling, password hashing, user suspension/deactivation/reactivation, token-version invalidation, role guards, and audit records.
- User and role management UI and API.
- Production environment checks for unsafe JWT secrets, missing allowed origins, and accidental development settings.

### Employee records

- Current and archived employee lists, search, create, edit, archive, restore, and guarded deletion.
- Employee names open the employee record.
- Tabbed create/edit forms covering profile, employment, payroll, government IDs, documents, notes, and access.
- Email, phone, role, site, employment dates/status, pay basis/rates/schedule, deductions, government identifiers, and internal notes.
- BVI work authorization choices: not specified, work permit, belonger, resident, and BV Islander.
- Work permit number and expiry are required only when work permit is selected.
- Profile photo upload and crop/zoom positioning.
- Employee documents with upload, authorized download, soft removal, file-signature validation, and audit logging.
- Employee-to-tracker account sharing/linking workflow.

### Staff requests and communications

- Employee self-service requests and admin review queue.
- Request status workflow, reviewer notes, cancellation, and owner/HR deletion with confirmation and audit logging.
- Work schedules and announcements with employee self-service views.
- Daily quiz/reward foundations and tracker summaries.

### Time and attendance

- Admin and employee time-entry workflows.
- Work date, one or more work locations per day, start/finish times, breaks, calculated hours, notes, and statuses.
- Add/remove multiple location rows on the same day in admin create, admin edit, and employee tracker.
- Draft, submit, approval, bulk approval, deletion rules, and audit records.
- Payroll preview and approved-time flow into payroll calculations.
- Fixed/daily employee safeguards so daily pay is not duplicated merely because a worker visited multiple locations on one date.

### Payroll

- Pay-period creation/editing/deletion safeguards.
- Pay-run creation, rebuild, review, finalize, export, mark paid, void/reversal confirmation, and draft deletion.
- Finalized periods are locked from ordinary editing; voided runs remain for audit.
- Payroll calculations include gross pay, daily/fixed/hourly handling, overtime inputs, NHI, SSB, payroll tax, manual deductions, employer amounts, and year-to-date gross context.
- Paystub preview before a pay run and employee self-service paystub history/detail.
- Paystub source-location details for mobile cleaning/restoration work.
- CSV/export records and immutable finalized/paid workflow foundations.

### BVI government forms

- NHI Form K and SSB Forms I and II preview/download foundations.
- Official-template rendering, employee rows, company identifiers, contribution totals, signature, signing date, month name, and Form II output.
- Forms can include current employees before payroll is finalized and use finalized payroll values when available.

### Finance

- Chart of accounts, customers, suppliers, products/services, invoices, bills, customer payments, bill payments, expenses, and deposits.
- Draft/open/partial/paid/void transaction states, line totals, allocation logic, posting/voiding, and audit records.
- Basic finance dashboard/report summary, monthly profit-and-loss-style totals, receivables/payables, top customers, and CSV export.
- Accounting file import preview and commit workflow. No live QuickBooks sync is intended.

### Operations and quality

- PostgreSQL schema and migrations, seed data, environment validation, CI scripts, API unit tests, and finance smoke-test scripts.
- At the latest review, 72 automated tests passed and TypeScript checks passed. Re-run them; do not assume they still pass after changes.

## Confirmed incomplete or high-risk areas

Treat these as known findings, not guesses.

### 1. Navigation contains duplicate or misleading destinations

- Admin **Paystubs** and **Payroll exports** both point to the Pay runs list instead of dedicated, task-focused pages.
- **Bookmarks** points to Reports and is not a real bookmarks feature.
- Some dashboard shortcuts duplicate these misleading destinations.
- Index pages that intentionally redirect to the first useful subsection are acceptable, but a labeled feature must not masquerade as a different screen.

Create dedicated pages where the workflow is useful, or remove the label until the workflow exists. Do not keep duplicate links merely to make the menu look complete.

### 2. Finance is operational record keeping, not yet full accounting

The application stores invoices, bills, payments, expenses, deposits, products, and account categories, but the schema does not currently show a true double-entry general ledger with journal entries and balanced debit/credit lines.

Before calling Finance “professional accounting,” design and implement:

- immutable journal entries and journal lines;
- balanced debit/credit validation;
- controlled posting mappings for invoices, payments, bills, bill payments, expenses, deposits, payroll liabilities, and payroll expense;
- accounts receivable and accounts payable control accounts;
- bank accounts, transfers, reconciliation, opening balances, and period close/lock;
- chart-of-account rules and inactive accounts;
- trial balance, general ledger, balance sheet, profit and loss, cash flow, AR aging, AP aging, and transaction drill-down;
- void/reversal entries instead of destructive deletion after posting;
- tax configuration only if BVI rules require it and the owner approves it;
- customer/job/location profitability suitable for cleaning and restoration work.

If this scope is not yet complete, label the section accurately as finance operations rather than claiming full QuickBooks equivalence.

### 3. Statutory settings require official verification and effective dates

Current defaults in code include NHI 3.75% employee and employer, SSB 4% employee and 4.5% employer, payroll-tax employee rate 8%, employer Class 1 rate 2%, Class 2 rate 6%, and a $10,000 exemption. The configured NHI annual ceiling is $106,800 for 2026. The SSB annual ceiling currently defaults to $53,400 and may be stale.

Do not silently change these values from competitor websites or memory. Verify every rate, ceiling, exemption, due date, employee category, age rule, and form layout using current official BVI sources. Add:

- effective-from and effective-to dates;
- versioned statutory tables by tax year;
- a source URL/document reference and verification date;
- historical calculations that retain the rules used at finalization;
- warnings for incomplete identifiers or invalid dates;
- owner/payroll-professional approval before live use.

Official starting points:

- BVI laws: https://laws.gov.vg/inf-alpha/l
- BVI Labour and Workforce Development: https://www.gov.vg/department-labour-and-workforce-development
- BVI Inland Revenue: https://gov.vg/inland-revenue-department
- NHI: https://www.vinhi.vg/
- BVI Social Security Board: https://www.bvissb.vg/

### 4. Historical payroll and year-to-date migration need a controlled workflow

The owner may enter payroll from January onward so payroll tax year-to-date calculations and employee pay history are correct. Build a dedicated opening/historical payroll import, not fake current-period runs.

It must support:

- employee mapping and unmatched-record review;
- pay dates, gross earnings, taxable earnings, hours/days, NHI, SSB, payroll tax, other deductions, employer amounts, and net pay;
- opening year-to-date balances when detailed prior pay periods are unavailable;
- duplicate detection and reconciliation totals;
- dry-run preview, validation errors, approval, immutable import batch, reversal, and audit trail;
- historical paystubs clearly marked as imported when enough detail exists;
- no employee-facing paystub generated from incomplete data without a warning.

### 5. Security must be upgraded for hosted production

- Move browser bearer tokens from `sessionStorage` to secure, HttpOnly, SameSite cookies or another reviewed server-managed session design.
- Add CSRF protection appropriate to the final authentication design.
- Add MFA for platform owner, HR, payroll, and finance roles.
- Add session/device management, login history, forced logout, and recovery controls.
- Replace in-memory login/reset throttles with a distributed production-safe store.
- Review authorization on every endpoint and every employee-sensitive field.
- Add secret rotation, security headers review, structured security logging, dependency scanning, and incident procedures.
- The latest `npm audit` reported three high-severity findings in the Prisma toolchain through `deepmerge-ts`. Upgrade and verify Prisma safely; do not use a force upgrade without migration and regression testing.

### 6. Document storage is not ready for multi-device hosting

Local disk storage works for local development. The S3/R2 class currently throws “not implemented.” Complete private object storage with:

- encrypted private bucket;
- unique non-user-controlled object keys;
- short-lived signed access or authenticated streaming;
- malware scanning/quarantine workflow;
- MIME/signature/size enforcement;
- versioning, retention, legal hold where needed, backup, restore, and deletion audit;
- migration tooling from local employee files;
- tests proving one employee cannot access another employee's restricted documents.

### 7. Reporting is too shallow

Add role-filtered, date-filtered, exportable reports with drill-down:

- payroll register and payroll summary;
- employee earnings, deductions, employer contributions, liabilities, and year-to-date totals;
- NHI, SSB, and payroll-tax reconciliation;
- time by employee, day, location, customer/job, approval status, and overtime;
- leave/time-off balances and usage when leave is implemented;
- labor cost and profitability by customer/job/location;
- paystub and payroll-export history;
- audit/security activity;
- general ledger, trial balance, balance sheet, P&L, cash flow, AR aging, and AP aging after ledger implementation.

Every report must explain its period and basis through labels, not developer commentary, and totals must reconcile to source records.

### 8. HR breadth is incomplete

Professional HR products provide more than an employee profile. Prioritize the features KleenToDiTee will actually use:

- departments, job titles, managers, employment type, compensation history, and emergency contacts;
- leave/time-off policies, balances, requests, approvals, holidays, and payroll impact;
- onboarding/offboarding checklists and document acknowledgements;
- certifications, training, equipment/PPE assignment, expiry reminders, and work-permit reminders;
- employee document categories, renewal dates, and compliance alerts;
- performance notes/reviews only after core payroll, time, leave, and compliance workflows are dependable.

Do not copy broad enterprise features merely to inflate the menu. Build complete workflows in owner-priority order.

### 9. Scheduling and location/job costing need deeper workflows

The business moves workers among cleaning/restoration locations daily. Build a shared source of truth for customers, properties/job sites, assignments, and time locations rather than relying only on free text.

Add:

- customer/property/job-site records with active/inactive status;
- multi-location daily assignments and reusable crews;
- recurring shifts, bulk scheduling, copy week, edit/reschedule, absence and cancellation;
- conflict, overlap, missing clock, and excessive-hours warnings;
- optional geolocation/geofence only with explicit privacy policy and owner approval;
- labor-hour and labor-cost allocation by job site;
- comparison of scheduled versus worked hours;
- mobile-first schedule and time entry.

Preserve a controlled free-text fallback for unusual sites, but report it for cleanup.

### 10. Production operations are incomplete

Complete and prove:

- hosted PostgreSQL migrations without automatic destructive schema push;
- encrypted database backups, object-storage backups, restore drills, and retention schedule;
- health checks, uptime monitoring, error tracking, structured logs, and alerts;
- SMTP delivery monitoring and bounce/failure handling;
- separate development, staging, and production environments;
- domain, TLS, environment secrets, and least-privilege service accounts;
- deployment rollback and database migration rollback/forward-fix plan;
- data export and business-continuity procedures.

## Professional product benchmarks

Use competitors to understand expected workflow quality, not to copy branding or unsupported features.

- QuickBooks Payroll: integrated payroll/accounting workflow, employee access to pay information, time tracking, guided payroll review.
  https://quickbooks.intuit.com/payroll/core/
- BambooHR: unified employee data, payroll, time, onboarding, reporting, access controls, and audit trails.
  https://www.bamboohr.com/platform/
- BambooHR Time: time-off policies, approvals, project/location tracking, schedules, overtime, and reminders.
  https://www.bamboohr.com/platform/time-and-attendance/
- Gusto: payroll, HR, time, compliance, onboarding, and employee self-service.
  https://gusto.com/product
- Rippling Time: approved time flowing into payroll, location-aware rules, exceptions, and analytics.
  https://www.rippling.com/products/hr/time-and-attendance

Research current official pages before making benchmark claims. Do not add a competitor feature until it has a clear KleenToDiTee use case and complete data, permissions, API, UI, audit, testing, and mobile behavior.

## Required execution method

### Phase 0: protect the existing system

1. Read `README.md`, `.env.example`, current inventory/deployment/security documents, package scripts, Prisma schema, API routes, and both application route trees.
2. Run `git status` and preserve all existing changes.
3. Back up the current database and employee files before schema or migration work.
4. Start the full platform and confirm admin, tracker, API health, sign-in, and database connection.
5. Run baseline typecheck, lint, tests, build, dependency audit, and smoke tests. Record exact failures without hiding them.

### Phase 1: create a truthful completion matrix

Inventory every visible admin and employee route. For each tab/page/control record:

```text
Area | Route | Visible controls | API endpoint | Database model | Permission | Working state | Mobile state | Automated test | Decision
```

Working state must be one of:

- complete and verified;
- partial with exact missing behavior;
- broken with reproduction steps;
- duplicate/misleading;
- intentionally removed.

Do not call a page complete because it renders. Test create, read, update, validation, permissions, error handling, audit, archive/void/delete behavior, refresh persistence, and mobile layout.

### Phase 2: repair release blockers first

Order work by risk and dependency:

1. Startup/data safety and failing tests.
2. Authentication, authorization, MFA/session design, and private file storage.
3. Employee master data and work authorization.
4. Locations/jobs, schedules, multi-location time, approvals, and exceptions.
5. Payroll calculations, historical/YTD import, statutory versioning, review/finalize/void, paystubs, and official forms.
6. Leave/time off and payroll integration.
7. Reports and reconciliations.
8. Finance general ledger and bank reconciliation, if the owner confirms full accounting scope.
9. Production deployment, monitoring, backups, restore test, and launch checklist.
10. Broader HR enhancements after core operations are proven.

### Phase 3: complete one vertical workflow at a time

For each workflow, finish all of these together:

- database schema and migration;
- API validation and authorization;
- audit events;
- admin UI;
- employee UI where applicable;
- empty/loading/error/success states;
- responsive phone/tablet/desktop behavior;
- keyboard/accessibility behavior;
- unit/integration/e2e tests;
- visual verification and documentation.

Do not leave a database-only feature, a UI-only button, or an endpoint with no usable screen.

### Phase 4: visual and mobile audit

Use browser automation and screenshots at minimum widths around 390, 768, 1024, and 1440 pixels. Slowly inspect every page and every tab while signed in with each relevant role.

Check:

- no horizontal overflow or overlapping text;
- no controls hidden below unusably long pages;
- sticky actions only where they do not cover content;
- touch targets are comfortably sized and separated;
- employee names and rows navigate predictably;
- dangerous buttons are visually separated from ordinary actions;
- forms are split into focused steps/tabs without losing unsaved work;
- tables become usable mobile lists or controlled horizontal tables;
- dates, money, statuses, errors, and statutory forms are readable;
- no development/test/AI wording appears in production UI;
- browser back/forward, refresh, and deep links work.

### Phase 5: release proof

Before declaring any phase complete, provide:

1. Files changed and migrations added.
2. Exact acceptance criteria completed.
3. Test commands and results.
4. Desktop/tablet/mobile screenshots for changed workflows.
5. Remaining risks and why they remain.
6. Data migration/rollback notes.
7. A short owner test script written in non-technical language.

## Mandatory acceptance criteria for core workflows

### Employee lifecycle

- Create, edit, archive, restore, and search work after refresh.
- Email is required when tracker/email access is needed and validated consistently.
- Work permit number/expiry appears only for work-permit employees.
- Current workers do not require an end date; ended workers require a reason and date.
- Profile photo replacement removes the old active image and crop/zoom/save works with mouse, touch, and stylus.
- Sensitive IDs are masked by default and access is audited.
- Archived employees disappear from current operational selectors but remain in historical payroll and reports.

### Time and locations

- Multiple locations can be added and removed on the same date.
- Each location has valid start, finish, break, and calculated hours.
- Overlaps and impossible times are blocked or flagged.
- Totals survive save and refresh.
- Submission and approval are obvious; approved/paid time cannot be silently edited.
- Employee names open the relevant record; do not rely on tiny adjacent Edit links.
- Payroll pays daily workers once per qualifying day, not once per location.

### Payroll

- A preview explains every employee's gross, additions, deductions, employer contributions, and net.
- Missing employee setup and unapproved/missing time are blocking or clearly actionable warnings.
- Finalization captures immutable calculation inputs and statutory-rule versions.
- Paid payroll cannot be deleted; corrections use controlled void/reversal and replacement.
- Paystubs can be previewed before finalization and accessed after issue.
- Historical/YTD imports reconcile and do not double count current runs.
- Payroll liabilities reconcile to statutory forms and finance postings.

### Government forms

- Official layout is visually compared against the current agency form.
- Company and employee identifiers, names, periods, earnings/contributions, signature, and date fit their boxes.
- All required continuation pages such as SSB Form II are generated.
- Preview updates with selected period/date/signature and download produces the same content.
- Missing employee data is listed with direct links to repair the employee record.

### Permissions and audit

- Test platform owner, HR admin, payroll admin, finance admin, supervisor, office support, and employee tracker roles separately.
- Users see only permitted navigation and receive server-side denial if bypassing the UI.
- Sensitive reads, changes, approvals, exports, downloads, deletions, voids, and permission changes are audited.
- Audit entries include actor, action, target, timestamp, and useful before/after context without leaking secrets.

### Backups and deployment

- A backup is not considered working until it has been restored into a separate test environment.
- Database and employee files must share a consistent backup point or documented reconciliation process.
- Deployment must not seed demo data or run a destructive schema push.
- Staging must pass sign-in, employee edit, time submission/approval, payroll preview, government-form preview/download, document upload/download, email reset, and backup/restore tests before production.

## Engineering rules

- Follow the existing TypeScript, Next.js, Hono, Prisma, and UI patterns.
- Prefer small, reviewed migrations and reusable domain services over page-specific calculation copies.
- Store money using a decimal-safe strategy. Do not introduce floating-point drift into accounting or payroll records.
- Use database transactions for multi-record payroll, payment, allocation, journal, and time-location changes.
- Enforce invariants on the server even when the UI validates them.
- Never hard-delete finalized payroll, issued paystubs, posted journals, audit records, or legally required employee history.
- Never expose passwords, tokens, government identifiers, document paths, SMTP credentials, or signing secrets in logs or responses.
- Do not add packages casually. Check maintenance, licensing, bundle/server impact, and vulnerabilities.
- Do not perform a broad visual redesign while core correctness is unfinished. Keep the restrained existing business UI and improve consistency.
- Do not use automated seed/reset as a substitute for migration of the owner's real local data.

## Reporting format while working

At the beginning, return:

1. a concise audit summary;
2. the completion matrix;
3. a risk-ranked backlog with dependencies;
4. the first implementation batch and acceptance tests.

Then begin implementing the highest-priority batch. Do not stop after writing a plan unless blocked by a decision that cannot safely be inferred.

After each batch, report only:

- completed behavior;
- verification results;
- remaining blockers/risks;
- next batch.

Avoid long explanations, fabricated progress, and statements such as “fully working” without test and visual evidence.

## Definition of professional release

The application is not ready for live payroll merely because all menu items open. It is ready only when:

- core workflows are complete on desktop, tablet, and phone;
- BVI statutory configuration has current official sources and professional approval;
- historical/YTD balances are migrated and reconciled;
- permissions, security, object storage, backups, restore, monitoring, and email are production ready;
- payroll, paystubs, government forms, liabilities, and finance postings reconcile;
- no placeholder or misleading navigation remains;
- automated and visual regression tests pass in staging;
- the owner completes a documented parallel payroll comparison and signs off before the first live run.

Start by auditing the repository and producing the truthful route/control completion matrix. Then immediately repair the highest-risk incomplete vertical workflow without discarding existing work.

