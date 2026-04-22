# KleenToDiTee Platform Blueprint

> Research-backed blueprint for a QuickBooks-inspired HR, payroll, finance, and operations platform. This document is intended to be reviewed by Claude or another research-oriented agent before implementation begins.

**Date:** April 20, 2026

**Product Name:** KleenToDiTee Platform

**Current Starting Point:** `kleentoditee-payroll-pro` is a browser-local payroll prototype with employees, timesheets, payroll calculations, payroll history, CSV export, JSON backup, and PWA support.

**Target Outcome:** Transform the current payroll prototype into a full internal admin and manager platform with:
- a QuickBooks-style admin shell
- a dedicated employee tracking app
- core HR and payroll workflows
- finance and accounting modules
- hiring, onboarding, compliance, and reporting

---

## 1. Executive Summary

KleenToDiTee should be designed as a single connected platform with two products:

1. **Admin/Manager Console**
Used by HR, payroll admins, finance admins, operations managers, site supervisors, and leadership.

2. **Employee Tracking App**
Used by employees only for clocking in and out, breaks, task and site tracking, correction requests, and status visibility.

The platform should be **single-company now, multi-tenant-ready later**. The first implementation should optimize for internal operational control, low cognitive load, and strong auditability. The admin shell should follow the usability principles of modern QuickBooks Online:
- stable left rail
- top global search
- customizable shortcuts
- dashboard widget grid
- grouped app directories
- progressive disclosure

The system should not be a payroll-only upgrade. It should become a workforce and back-office operating platform where people, time, payroll, and finance all share the same core data model and workflow rules.

---

## 2. Non-Negotiable Product Decisions

- **Audience:** internal admins and managers only for the main console
- **Employee role:** employees use a separate tracking app, not a full employee self-service portal
- **Architecture direction:** full-stack rebuild using the current app as workflow reference only
- **Commercialization posture:** single-company active setup with tenant-ready data boundaries
- **UI inspiration:** QuickBooks-style layout and interaction model, but not a visual clone
- **Research gate:** no implementation should begin until Claude or another research agent reviews this blueprint and validates assumptions against current market patterns and local payroll/accounting constraints

---

## 3. Research Basis

This blueprint is informed by current official product and help documentation available as of April 20, 2026.

### QuickBooks / Intuit
- Menu, bookmarks, pinned apps, and widget customization:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/bookkeeping-processes/understand-navigation-menu-quickbooks-online/L310NeoHY_US_en_US
- Intuit platform overview, search, app carousel, and create actions:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/product-setup/get-started-adjust-settings-sign-intuit-quickbooks/L6TekQ3zX_US_en_US
- Global search:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-transactions/search-transactions-quickbooks-online/L4hBemuUP_US_en_US
- Custom roles, fields, workflows, and dashboards:
  - https://quickbooks.intuit.com/online/advanced/customizations/
- Invoicing:
  - https://quickbooks.intuit.com/accounting/invoicing/
- Bills:
  - https://quickbooks.intuit.com/accounting/manage-bills/
- Bank transactions:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/banking/categorize-match-online-bank-transactions-online/L1bTafTz3_US_en_US
- Rules:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/banking/set-bank-rules-categorize-online-banking-online/L0mjJl0nD_US_en_US
- Reconcile:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/statement-reconciliation/reconcile-account-quickbooks-online/L3XzsllsK_US_en_US
- Chart of accounts:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/chart-accounts/learn-chart-accounts-quickbooks-online/L2yc6KBob_US_en_US
- Journal entries:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/accounting-bookkeeping/create-journal-entry-quickbooks-online/L6Bzy9mT9_US_en_US
- Bank deposits:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/bank-deposits/record-make-bank-deposits-quickbooks-online/L2BBZOPdr_US_en_US
- Recurring transactions:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/recurring-transactions/create-recurring-transactions-quickbooks-online/L3WoKX2R8_US_en_US
- My Accountant:
  - https://quickbooks.intuit.com/learn-support/en-us/help-article/accountant-features/use-accountant-page/L323FXOCi_US_en_US

