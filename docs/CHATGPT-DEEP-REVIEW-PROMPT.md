# Deep Review & Gap Analysis Prompt for ChatGPT

> Paste everything below the line into ChatGPT (preferably a model with deep research / code-reading capability, run against the repo or with the repo attached).

---

## ROLE

You are a principal-level software auditor and HRM/payroll product analyst. Your job is a **brutally honest deep review** of an in-development Payroll & HRM web application. Do not flatter. Do not assume anything works because a document says it does. Verify every claim against actual code, and mark every claim you could not verify as **UNVERIFIED** with the reason.

## THE PRODUCT

**KleenToDiTee Payroll HRM** — a multi-tenant payroll, HR, and accounting system being built for a cleaning-services company in the **British Virgin Islands (BVI)**. BVI jurisdiction facts that must frame every compliance judgment you make:

- Payroll statutory deductions are **NHI (National Health Insurance)**, **Social Security (SSB)**, and **BVI payroll tax** — there is **no PAYE income tax**.
- Employers must produce year-end filing support for **Inland Revenue** and the **BVI Business Companies Financial Return (per the Business Companies Financial Return Order 2023)**, typically filed via a **registered agent**.
- The product must support **multiple subscriber companies (multi-tenancy)** with strict data isolation, so it can be sold to other BVI businesses.

## THE REPOSITORY

Root: `C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0` (Windows, Git Bash available).

npm workspaces monorepo:

- `apps/admin-web` — Next.js admin dashboard (port 3000)
- `apps/employee-tracker` — Next.js employee self-service/tracker app (port 3001)
- `apps/api` — Hono API server (port 8787)
- `packages/db` — Prisma 7.10.0 + `@prisma/adapter-pg` against PostgreSQL

## READ THESE FIRST (in this order)

1. `AGENTS.md` — multi-agent working rules, lanes, shared-file locks
2. `TASKS.md` — the authoritative batch-by-batch record of what was implemented (Batches 1–8, 2026-09-18/19) and the open-items list
3. `HANDOFF.md` — verification procedures
4. `README.md`
5. `docs/DEEP-RESEARCH-2026-09-18.md` — the research baseline (R1–R13) the batches were planned from
6. `docs/KIMI-K3-COMPLETE-APP-IMPLEMENTATION-PROMPT.md` — the **requirements baseline** (the master build spec); measure the app against this
7. `docs/current-system-inventory.md` and other docs under `docs/` as needed
8. `packages/db/prisma/schema.prisma` and `schema*.prisma` — the real data model

## STEP 1 — VERIFY THE BUILD AND MERGE STATE (do this before anything else)

Run and report the actual results of:

```bash
git status --porcelain
git branch -a
git log --oneline -20
git worktree list
```

- Confirm which branch is checked out in the main repo (expected: `cleanup/project-workflow-audit` or the integration branch `codex/consolidate-live-build`).
- Identify all worktrees (expected lanes: `codex-integration-qa`, `claude-finance-core`, `cursor-employee-tracker`) and check whether their work is merged into the integration branch or still stranded on lane branches. List anything unmerged.
- List all uncommitted/untracked changes in every worktree and judge whether any of it is orphaned WIP that was never integrated.
- Then run, from the repo root, and report pass/fail with real output summaries:
  - `npm run build` (full workspace)
  - `npm run typecheck` (or per-workspace tsc if no root script)
  - `npm run test:api` (API unit tests — last recorded state: 111/111 PASS)
  - `npm run lint`
  - `npm audit` (last recorded state: 4 high-severity findings, all reachable only through the dev-CLI Prisma chain; confirm or update)
- Note: Prisma commands hit EPERM on Windows while the API server is running — that is a known local quirk, not a defect. `seed.ts` WIPES tables — do not run it against any database with real data.

## STEP 2 — VERIFY THE IMPLEMENTATION CLAIMS

`TASKS.md` claims the following were completed between 2026-09-18 and 2026-09-19. For each item, find the actual code and confirm it exists and is wired end-to-end (schema → API route → UI), or flag it as missing/partial:

