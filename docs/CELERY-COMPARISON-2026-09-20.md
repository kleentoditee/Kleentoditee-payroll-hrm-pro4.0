# Celery vs KleenToDiTee HRM and Payroll

**Review date:** 2026-09-20  
**Purpose:** Use Celery as a workflow benchmark, not as a product to copy. Decide what KleenToDiTee must finish to ship a dependable BVI payroll, HR, accounting, and field-service platform.

## Review scope and limits

This review combines:

- a read-only inspection of the signed-in KleenToDiTee trial company in Celery;
- Celery's public BVI product page and official help articles;
- the current KleenToDiTee repository, database schema, routes, tests, build results, and shipping plan.

No data was changed in Celery. Private employee values are intentionally not reproduced here. The signed-in workspace is a new trial with one employee and no completed payroll, so it proves the available screens and workflows but not the correctness of a completed Celery payroll.

## Executive conclusion

KleenToDiTee is already broader than Celery in accounting and cleaning-company operations. It has receivables, payables, journals, fiscal periods, banking, reconciliation, financial statements, year-end close support, multi-location time, work assignments, and operational staff requests. Celery is more mature in payroll administration and HR structure: departments, cost centers, wage codes, employee career records, work schedules, leave policies, recurring imports, bank payment files, document distribution, and a broad BVI payroll report catalogue.

The correct direction is:

1. Finish Batch 16 production delivery before adding major modules.
2. Add a focused **HR Structure and Payroll Operations** batch after production delivery.
3. Do not replace KleenToDiTee's accounting with Celery-like journal exports.
4. Do not copy Celery's screens, branding, or code. Reuse the workflow lessons in KleenToDiTee's simpler interface.
5. Do not claim filing readiness from this comparison. Statutory outputs still require owner review and a monitored parallel payroll run.

## What the signed-in Celery workspace confirmed

### Employer structure

Celery exposes separate employer areas for:

- company details;
- wage codes;
- payment schedules;
- general-ledger mappings;
- departments;
- cost centers;
- integrations;
- HRM settings;
- pension settings.

The trial contains five coded departments. Celery's documentation confirms department hierarchy, department-specific ledger mappings, employee assignment, and department report filtering. Employees can belong to one department and position while also being allocated across cost centers. See [Celery: About departments](https://support.celerypayroll.com/en/support/solutions/articles/6000225550-about-departments).

### Employee record

The live employee record separates **Payroll** and **HR** views.

Payroll data includes personal and statutory identifiers, employment status and category, employee number, department, position, entry date, salary, payment schedule, work pattern, statutory rates, prior employment, family, and account access.

HR data includes documents, time-off balances, career history, reporting relationships, work schedule, education, emergency contacts, and issued assets. Celery's effective-dated contract workflow also records employment type, location, department, position, manager, start/end dates, and career changes. See [Celery: Employee contracts](https://support.celerypayroll.com/en/support/solutions/articles/6000247501-hrm-setting-up-employee-contracts-in-celery).

### Payroll processing

Celery presents regular runs and additional runs separately, with a guided sequence of employees, changes, checks, and notifications. Its report catalogue includes payslips, net wages, bank transfers, salary journals, declarations, taxable fringe benefits, and wage cost per employee.