### BambooHR
- Platform overview:
  - https://www.bamboohr.com/
- ATS:
  - https://www.bamboohr.com/platform/applicant-tracking-system/
- Time and attendance:
  - https://www.bamboohr.com/platform/time-and-attendance/
- Performance:
  - https://www.bamboohr.com/platform/performance-management/
- Onboarding:
  - https://www.bamboohr.com/ca/platform/onboarding/

### Workday
- Workforce management:
  - https://www.workday.com/en-us/products/workforce-management/overview.html

### Connecteam
- Document and onboarding/compliance patterns:
  - https://connecteam.com/hr-people-management/documents/

These sources informed the module set, workflow boundaries, finance taxonomy, widget/dashboard behavior, search behavior, and internal admin focus of this blueprint.

---

## 4. Product Shape

### 4.1 Admin/Manager Console

Primary responsibilities:
- employee records and HR administration
- time approval and exception handling
- payroll review and pay execution
- finance and accounting operations
- supplier and customer transaction workflows
- hiring and onboarding coordination
- reporting, compliance, and audit review

Primary roles:
- platform owner
- HR admin
- payroll admin
- finance admin
- operations manager
- site supervisor
- leadership / read-only manager

### 4.2 Employee Tracking App

Primary responsibilities:
- clock in and out
- break tracking
- site and task selection
- submit timesheets or correction requests
- view personal work history and status
- receive assignment reminders and simple alerts

Explicitly out of scope:
- editing employee master records
- changing compensation
- payroll setup
- HR administration
- cross-team data access

---

## 5. UX and Layout Principles

### 5.1 QuickBooks-Style Shell

The shell should use:
- a thin left rail for global utilities
- top-centered global search
- app chips / app carousel beneath the header
- a favorites row for quick actions
- a customizable widget dashboard
- a searchable All Apps directory

### 5.2 Left Rail Core

Required left rail items:
- Create
- Bookmarks
- Home
- Feed
- Reports
- All Apps
- Customize

### 5.3 Default Pinned Apps

Recommended pinned apps:
- People
- Payroll
- Time
- Finance
- Hiring
- Reports

### 5.4 Interaction Rules

- keep the shell stable across every module
- show summary and urgency before detail
- use progressive disclosure instead of loading every option at once
- make search faster than menu digging
- support personalization without making the system chaotic
- preserve role-aware defaults
- make every page feel calm on first load, dense only where needed

---

## 6. Global Navigation Tree

```yaml
shell:
  left_rail_core:
    - Create
    - Bookmarks
    - Home
    - Feed
    - Reports
    - All apps
    - Customize

  default_pinned_apps:
    - People
    - Payroll
    - Time
    - Finance
    - Hiring
    - Reports
```

### 6.1 All Apps

```yaml
People:
  - Overview
  - Employee directory
  - Org structure
  - Departments & sites
  - Documents
  - Leave & absences
  - Onboarding
  - Offboarding
  - Performance
  - Training & certifications
  - Compliance cases

Payroll:
  - Overview
  - Pay runs
  - Pay periods
  - Time import review
  - Earnings & deductions
  - Taxes & statutory
  - Paystubs
  - Exports & bank files
  - Payroll history

Time:
  - Overview
  - Live attendance
  - Timesheets
  - Corrections
  - Approvals
  - Breaks
  - Overtime & exceptions
  - Site rules & geofences
  - Kiosks & devices

Finance:
  Accounting:
    - Bank transactions
    - Integration transactions
    - Reconcile
    - Rules
    - Chart of accounts
    - Journal entries
    - Recurring transactions
    - Closing periods
    - My accountant / advisor
  Expenses & Bills:
    - Overview
    - Expense transactions
    - Suppliers
    - Bills
    - Bill payments
    - Cheques
    - Supplier credits
    - Recurring bills
    - Purchase orders
  Sales & Get Paid:
    - Overview
    - Sales transactions
    - Invoices
    - Estimates
    - Payments received
    - Sales receipts
    - Statements
    - Recurring invoices
    - Bank deposits
  Customers:
    - Overview
    - Leads
    - Customers
    - Contracts
    - Accounts receivable
    - Statements
    - Notes & activity
  Products & Services:
    - Products & services
    - Price lists
    - Service bundles
    - Categories
    - Inventory
  Tax:
    - Overview
    - Payroll tax
    - Sales tax
    - Business tax returns
    - Tax summary
    - Tax review
    - Filing calendar

Hiring:
  - Overview
  - Jobs
  - Candidates
  - Pipeline
  - Interviews
  - Offers
  - Preboarding
  - Onboarding handoff

Reports:
  - Overview
  - Saved reports
  - Scheduled reports
  - HR reports
  - Payroll reports
  - Time reports
  - Finance reports
  - Hiring reports
  - Compliance reports

Settings:
  - Company profile
  - Users & roles
  - Approval workflows
  - Custom fields
  - Policies
  - Integrations
  - Notifications
  - Audit log
  - Import / export
```

