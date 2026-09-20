# KleenToDiTee Consolidated Shipping Conclusion

**Date:** 2026-09-19  
**Compared reviews:** Kimi K3 Batch 9 self-audit and GPT independent deep audit  
**Decision:** Build toward two controlled releases: (1) a single-company KleenToDiTee internal payroll pilot, then (2) a multi-subscriber BVI SaaS release. Do not call the current build production-ready.

## Where Both Reviews Agree

Both reviews independently found the same core facts:

- Builds, typechecks, lint, and 111 API tests pass.
- The current product state is concentrated in a very large dirty worktree rather than durable commits.
- The named finance, integration, and tracker lane commits are already absorbed; the separate cookie-auth branch still needs a deliberate diff.
- Multi-tenancy has not been implemented.
- The GL is only its first slice: no fiscal periods, bank reconciliation, full statements, or year-end close.
- Deposit posting is missing.
- WhatsApp has no recipient number; email is invitation/reset only.
- Production object storage is not implemented.
- There are no browser end-to-end, cross-tenant, or complete visual/device release tests.
- The app is not ready for external subscribers or professional year-end financial statements.

## Where the Reviews Differ

| Question | Kimi conclusion | GPT conclusion | Consolidated decision |
|---|---|---|---|
| Are Batches 1-8 complete? | Mostly VERIFIED because code exists and unit checks pass. | Several are PARTIAL because production migrations or full workflows are absent. | **Use GPT's stricter status.** Code without a deployable migration is not complete. |
| Highest immediate risk | Uncommitted work. | Missing migrations, uncommitted work, and no tenant isolation. | **All three are release blockers.** Preserve the work and build deployable migrations in the same first batch. |
| Is NHI ceiling 106,800 wrong? | Flagged as a mismatch using an older secondary SSA summary. | Confirmed by the official 2026 NHI bulletin. | **The seed's 106,800 NHI ceiling is correct for 2026.** Store the official source and approval. |
| Is SSB ceiling 53,400 correct? | Flagged against an older secondary estimate. | Could not confirm it from a current official BVI source. | **UNVERIFIED.** Neither older comparison number is authority. Obtain current BVI SSB confirmation before live payroll. |
| Is BVI payroll already better than competitors? | Yes, because competitors do not offer BVI payroll. | It has a potential advantage, but correctness and deployment are not proven. | **Potentially differentiated, not yet proven.** Do not market “correct BVI payroll” until statutory and parallel-run gates pass. |
| When should multi-tenancy be built? | After baseline, timing dependent; possibly after more GL work. | Immediately after baseline. | **Before adding more accounting tables.** Retrofitting tenant keys after statements, banking, and filing packages would multiply cost and security risk. |
| Can it ship now? | No external release. | No live multi-subscriber or payroll-authority release. | **No. Internal pilot only after Release Gate A below.** |

## Corrected Statutory Position

1. **NHI:** 3.75% employee + 3.75% employer and annual maximum insurable earnings of 106,800 are supported by the official 2026 NHI bulletin.
2. **SSB rates:** 4% employee + 4.5% employer are supported by the official SSB remittance form.
3. **SSB ceiling:** 53,400 remains unapproved until confirmed by a current official SSB source or written response.
4. **Payroll tax:** the app models the 8% employee share, 10,000 annual exemption, and Class 1/Class 2 structure, but the employer class is still `NOT_SET`. It must be a required owner-approved setting.
5. **No PAYE income tax:** the live BVI system must not expose or calculate a separate income tax. Legacy `incomeTax` schema/report/import/GL concepts must be removed from BVI behavior or isolated behind a future jurisdiction module.
6. **Leave and minimum wage:** current sick/annual leave seeds and minimum-wage validation require confirmation against current official BVI law before being advertised as compliant.

Official NHI source: https://www.vinhi.vg/wp-content/uploads/2025/09/NHI-Maximum-Insurable-Earnings-2026.pdf  
Official SSB rates source: https://bvissb.vg/PDF_files/Contribution_FORM2.pdf

## Product Scope Required to Ship

The v1 promise should be narrow and defensible:

> BVI-focused employee records, multi-location time, leave, payroll, paystubs, statutory calculation and forms, basic invoicing/accounting, and management financial statements for small service businesses.

Do not delay v1 to imitate every QuickBooks, Gusto, or BambooHR feature. Native mobile apps, recruiting, advanced performance management, benefits administration, and hundreds of integrations are later products. The release must instead be excellent at BVI payroll correctness, data isolation, accounting integrity, backups, and everyday phone workflows.

## Ordered Completion Batches

### Batch 9: Preserve and Reproduce the Existing Build

**Work**

- Classify all current modified/untracked files and exclude secrets, uploads, generated output, backups, and temporary files.
- Diff `frontend/auth-client-cookie-ready`; salvage only unique required behavior.
- Add reviewed additive migrations for `StatutoryRateVersion`, `AuthRateLimit`, `PayrollYtdOpeningBalance`, leave fields/models, and journal models.
- Commit the current features in coherent groups rather than one catch-all commit.
- Repair the one-command launcher so database, API, admin, and tracker start with readiness checks.

**Gate**

- Clean checkout installs and builds.
- Empty database migration and existing-data upgrade both pass.
- All tests/typecheck/lint pass.
- API `/health/ready`, admin login, tracker login, one save, and one download work after a cold start.
- Worktree is clean and commits are pushed/backed up.

