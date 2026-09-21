# KleenToDiTee Master Shipping Plan — 2026-09-19

**Status: ACTIVE PLAN.** This document supersedes the batch lists in `docs/DEEP-RESEARCH-2026-09-18.md`, the batch suggestions in the K3 prompt, and the per-review batch proposals. It merges:
- the K3 requirements baseline (`docs/KIMI-K3-COMPLETE-APP-IMPLEMENTATION-PROMPT.md`),
- the Kimi deep review (`docs/DEEP-REVIEW-2026-09-19.md`),
- the GPT independent audit and the reconciliation (`docs/DEEP-REVIEW-RECONCILIATION-2026-09-19.md`),
- the GPT consolidated shipping conclusion (owner-provided, 2026-09-19),
- **owner directive 2026-09-19: SSB ceiling verification is NOT required — the configured value is accepted. Remove it from all gates.**

**2026-09-20 extension:** `docs/FINAL-SHIPPING-PLAN-CELERY-QBO-2026-09-20.md` adds the controlled QuickBooks file-migration gates and the accepted Celery HR recommendations. Batch 16 remains active; the extension defines Batches 17-20 and Gates C-D.

Batch numbers continue the TASKS.md history (Batches 1–9 complete; next is **Batch 10**). GPT's "Batch 9–15" map to Batches 10–16 below.

---

## 1. Release strategy

Two controlled releases, no earlier claims:

- **Release A — Internal pilot:** KleenToDiTee runs its own payroll/HR/accounting on the app, monitored, after **Gate A** (end of Batch 11). Live payroll begins as a parallel run against independently calculated results, not as sole source of truth.
- **Release B — Subscriber SaaS:** other BVI businesses onboard after **Gate B** (end of Batch 16) and a successful pilot subscriber run.

**v1 promise (narrow and defensible):** BVI-focused employee records, multi-location time, leave, payroll, paystubs, statutory calculation and forms, invoicing/accounting, and management financial statements for small service businesses. Explicitly NOT v1: native mobile apps, recruiting, performance management, benefits administration, large integration ecosystems, subscription billing.

## 2. Corrected statutory position (settled — do not re-litigate)

| Item | Position | Source / decision |
|---|---|---|
| NHI 3.75% + 3.75%, ceiling $106,800/yr | **CONFIRMED correct for 2026** | Official NHI 2026 bulletin (vinhi.vg) |
| SSB 4% employee + 4.5% employer | **CONFIRMED** | Official SSB remittance form (bvissb.vg) |
| SSB ceiling $53,400 | **ACCEPTED AS CONFIGURED — owner decision 2026-09-19.** No further verification work; not a release gate. Record the decision in the rate row's approver field during Batch 11. | Owner directive |
| Payroll tax 8% employee, $10,000 exemption, Class 1/2 employer | Structure confirmed; **employer class is a required, owner-approved setting (KleenToDiTee = Class 1)** | BVI payroll tax guide |
| Income tax | **Zero in BVI.** All legacy `incomeTax` behavior/templates/GL account 2400/report labels removed or isolated in Batch 11 | K3 + both audits |
| BZD hardcodes, Belize residue | Removed in Batch 11; org-configured currency, default USD | Both audits |
| Leave minimums + minimum wage ($7.25/hr) | Validate against Labour Code in Batch 11; add minimum-wage warning | Kimi audit |

Standing K3 rules that apply to every batch: no placeholders/dead controls in production nav; management-prepared/unaudited labeling on all generated statements; reversal-only corrections for posted records; never commit secrets/env/uploads/build output; coherent commits; nothing is "compliant" or "ready to file" until owner-approved.

## 3. The one plan — Batches 10–16

### Batch 10 — Preserve and reproduce the existing build
*Work:* classify all 214 dirty paths (exclude secrets/uploads/artifacts); diff `frontend/auth-client-cookie-ready` and salvage anything unique; write reviewed **additive migrations** for StatutoryRateVersion, AuthRateLimit, PayrollYtdOpeningBalance, leave models/fields, JournalEntry/JournalLine; commit current work in the K3 coherent sequence; repair the one-command launcher with readiness checks; **fix the auth deployment contract: CORS `allowHeaders` + `credentials` for `x-kt-csrf`, and an explicit decision on the bearer-token fallback.**
*Gate:* clean checkout installs/builds; empty-DB migrate AND existing-data upgrade both pass; tests/typecheck/lint pass; cold-start login + one save + one download on both apps; worktree clean, pushed.