---

## 7. Global Search, Create, Bookmarks, and Favorites

### 7.1 Search

The top search bar must be a global platform feature and return grouped results across:
- actions
- pages
- employees
- candidates
- customers
- suppliers
- transactions
- payroll objects
- reports
- help content

### 7.2 Create Actions

The Create launcher should support:
- Add employee
- Start onboarding
- Add leave request
- Add time entry
- Fix missed punch
- Start payroll run
- Add payroll adjustment
- Create invoice
- Record expense
- Add bank deposit
- Create cheque
- Create bill
- Pay bill
- Create journal entry
- Add supplier
- Add customer
- Add product or service
- Create job
- Add candidate
- Schedule interview
- Create offer
- Run report

### 7.3 Favorite Actions

Users should be able to pin up to ten favorite actions with role-based defaults and later usage-based suggestions.

### 7.4 Bookmarks

Bookmarks should work for:
- pages
- reports
- saved views
- queues
- dashboards

---

## 8. Home Dashboard and Widgets

The dashboard should be based on a widget registry with per-role defaults and user-level layout persistence.

### 8.1 Core Widget Catalog

Recommended widgets:
- Needs attention
- Pending approvals
- Payroll status
- Attendance exceptions
- Who's working now
- Leave calendar
- Headcount snapshot
- New hires & onboarding
- Compliance alerts
- Labor cost by site
- Cash snapshot
- Invoices
- Bills
- Bank accounts
- Accounts receivable
- Accounts payable
- Revenue trend
- Expense trend
- Profit & loss snapshot
- Hiring pipeline
- Recent activity
- Bookmarks / recent pages
- Report shortcuts
- System health

### 8.2 Default Role Layouts

- **Platform owner:** system health, cash, payroll status, compliance, finance trends
- **HR admin:** approvals, headcount, onboarding, leave, compliance, hiring
- **Payroll admin:** payroll status, time exceptions, labor cost, bank/export warnings
- **Finance admin:** cash, invoices, bills, bank accounts, A/R, A/P, P&L
- **Operations manager:** live attendance, approvals, exceptions, leave calendar, labor cost
- **Site supervisor:** pending approvals, live attendance, exceptions, team status

---

## 9. Module Blueprints

### 9.1 Core HR / People

Features:
- employee master profile
- employment history
- compensation history
- department, site, and manager assignments
- document and certification storage
- emergency contacts
- compliance cases
- policy acknowledgements

Primary entities:
- `employee`
- `employment_record`
- `department`
- `site`
- `manager_assignment`
- `compensation_record`
- `employee_document`
- `employee_certification`
- `employee_contact`
- `employee_case`
- `policy_acknowledgement`

### 9.2 Leave & Absence

Features:
- leave types
- accrual policies
- carryover
- holiday calendars
- request and approval flow
- Who's Out calendar
- payroll impact

Primary entities:
- `leave_policy`
- `leave_balance`
- `leave_request`
- `leave_approval`
- `holiday_calendar`
- `absence_event`

### 9.3 Time & Attendance

Features:
- clock in and out
- break tracking
- timesheets
- correction requests
- manager approvals
- GPS / geofence support
- site and task coding
- overtime and anomaly alerts
- kiosk and device support