### Batch 10: BVI Payroll Truth and Parallel-Run Safety

**Work**

- Make effective-dated, verified statutory versions drive payroll calculations.
- Store source URL, effective date, verification date, verifier, and owner approver.
- Require Payroll Tax Class 1 for KleenToDiTee after owner confirmation; do not silently default other subscribers.
- Confirm current SSB ceiling directly; add schedule-specific cap tests.
- Remove/contain legacy BVI income-tax behavior and rename misleading templates.
- Verify sick/annual leave rules and minimum wage from official sources; add warnings/validation.
- Add payroll net-pay and statutory-remittance journals, not only payroll accrual.
- Run realistic parallel payroll comparisons for monthly, weekly, biweekly, cap-boundary, leave, and YTD cases.

**Gate A: Internal KleenToDiTee Pilot**

- Every comparison agrees to independently calculated payroll within documented rounding rules.
- Owner signs off statutory settings and forms.
- Backup and restore drill succeeds.
- No unresolved severity-1 or payroll-correctness defect remains.
- Live payroll still begins as a monitored parallel run, not an immediate sole source of truth.

### Batch 11: Multi-Tenant Security Foundation

**Work**

- Add `Organization` and `OrganizationMembership`.
- Backfill all existing data to the KleenToDiTee organization without loss.
- Tenant-scope settings, users/memberships, employees, time, leave, payroll, documents, audit, finance, journals, imports, notifications, exports, and future storage keys.
- Make unique numbers/codes/source keys organization-aware.
- Add explicit, audited platform-support access.

**Gate**

- Two test organizations cannot view, guess, search, download, update, export, or delete each other's records.
- No API accepts a tenant ID without validating membership.
- Every sensitive route has positive and negative authorization tests.

### Batch 12: Accounting Integrity and Period Control

**Work**

- Convert monetary persistence/calculation boundaries to decimal-safe handling.
- Add fiscal years and open/soft-close/locked periods.
- Add controlled opening balances and conversion audit.
- Add manual journal draft/approve/post/reverse with evidence attachments.
- Post deposits through undeposited funds and add missing credits/refunds/transfers/owner/loan events required for normal small-business books.

**Gate**

- Every source event posts once in the same transaction.
- Reversals restore balances; locked periods reject changes.
- Trial balance remains balanced for every organization and period.
- AR, AP, payroll liabilities, and bank controls reconcile to their subledgers.

### Batch 13: Banking and Reconciliation

**Work**

- Import bank statements with duplicate detection.
- Match payments, deposits, expenses, transfers, payroll, and journals.
- Add reconciliation sessions with opening/ending balances, difference, complete lock, controlled undo, outstanding items, and audit history.

**Gate**

- Reconciled ending balance agrees with the statement and ledger.
- Duplicate imports cannot duplicate accounting entries.
- Completed reconciliations are protected and reproducible.

### Batch 14: Financial Statements and BVI Filing Support

**Work**

- Build ledger-derived P&L, balance sheet, cash flow, changes in equity, AR/AP aging, payroll liabilities, and location/job profitability.
- Add prior-period/YTD comparisons, drill-down, PDF/CSV/XLSX, and locked reproducible snapshots.
- Add year-end adjustments, retained-earnings close, review/approval, signature, and revision history.
- Map the official BVI Business Companies annual-return categories and provide separate Inland Revenue/registered-agent filing-support workflows.

**Gate**

- Assets equal liabilities plus equity.
- Net income agrees across P&L, equity movement, and close.
- Ending cash agrees across cash flow, balance sheet, and reconciled bank registers.
- Final exports agree exactly with the locked report snapshot.
- Filing instructions are applicability-aware and do not claim electronic submission where none exists.

### Batch 15: Production Delivery and Communication

**Work**

- Implement private S3/R2 storage with scoped keys and signed access.
- Add transactional email queue, templates, retry, logs, provider validation, and failure monitoring.
- Fix direct employee WhatsApp links using normalized `wa.me/<number>`; provider sending remains optional until credentials/consent/webhooks exist.
- Add Playwright role workflows and desktop/tablet/phone visual checks.
- Complete monitoring, scheduled backups, restore proof, staging, incident procedures, and security review.

**Gate B: Subscriber SaaS Release**

- Tenant isolation tests, financial invariants, browser workflows, device checks, dependency/security review, backups/restores, and staging acceptance all pass.
- A pilot subscriber completes setup, employee/time/payroll workflows, bank reconciliation, and year-end report preview without developer intervention.
- Release is approved only after defects from the pilot are resolved.

## Final Conclusion

The fastest responsible route is **not** to keep repairing random tabs one at a time. Finish vertical workflows in dependency order:

1. Preserve and migrate what already exists.
2. Prove BVI payroll correctness for KleenToDiTee.
3. Add tenant isolation before expanding the data model further.
4. Complete accounting, banking, and financial statements.
5. Harden storage, communication, testing, and operations.

This creates a realistic internal pilot after Batch 10 and a subscriber-ready release after Batch 15. Shipping earlier would either risk payroll correctness or expose one subscriber's data to another. Shipping later to chase every competitor feature would waste time. The release line is correctness, isolation, recoverability, and complete core workflows.