### Batch 11 — BVI payroll truth and jurisdiction cleanup → **GATE A: internal pilot**
*Work:* effective-dated verified statutory versions drive payroll (frozen per run, with source/verifier/approver); employer payroll-tax class as required owner-approved setting (KleenToDiTee = Class 1); record owner acceptance of SSB ceiling in the rate row; remove/isolate legacy income-tax concepts (templates, GL 2400, reports, imports, paystubs); BZD → USD/org currency; validate leave seeds + add minimum-wage validation; add payroll net-pay and statutory-remittance journals; parallel-run comparisons across monthly/weekly/biweekly/cap-boundary/leave/YTD cases.
*Gate A:* every parallel comparison agrees within documented rounding; owner signs statutory settings and forms; backup/restore drill succeeds; no severity-1 or payroll-correctness defect open.

### Batch 12 — Multi-tenant security foundation
*Work:* `Organization` + `OrganizationMembership`; lossless backfill of all existing data to the KleenToDiTee org; tenant scoping on settings, users, employees, time, leave, payroll, documents, audit, finance, journals, imports, notifications, exports, storage keys; org-aware unique constraints (incl. GL `sourceKey`, account codes, document numbers); explicit audited platform-support access.
*Gate:* two test orgs cannot view/guess/search/download/update/export/delete each other's data (automated adversarial tests); no route trusts a client-supplied tenant ID without membership validation; all existing workflows still pass.

### Batch 13 — Accounting integrity and period control
*Work:* Float→decimal-safe money at calculation/persistence boundaries; fiscal years + open/soft-close/locked periods; controlled opening balances/conversion; manual journals draft/approve/post/reverse with attachments; deposits via undeposited funds; remaining posting events (credits/refunds, transfers, owner contribution/draw, assets, loans, bad debt).
*Gate:* every event posts exactly once in one transaction; reversals restore balances; locked periods reject edits; trial balance balances per org per period; AR/AP/payroll/bank controls reconcile to subledgers.

### Batch 14 — Banking and reconciliation
*Work:* statement import with duplicate detection; matching to payments/deposits/expenses/transfers/payroll/journals; reconciliation sessions (opening/ending/difference/complete-lock/controlled undo); outstanding items; bank-register running balance; audit history.
*Gate:* reconciled ending balance agrees with statement and ledger; duplicate imports cannot duplicate entries; completed reconciliations are protected and reproducible.

### Batch 15 — Financial statements and BVI filing support
*Work:* ledger-derived P&L, balance sheet, cash flow, changes in equity, AR/AP aging, payroll-liability status, location/job profitability; comparatives, drill-down, PDF/CSV/XLSX, locked reproducible snapshots; year-end adjustments + retained-earnings close with review/approval/signature/revision history; Business Companies annual-return mapping (2023 Order categories) + separate Inland Revenue / registered-agent applicability workflows ("filing support" wording only).
*Gate:* A = L + E; net income agrees across P&L/equity/close; ending cash agrees across cash flow/BS/bank registers; exports match locked snapshots; filing flows are applicability-aware.

### Batch 16 — Production delivery and communication → **GATE B: subscriber release**
*Work:* private S3/R2 storage (scoped keys, signed access, validation); queued transactional email (templates, retry, logs, provider validation, monitoring); WhatsApp `wa.me/<number>` direct links (provider mode optional until credentials/consent/webhooks); Playwright role workflows + desktop/tablet/phone visual checks; monitoring, scheduled backups, restore proof, staging, incident procedure, security review.
*Gate B:* tenant isolation + financial invariants + browser/device checks + dependency audit + backup/restore + staging acceptance all pass; a pilot subscriber completes setup → employees → time → payroll → reconciliation → year-end preview without developer help; defects resolved before approval.

## 4. What was deliberately cut or deferred

- **SSB ceiling verification — REMOVED from all gates** (owner directive, 2026-09-19).
- Subscription billing — after Release B (K3: model plan/status cleanly, bill later).
- QBO synchronization — never (K3: Accounting Import is file-based only).
- Native mobile, recruiting, performance, benefits, app marketplace — post-v1 products.
- WhatsApp provider sending — optional until owner supplies credentials.

## 5. Operating rules while executing

- One lane at a time on shared files; record locks in `TASKS.md`.
- Every batch ends with: build + typecheck + test:api + lint green, browser proof of touched screens, cleanup of test data, `TASKS.md` entry, coherent commit.
- Never run `db:seed` against the live database (it wipes tables).
- If a batch's gate fails, the next batch does not start.