Primary entities:
- `time_event`
- `timesheet`
- `timesheet_line`
- `break_event`
- `attendance_exception`
- `approval_batch`
- `geofence_rule`
- `device`

### 9.4 Employee Tracking App

Features:
- clock in and out
- breaks
- site selection
- task selection
- correction request submission
- work history
- status and notifications

Primary entities:
- `employee_session`
- `shift_presence`
- `correction_request`
- `assignment_view`

### 9.5 Payroll

Features:
- pay periods
- pay runs
- approved time import
- earnings and deductions
- statutory rules
- adjustments
- paystubs
- exports and bank files
- payroll history
- accounting posting

Primary entities:
- `pay_period`
- `pay_run`
- `pay_run_item`
- `earning_type`
- `deduction_type`
- `tax_rule`
- `payroll_adjustment`
- `paystub`
- `export_batch`

### 9.6 Hiring

Features:
- job requisitions
- candidate pipeline
- interview management
- offer generation
- preboarding
- employee conversion

Primary entities:
- `job_requisition`
- `candidate`
- `application`
- `pipeline_stage`
- `interview`
- `offer`
- `preboarding_packet`

### 9.7 Onboarding and Offboarding

Features:
- templates by role and site
- task orchestration
- document requests
- e-signatures
- probation checkpoints
- exit checklists

Primary entities:
- `onboarding_template`
- `onboarding_task`
- `offboarding_task`
- `checklist_instance`
- `document_request`

### 9.8 Performance & Development

Features:
- goals
- review cycles
- manager reviews
- peer feedback
- one-on-one notes
- development plans
- training
- certifications

Primary entities:
- `goal`
- `review_cycle`
- `review_form`
- `feedback_entry`
- `development_plan`
- `training_course`
- `course_completion`

### 9.9 Finance

Finance must be treated as a real accounting system, not just transaction forms.

Submodules:
- Sales & Get Paid
- Expenses & Bills
- Banking
- Accounting
- Products & Services
- Tax

Must support:
- invoices
- estimates
- sales receipts
- customer payments
- statements
- expenses
- bills
- bill payments
- supplier credits
- cheques
- bank deposits
- bank transactions
- rules
- reconciliation
- journal entries
- recurring transactions
- customers
- suppliers
- products and services
- optional inventory later

Critical rule:
- business forms create accounting consequences through balanced posting batches

### 9.10 Reports & Analytics

Features:
- standard reports
- saved reports
- scheduled reports
- bookmarked reports
- filtered views
- export and sharing
- executive and operational dashboards

Primary entities:
- `report_definition`
- `saved_report_view`
- `scheduled_report`
- `dashboard_widget_layout`

### 9.11 Workflow, Notifications, and Audit

Features:
- approvals
- reminders
- escalations
- due dates
- notification routing
- immutable audit visibility

Primary entities:
- `workflow_rule`
- `workflow_instance`
- `notification_event`
- `audit_event`

### 9.12 Integrations

Inbound:
- bank feeds
- payment processors
- ecommerce connectors
- biometric clocks
- GPS time tools
- external payroll imports

Outbound:
- bank files
- accounting exports
- report exports
- paystub delivery
- tax handoff exports

Primary entity:
- `integration_connection`

---

## 10. Finance Data Model Backbone

Finance requires disciplined accounting entities.

### 10.1 Master Records
- `chart_account`
- `customer`
- `supplier`
- `product_service`
- `bank_account`

### 10.2 Operational Transactions
- `invoice`
- `invoice_line`
- `customer_payment`
- `estimate`
- `sales_receipt`
- `expense_transaction`
- `bill`
- `bill_line`
- `bill_payment`
- `supplier_credit`
- `cheque`
- `bank_deposit`
- `journal_entry`
- `journal_entry_line`
- `recurring_template`
- `bank_feed_transaction`
- `integration_transaction`

### 10.3 Accounting Layer
- `posting_batch`
- `ledger_entry`

### 10.4 Controls
- `reconciliation_session`
- `reconciliation_line`
- `closing_period`
- `audit_event`