1. **Batch 1** — Navigation fixes; `StatutoryRateVersion` model for versioned statutory rates.
2. **Batch 2** — HttpOnly cookie auth: `kt_session` HttpOnly cookie + readable `kt_csrf` double-submit token; CSRF header `x-kt-csrf` enforced on all mutating API requests. Check the follow-up fix in Batch 5: `hasSessionCookie()` in `apps/*/src/lib/auth-storage.ts` must check `kt_csrf` (not the HttpOnly cookie) or tracker login bounces.
3. **Batch 3** — Historical/YTD payroll opening-balance CSV import (`PayrollYtdOpeningBalance` model, `/dashboard/payroll/ytd-import`).
4. **Batch 4** — Payroll register, per-year summary (opening YTD + posted runs), and reconciliation report (`/dashboard/payroll/reports`).
5. **Batch 5 (R8)** — Leave/time-off: `UNPAID_LEAVE` type, `LeavePolicy` (ANNUAL 15d / SICK 10d / UNPAID untracked), leave-day accrual/usage logic (`apps/api/src/lib/leave-days.ts`, `leave.ts`), unpaid-leave pro-rata deduction inside the payroll run builder, routes in `staff-requests.ts`, admin page `/dashboard/people/leave`, tracker balances card.
6. **Batch 6 (R12)** — npm audit triage (3 highs at the time, all dev-CLI Prisma chain; an npm-override fix was attempted, failed due to an npm 11 resolver bug, and was cleanly reverted — confirm `package.json`/`package-lock.json` carry no leftover override).
7. **Batch 7 (R12b)** — Prisma 6.19.3 → 7.10.0 upgrade with `@prisma/adapter-pg`: `datasource.url` removed from schemas, `packages/db/prisma.config.ts` added, lazy Proxy Prisma singleton in `packages/db/src/index.ts` (the proxy must NOT be cached on `globalThis` — that was a real bug), `--skip-generate` flags removed.
8. **Batch 8 (R7 slice 1)** — Double-entry general ledger: `JournalEntry`/`JournalLine` (Decimal(14,2), unique `sourceKey` idempotency, reversal-only corrections); posting engine (`gl-posting.ts`) and reports (`gl-reports.ts`); postings wired **in the same DB transaction** into invoice send/void, payment create/delete, bill receive/void, bill-payment create/delete, expense post/void, payroll finalize/void; 9 auto-provisioned control accounts (2100–2700, 6100, 6200); endpoints `/finance/reports/trial-balance|journal|ledger/:accountId`; admin finance tabs "Journal" and "Trial balance" labeled "management-prepared, unaudited".

For each: state VERIFIED / PARTIAL / MISSING / UNVERIFIED with file paths as evidence.

## STEP 3 — MEASURE AGAINST THE REQUIREMENTS BASELINE (K3 spec)

Read `docs/KIMI-K3-COMPLETE-APP-IMPLEMENTATION-PROMPT.md` and check every requirement. Pay special attention to these, which are believed open or only partially done — confirm the real state and list exactly what is missing for each:

- Multi-tenancy / subscriber company isolation — is tenant scoping enforced at the query level everywhere, or only by convention?
- Full accounting scope beyond Batch 8's GL core: fiscal periods with open/locked states, manual journals with approval workflow, opening balances/conversion, AR/AP aging off journal lines, deposit posting (undeposited funds), P&L / balance sheet / cash-flow statements, CSV/PDF export, year-end closing to retained earnings.
- Banking and bank reconciliation.
- Year-end financial statement package + BVI filing support (Business Companies Financial Return Order 2023, Inland Revenue, registered-agent workflow).
- WhatsApp click-to-chat fix + provider mode.
- Full transactional email service.
- Document storage hosting (R6).
- Scheduling/rostering (R10), ops features (R11).
- Release gates: e2e and visual tests (R13).
- Statutory correctness for BVI: NHI, SSB, BVI payroll tax rates and caps — check `StatutoryRateVersion` seed values against real current BVI rates and flag anything that looks wrong or hardcoded without versioning.

## STEP 4 — COMPETITIVE GAP ANALYSIS (weighted for BVI)

Compare this product feature-by-feature against **QuickBooks Online (+Payroll), Xero, Gusto, BambooHR, and Wave**. Build a feature matrix with columns: Feature | This app (state) | QBO | Xero | Gusto | BambooHR | Wave | Gap severity for a BVI small-business customer.

Cover at minimum: payroll runs + statutory filings, GL/double-entry accounting, invoicing/billing, banking/reconciliation, employee self-service, time tracking, leave management, scheduling, HR records/documents, onboarding, performance, reports, multi-currency, multi-tenancy, mobile, integrations, audit trail, role-based access.

Then adjust every judgment for BVI reality: Gusto is US-only; QBO/Xero payroll is not BVI-configured out of the box; a BVI customer cares about NHI/SSB/payroll-tax correctness and the annual financial return, not US-style W-2/941 workflows. Say plainly where this product is genuinely ahead for BVI and where it is genuinely behind regardless of jurisdiction.

## STEP 5 — HONESTY RULES (non-negotiable)

- No flattery, no padding, no "great progress" filler.
- Distinguish "code exists" from "code is verified working". Anything you could not run or read is UNVERIFIED — say so and say why.
- Flag silent risks: uncommitted WIP that batches depend on, features wired only on the happy path, missing DB transactions, tenant-isolation gaps, hardcoded rates, missing authorization checks on routes, dead UI pages, TODOs in code.
- Rank every gap by severity: (1) data loss / security, (2) payroll or accounting correctness, (3) blocked workflows, (4) compliance/filing exposure, (5) UX/polish.
- If a document contradicts the code, the code wins — say which document is stale.

## REQUIRED OUTPUT FORMAT

1. **Build & merge health** — commands run, real results, branch/worktree/merge state, anything unmerged or uncommitted that matters.
2. **Implementation verification table** — Batches 1–8, each item VERIFIED / PARTIAL / MISSING / UNVERIFIED with evidence paths.
3. **Requirements completion matrix** — every K3 requirement with status and what exactly remains.
4. **Competitor feature matrix** — as specified in Step 4.
5. **Prioritized gap list** — severity-ranked, each with: what's missing, why it matters for a BVI customer, and the concrete next slice of work.
6. **Recommended next 3 batches** — ordered, scoped small enough to complete and verify each in one working session, consistent with the batch pattern used so far.

Ignore nothing. If something looks embarrassing, say it plainly.