Celery also supports reusable spreadsheet mappings for recurring payroll changes such as hours, overtime, sickness, and bonuses. See [Celery: Mutation-sheet linking](https://support.celerypayroll.com/en/support/solutions/articles/6000225614-about-the-mutation-sheet-linking-) and [Celery: Importing a mutation sheet](https://support.celerypayroll.com/en/support/solutions/articles/6000220845-importing-a-mutation-sheet).

### Leave, calendar, and documents

The live calendar combines time off, sick leave, birthdays, anniversaries, resignations, mandatory leave, and public holidays. Celery's leave policies support employee assignment, work schedules, public-holiday handling, special leave, and time-for-time balances. See [Celery: Time-off policies](https://support.celerypayroll.com/en/support/solutions/articles/6000184509-what-is-the-hrm-time-off-policies-folder-exactly-for-), [public holidays](https://support.celerypayroll.com/en/support/solutions/articles/6000184503-hrm-holidays-set-up-and-link-public-holidays), and [time-for-time](https://support.celerypayroll.com/en/support/solutions/articles/6000201718-hrm-optional-how-to-set-up-time-for-time-timeback-hours-in-celery).

The document centre supports categories, search, active/archive status, company or employee posting, and calendar/list views. Celery documents can be shared with employees, managers, departments, or selected people, with notifications and employee-document expiry reminders. See [Celery: Documents](https://support.celerypayroll.com/en/support/solutions/articles/6000286600-hrm-documents-how-it-works).

### BVI payroll support

Celery advertises BVI payroll, digital payslips, P6 output, NHI and SSB forms, time and deduction imports, leave balances, and employee self-service. See [Celery payroll for the BVI](https://www.celerypayroll.com/en/payroll-software-for-bvi/) and its [BVI support library](https://support.celerypayroll.com/en/support/solutions/folders/6000242463).

Some help articles are older. They demonstrate product scope, but they are not a substitute for current NHI, SSB, Inland Revenue, or Labour Code authority.

## Capability comparison

| Area | Celery | KleenToDiTee today | Decision |
|---|---|---|---|
| BVI payroll calculations | Mature catalogue of BVI rules and reports | Effective-dated BVI rates, payroll runs, YTD openings, deductions, paystubs, NHI/SSB forms | Keep KTD engine; expand edge-case tests and outputs |
| Departments and positions | Structured codes, hierarchy, filters, GL links | Role and default site are mostly plain employee fields | **Celery ahead; add structured masters and history** |
| Cost centres | Separate master and reporting allocation | Locations/jobs exist operationally, but not as accounting cost-centre allocations | Add optional cost-centre dimension linked to locations/jobs |
| Contracts and career history | Effective-dated contracts, manager, work location, position, employment type | Start/status/end and employment fields exist; no full contract/career ledger | **Celery ahead; add effective-dated employment records** |
| Work schedules | Employee work schedules integrated with leave | Pay schedule and work assignments exist, but no reusable weekly work-pattern master | Add reusable work schedules without replacing daily site assignments |
| Daily multi-location work | Payroll mutation imports; not observed as a native field-service workflow | Multiple work locations on the same day, assignments, time approval | **KleenToDiTee ahead** |
| Leave policy depth | Policies, schedules, public holidays, special leave, time-for-time | Leave requests, balances, annual allowance, approvals | **Celery ahead; build Leave Policy v2** |
| Employee documents | Sharing, categories, archive, notifications, expiry/reminders | Upload/download and employee documents; production storage unfinished | Finish S3/R2 first, then add sharing and reminders |
| Bulk employee setup | Spreadsheet employee import | No equivalent mature bulk employee onboarding flow | Add validated preview/import with error rows |
| Recurring payroll imports | Reusable mutation mappings and removable import batches | YTD/opening and accounting imports exist; no reusable pay-mutation mapping | Add after core production gate |
| Payroll workflow | Guided regular/additional runs, checks, notifications | Periods, runs, review/approval, paystubs, statutory forms | Near parity; KTD needs end-to-end browser proof and clearer guided review |
| Bank payment file | Net-wage payment files and bank reports | Payment and payroll journals, but no confirmed bank upload file | Add configurable BVI bank export after bank format confirmation |
| Employee self-service | Web/mobile access to personal payroll and HR data | Responsive tracker for employee actions | KTD can ship responsive web; native app remains post-v1 |
| Notifications | Mature in-product/email workflow | Notification foundation; production email/WhatsApp incomplete | **Batch 16 priority** |
| Accounting | Salary-journal export to accounting packages | Native AR/AP/GL, periods, banking, reconciliation, statements, year end | **KleenToDiTee far ahead** |
| Financial statements | Payroll reports and salary journals | P&L, balance sheet, cash flow, equity, aging, liability status, snapshots | **KleenToDiTee far ahead** |
| Cleaning operations | Generic HR/payroll | Sites, daily movement, assignments, supplies, incidents, damage, equipment | **KleenToDiTee far ahead** |
| Multi-tenant SaaS isolation | SaaS account/company access model | Explicit organization membership and adversarial tenant-isolation tests | KTD implementation is strong; complete production security gate |

## What KleenToDiTee should build next

### Ship blocker: finish Batch 16

Do not interrupt the current shipping sequence. Complete:

- private S3/R2 document storage with tenant-scoped keys and signed access;
- queued email for invitations, password reset, paystubs, approvals, and failures;
- direct WhatsApp links that open the installed app where supported, with web fallback only when necessary;
- production monitoring, backups, and a demonstrated restore;
- desktop, tablet, and phone end-to-end tests;
- staging acceptance from company setup through payroll, reconciliation, and year-end preview.

### Next batch: HR Structure and Payroll Operations

Build this as one controlled batch after Gate B, in this order:

1. **Department, position, location, and cost-centre masters**
   - coded, active/archived, organization-scoped records;
   - parent department hierarchy;
   - effective-dated employee assignment;
   - optional GL/report dimension mapping;
   - migration from existing role/default-site strings without data loss.

2. **Employment contract and career history**
   - employment type, manager, department, position, work schedule, start/end dates;
   - current record plus immutable history;
   - contract/document expiry reminders;
   - no destructive overwrite of prior terms.

3. **Leave Policy v2**
   - policies assigned to employees or groups;
   - hours or days with a single canonical stored unit;
   - accrual, carryover, caps, special-event limits, and time-for-time;
   - BVI public-holiday calendar and work-schedule-aware calculations;
   - payroll impact shown before approval.

4. **Bulk onboarding and payroll mutation imports**
   - CSV/XLSX templates;
   - saved column mappings;
   - preview, validation, duplicate detection, row-level errors, and audit log;
   - reversible import batches before payroll finalization.

5. **Bank payment export**
   - employee bank details protected as sensitive data;
   - preview totals must reconcile exactly to approved net payroll;
   - bank-specific formats enabled only after sample-file validation;
   - no generic file labelled bank-ready without confirmed specifications.

6. **BVI statutory-output completion**
   - P6 and any required annual/employee outputs;
   - new-hire and leaver NHI/SSB workflows where officially required;
   - tests for age-related SSB treatment, overtime, fringe benefits, pension, gratuity/service charge, residency/applicability, and Payroll Tax Class 1;
   - prioritize cases relevant to a private cleaning/restoration employer; defer civil-service and uncommon categories until needed.

## Improvements not to copy from Celery

- Do not reproduce its dense, older desktop navigation on phones.
- Do not make users switch between disconnected Payroll and HR copies of the same employee data; use one concise employee record with clear tabs.
- Do not permit implausible days/hours/part-time combinations without warnings.
- Do not make accounting depend on exporting a salary journal to another product.
- Do not use generic locations where KleenToDiTee needs customer site, job, department, and accounting cost centre to remain distinct.
- Do not add native mobile apps, recruiting, performance management, or a large integration marketplace before the v1 production gate.

## Release recommendation

KleenToDiTee should ship its internal pilot after the remaining Gate A operational evidence is signed, then complete Batch 16 for subscriber release. The Celery-inspired HR batch should not delay private internal use unless the owner requires department reporting, contract history, or advanced leave accrual for the first live payroll.

For the first production release, the defensible position is:

> KleenToDiTee is a BVI-focused payroll, HR, accounting, and field-work platform for small service businesses. It provides management-prepared financial statements and filing-support outputs. It does not provide audit, tax, or legal assurance.

## Acceptance gates for the Celery-inspired batch

- Existing employees retain all current payroll, site, permit, document, and YTD data after migration.
- Department/cost-centre reports reconcile to company totals.
- A manager sees only authorized employees and requests.
- Leave balances reproduce from policy, schedule, holidays, approvals, and adjustments.
- Imported payroll changes can be traced to source file, row, user, and import batch.
- Bank-file total equals approved net payroll exactly.
- Government and annual outputs reproduce from a locked payroll snapshot.
- No placeholder, dead control, or explanatory developer text appears in production screens.
- Full tests, type checks, lint, production builds, browser workflows, and phone/tablet visual checks pass before commit.

