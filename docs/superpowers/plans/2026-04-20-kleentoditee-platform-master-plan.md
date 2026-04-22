# KleenToDiTee Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first release of the KleenToDiTee platform from the approved blueprint, starting with the platform shell, people core, time workflows, payroll, and finance foundations.

**Architecture:** Build a modular monolith in a monorepo with a shared backend, an admin web app, and an employee tracking app. Keep the UI QuickBooks-inspired, but make the system data-driven, auditable, and multi-tenant-ready later.

**Tech Stack:** TypeScript monorepo, React/Next.js admin app, mobile-first employee tracker, shared API service, PostgreSQL, object storage, background jobs, Redis, automated tests.

---

## Scope Note

The approved blueprint covers multiple major subsystems. This file is the **master program plan**. Before implementation of any stream, split the selected phase into its own task-level execution plan. Do not attempt to implement all modules in one uninterrupted build.

## Recommended Repository Shape

```text
kleentoditee-payroll-pro/
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
    superpowers/
      specs/
      plans/
```

## Mandatory Pre-Build Research Gate

### Task 0: Claude Research Review

**Files:**
- Read: `kleentoditee-payroll-pro/docs/superpowers/specs/2026-04-20-kleentoditee-platform-blueprint.md`
- Create: `kleentoditee-payroll-pro/docs/research/2026-04-20-claude-prebuild-review.md`

- [ ] Review the blueprint against current official product patterns for QuickBooks, BambooHR, Workday, and workforce/time tools.
- [ ] Validate payroll, finance, tax, document, and audit assumptions for the operating region and business model.
- [ ] Identify first-release scope cuts to prevent an overbuilt initial release.
- [ ] Produce a written report containing:
  - validated assumptions
  - risky assumptions
  - missing compliance research
  - recommended scope cuts
  - technical risks
  - required architecture adjustments before build
- [ ] Do not begin implementation until this review exists and has been read by the implementing agent.

### Task 1: Technical Decisions Record

**Files:**
- Create: `kleentoditee-payroll-pro/docs/architecture/2026-04-20-platform-tech-decisions.md`

- [ ] Lock the stack choice for:
  - monorepo tooling
  - frontend framework
  - backend framework
  - database and ORM
  - auth provider
  - object storage
  - queue/background jobs
  - deployment target
- [ ] Record rejected alternatives and why they were rejected.

## Phase 1: Platform Foundation

### Deliverables
- app shell
- left rail
- global search
- bookmarks
- favorite actions
- all apps directory
- widget registry
- auth and roles
- audit event framework
- notifications scaffold
- document storage scaffold

### Task 2: Monorepo and Application Skeleton

**Files:**
- Create monorepo root config
- Create `apps/admin-web`
- Create `apps/employee-tracker`
- Create `apps/api`
- Create shared `packages/*`

- [ ] Scaffold repository structure.
- [ ] Add baseline linting, type checking, formatting, and test commands.
- [ ] Add root README section describing app boundaries.

### Task 3: Design System and Shell

**Files:**
- Create `packages/ui`
- Create `packages/shell`
- Modify `apps/admin-web` to consume shell

- [ ] Build the stable top bar and left rail shell.
- [ ] Add global search trigger and search results frame.
- [ ] Add app chips, bookmarks panel, and create launcher.
- [ ] Add widget grid container and dashboard layout persistence model.

### Task 4: Auth and Roles

**Files:**
- Create `packages/auth`
- Create permission and role seed data
- Modify `apps/api` auth middleware

- [ ] Implement roles:
  - platform owner
  - HR admin
  - payroll admin
  - finance admin
  - operations manager
  - site supervisor
  - employee tracker user
- [ ] Enforce page and action visibility based on role.

### Task 5: Audit and Notifications Base

**Files:**
- Create audit event service
- Create notification event service

- [ ] Add standard event schema for before/after mutation tracking.
- [ ] Add notification model with in-app delivery first.

## Phase 2: People, Time, and Payroll Core

### Deliverables
- employee directory and profile
- time capture and approvals
- attendance exceptions
- pay periods and pay runs
- paystubs
- payroll exports

### Task 6: People Core

**Files:**
- Create people domain package
- Create employee list and employee detail pages
- Create document and certification models

- [ ] Implement employee master record.
- [ ] Implement department, site, manager, and compensation history.
- [ ] Add employee documents and certification expiry tracking.

### Task 7: Time Core

