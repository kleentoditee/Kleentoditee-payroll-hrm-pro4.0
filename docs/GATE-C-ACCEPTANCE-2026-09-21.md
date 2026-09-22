# Gate C Acceptance Record — QuickBooks Internal Cutover Rehearsal

Date: 2026-09-21
Branch: `cleanup/project-workflow-audit`
Gate evidence: `tmp/gate-c-verify.mjs` (live, two orgs) — **32/32 PASS**, zero residue
Plan reference: `docs/FINAL-SHIPPING-PLAN-CELERY-QBO-2026-09-20.md` §Gate C

> **Scope of this record.** This is the **rehearsal** of the QuickBooks internal
> cutover, executed end-to-end on the synthetic 18-member rehearsal package in a
> throwaway org, exactly as the real cutover will run. The **real** cutover
> repeats these same steps with the owner's actual QuickBooks export and
> requires the human signatures at the bottom of this document.

---

## 1. Cutover freeze + final export (hash manifest)

The frozen export package is the Batch 18 rehearsal package — a realistic
QuickBooks-style ZIP export with 18 members (13 importable CSVs, archived
history, an unsupported type, and one binary attachment).

| Artifact | SHA-256 | Size |
|---|---|---|
| Rehearsal export ZIP (`tmp/b18-rehearsal.zip`) | `eeadf24e15e3e3feb818f6bab601d72a11c0ed97f44b53237d3d8d2a805dd5d1` | 3,474 bytes |

- Manifest `tmp/b18-manifest.json` covers **all 18 ZIP members**; every member
  SHA-256 was re-verified against the manifest at rehearsal time (18/18 match).
- Gate checks: *final export frozen*, *manifest covers every ZIP member*,
  *every member sha256 matches the manifest* — all PASS.

## 2. Backup + restore evidence (clean environment)

| Artifact | SHA-256 | Size |
|---|---|---|
| `deployment-backups/20260921-214418/kleentoditee-postgres.dump` | `8ae148f7131e8d980c6eff545d965c255f6348fca8601dc8e4d1f7acf3610eb7` | 329,646 bytes |
| `deployment-backups/20260921-214418/employee-files.zip` | `922a9b9fca6d02552a49ab7ad503da39e1664850c6287b4fa7773068e5f6a3d9` | 777,722 bytes |

- Fresh backup taken immediately before the rehearsal
  (`scripts/export-production-data.ps1`, 2026-09-21 21:44:19 -04:00).
- **Restore drill PASSED** (`scripts/restore-drill.ps1` into a scratch
  database): "Restored row counts — Users: 2, Employees: 7, Journal entries: 0,
  Organizations: 1. RESTORE DRILL PASSED: backup 20260921-214418 restores and
  contains live data."
- The rehearsal import itself ran in a **clean org C** (`gate_c_org`),
  the restore-target environment; org C was destroyed after sign-off with
  verified zero residue (database rows + 10/10 storage objects removed).

## 3. Import + reconciliation results

Cutover flow executed exactly as designed: create batch
(`migrationMode: "cutover"`) → upload ZIP → validate → approve → commit →
status **reconciled**.

| Control | Expected | Actual | Status |
|---|---|---|---|
| AR balance (open receivables) | 285.00 | 285.00 | matched |
| AP balance (open payables) | 150.00 | 150.00 | matched |
| Trial balance (debits = credits) | 435.00 | 435.00 | balanced |
| Migration reconciliation checks | — | 13/13 | all matched |
| Open documents (AR / AP) | 285 / 150 | 285 / 150 | agree |

File dispositions recorded on the batch (audit trail):

| File | Disposition |
|---|---|
| accounts, customers, vendors, products, invoices, bills | imported |
| payments.csv, journal_entries.csv | **archived** (cutover-excluded; history represented by opening balances — never posted) |
| estimates.csv, classes.csv | archived (non-posting / pending cost-centre masters) |

- Archived payment history verified never posted: `Payment` rows created = **0**.
- **Code fix landed during this gate:** commit previously re-stamped
  cutover-excluded files `"imported"` at commit time (type-level disposition
  ignored the batch mode), falsifying the audit trail even though nothing was
  posted. `migration-import.ts` now preserves the inventory-time terminal
  disposition; only genuinely pending files are stamped `"imported"`.
  Unit tests 14/14 PASS after the fix.

## 4. Parallel payroll compare (rehearsal payroll in clean org)

Two rehearsal employees, monthly schedule, 2026-09 period, BVI statutory
config (SSB 4 %/4.5 % ceiling 53,400; NHI 3.75 %/3.75 % ceiling 106,800;
payroll tax 8 % over 10,000 annual exemption, employer Class 1; no income tax).

| Employee | Basis | NHI | SSB | Payroll tax | Net |
|---|---|---|---|---|---|
| Emp 1 | fixed 1,800/mo | engine = reference | engine = reference | engine = reference | engine = reference |
| Emp 2 | fixed 10,000/mo (crosses ceilings) | engine = reference | engine = reference | engine = reference | engine = reference |

Employee-level statutory totals: **2/2 match** between engine and independent
reference computation.

Run totals (engine == reference, exactly):

| Measure | Amount |
|---|---|
| Employee NHI | 401.25 |
| Employee SSB | 250.00 |
| Employee payroll tax | 0.00 |
| Employer NHI | 401.25 |
| Employer SSB | 281.25 |
| Employer payroll tax | 0.00 |
| Net pay | 11,148.75 |

- Income tax zero everywhere (BVI has no income tax) — PASS.

## 5. Exception report + sign-off

- Exception report downloaded from the committed batch (810 bytes) — lists
  every non-imported file with reason + SHA-256 and reconciliation status.
- Typed sign-off recorded and persisted on the batch:
  **"Gate C Rehearsal Owner"** (audit-logged; only accepted after commit).
- Source org A (`org_kleentoditee`) verified untouched: 7 employees, no gate
  artifacts.

---

## 6. What remains for the REAL cutover (not done by this rehearsal)

1. Run the same steps with the owner's **actual QuickBooks export** (frozen,
   hashed, manifest-verified as in §1).
2. **Human signatures below** — the plan requires physical/typed sign-off by
   the Owner and the Accounting Reviewer; this rehearsal only proves the
   machinery records and enforces the sign-off step.
3. Keep QuickBooks **read-only for one month-end cycle** after cutover and
   reconcile the first live month-end against it before decommissioning.
4. Fresh production backup + restore drill on the day of the real cutover
   (repeat §2).

## Sign-off

| Role | Name | Signature | Date |
|---|---|---|---|
| Owner | ______________________ | ______________________ | ________ |
| Accounting Reviewer | ______________________ | ______________________ | ________ |

*Rehearsal executed and evidence collected by the Kimi lane on 2026-09-21;
gate script output 32/32 PASS retained in session logs.*