### 10.5 Accounting Rules
- every posting batch must balance debits and credits
- every posted result must be traceable to a source transaction
- reversals and adjustments must be explicit
- closed periods should restrict edits
- payroll must post from approved snapshots
- bank deposits should support combining multiple incoming payments

---

## 11. Workflow Boundaries

- employees submit raw time and correction requests through the tracking app
- supervisors approve or reject work data
- payroll consumes approved snapshots only
- HR owns people records and compliance state
- finance owns accounting structure and money movement workflows
- hiring converts candidates into employees without re-entry
- finalized payroll and posted accounting records become controlled historical records

---

## 12. Technical Architecture Recommendation

This stack recommendation is an engineering inference, not a user requirement. Claude should validate it during the research gate.

Recommended build shape:
- **monorepo**
- **Admin app:** React / Next.js web app
- **Employee app:** mobile-first PWA or companion app sharing the same design system
- **API:** TypeScript service layer with modular domains
- **Database:** PostgreSQL
- **ORM / schema tooling:** Prisma or equivalent typed schema workflow
- **File storage:** S3-compatible object storage
- **Jobs / queues:** background worker with retry support
- **Caching / queues:** Redis
- **Search indexing:** Postgres full-text to start, dedicated search later if needed

Recommended repo shape:

```text
apps/
  admin-web/
  employee-tracker/
  api/
packages/
  ui/
  shell/
  auth/
  workflows/
  domain-people/
  domain-time/
  domain-payroll/
  domain-finance/
  domain-hiring/
  reporting/
infra/
docs/
```

### Architectural rules
- modular monolith first
- strict domain boundaries inside one backend
- all domain events auditable
- shared identity and permissions across apps
- widget, search, menu, and action systems driven by data/config instead of hardcoded UI trees

---

## 13. Build Phasing

### Phase 0: Research Gate
- validate local payroll, tax, and accounting assumptions
- validate data retention and audit requirements
- validate finance feature priorities against internal operating workflows
- validate chosen tech stack and mobile strategy

### Phase 1: Platform Foundation
- auth and permissions
- app shell
- global search
- bookmarks and favorites
- widget framework
- audit log
- notifications
- document storage

### Phase 2: People, Time, and Payroll Core
- employee records
- time entry and approvals
- payroll runs
- paystubs
- payroll exports
- payroll accounting hooks

### Phase 3: Finance Core
- invoices
- bills
- bank transactions
- bank rules
- chart of accounts
- journal entries
- bank deposits
- reconciliation

### Phase 4: Hiring, Onboarding, Leave
- ATS
- onboarding and offboarding tasks
- leave policies and balances
- Who's Out and manager approvals

### Phase 5: Performance, Training, Analytics
- goals
- reviews
- certifications
- advanced reports
- executive dashboards

### Phase 6: Commercialization Readiness
- tenant boundaries
- module licensing readiness
- advisor/accountant access
- partner-ready settings and branding controls

---

## 14. Claude Research Gate Instructions

Before implementation begins, Claude should:

1. Review this blueprint end to end.
2. Validate every major module against current HR, payroll, finance, and workforce-management product patterns.
3. Validate local business rules that affect payroll, tax, accounting, and document handling.
4. Confirm the finance model is sufficient for the operational use cases actually needed first.
5. Challenge any assumptions that appear overbuilt or under-specified.
6. Produce a written research review that identifies:
   - validated assumptions
   - risky assumptions
   - local compliance unknowns
   - recommended scope cuts for first release
   - recommended technical adjustments before implementation

Implementation should not begin until that review is complete.

---

## 15. Acceptance Criteria For The Blueprint

This blueprint is successful if it gives a build agent enough clarity to:
- understand the product vision
- understand the QuickBooks-inspired shell model
- understand the module map
- understand the data model backbone
- understand the workflow boundaries
- understand the build phases
- know what Claude must research before any build starts

---

## 16. Immediate Next Deliverables

After this blueprint, the next required documents are:
- a phased implementation plan
- a Claude pre-build research brief
- a technical architecture decision record
- a first-release scope definition
- a page-by-page acceptance criteria set for Phase 1 and Phase 2