**Files:**
- Create time domain package
- Create employee tracker work event flows
- Create admin approval and exception pages

- [ ] Implement clock in/out and break events.
- [ ] Implement timesheets and correction requests.
- [ ] Implement manager approval queues and exception logic.

### Task 8: Payroll Core

**Files:**
- Create payroll domain package
- Create pay period and pay run pages
- Create export and paystub logic

- [ ] Import approved time into payroll.
- [ ] Calculate earnings, deductions, and taxes.
- [ ] Lock payroll from approved snapshots.
- [ ] Produce paystubs and export batches.

## Phase 3: Finance Core

### Deliverables
- customers and suppliers
- invoices and bills
- bank transactions and rules
- chart of accounts
- journal entries
- bank deposits
- reconciliation

### Task 9: Finance Master Data

**Files:**
- Create finance domain package
- Create chart account, customer, supplier, and product/service models

- [ ] Implement chart of accounts and basic customer/supplier directories.
- [ ] Add products and services with account mapping.

### Task 10: Sales and Expenses Transactions

**Files:**
- Create invoice, estimate, bill, expense, payment, and deposit pages

- [ ] Implement invoice and bill workflows.
- [ ] Implement payment recording and bill payment recording.
- [ ] Implement bank deposits that combine multiple payments.

### Task 11: Banking and Accounting Controls

**Files:**
- Create bank transactions, rules, reconcile, and journal entry pages

- [ ] Implement bank feed transaction review.
- [ ] Implement rules engine for categorization.
- [ ] Implement reconciliation sessions.
- [ ] Implement balanced journal entry posting.

## Phase 4: Hiring, Onboarding, Leave

### Deliverables
- ATS
- candidate pipeline
- onboarding tasks
- leave balances and requests
- Who's Out calendar

### Task 12: Hiring Core

- [ ] Implement jobs, candidates, applications, interviews, and offers.
- [ ] Add conversion from hired candidate into employee record.

### Task 13: Onboarding and Leave

- [ ] Implement onboarding templates and task orchestration.
- [ ] Implement leave policies, balances, requests, approvals, and payroll effect flags.

## Phase 5: Performance, Training, Reporting

### Deliverables
- goals
- review cycles
- training/certification tracking
- saved and scheduled reports
- executive analytics

### Task 14: Performance and Development

- [ ] Implement goals, reviews, feedback, training records, and certification tracking.

### Task 15: Reports and Dashboards

- [ ] Implement report registry, saved views, scheduling, and export flows.
- [ ] Expand widgets for finance, HR, payroll, and operations.

## Phase 6: Commercialization Readiness

### Deliverables
- tenant boundary support
- configurable branding and settings
- advisor access
- module licensing readiness

### Task 16: Tenant-Ready Hardening

- [ ] Add tenant identifiers consistently across core models.
- [ ] Review data separation, configuration boundaries, and branding surfaces.

## Cross-Cutting Rules

- Every phase must ship with tests for the domain logic it introduces.
- Every significant workflow mutation must emit an audit event.
- Every queue page must support search, filtering, and bookmarks.
- Every dashboard widget must have loading, error, and empty states.
- Every important page must be searchable through global search.
- Posted accounting and finalized payroll data must never be silently mutated.

## Verification Checklist Per Phase

- [ ] Type checking passes
- [ ] Unit tests pass
- [ ] Integration tests for new workflows pass
- [ ] Role visibility is verified
- [ ] Audit events are emitted
- [ ] Search indexing works for new records
- [ ] Dashboard widgets and favorite actions link correctly
- [ ] Empty states and loading states exist

## Suggested First Execution Order

1. Phase 0 research gate
2. Phase 1 foundation
3. Phase 2 people/time/payroll
4. Phase 3 finance core
5. Phase 4 hiring/onboarding/leave
6. Phase 5 performance/reporting
7. Phase 6 commercialization readiness

## Git and Delivery Rhythm

- Use one branch per phase or major workstream.
- Keep commits small and reviewable.
- Require a written checkpoint summary after each major phase.
- Require a fresh research check if regulations, tax handling, or accounting assumptions change.

## Execution Handoff

Plan complete and saved to `kleentoditee-payroll-pro/docs/superpowers/plans/2026-04-20-kleentoditee-platform-master-plan.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - execute tasks in one session using an execution skill, with checkpoints

Before either option, complete the Claude research review defined in Task 0.
