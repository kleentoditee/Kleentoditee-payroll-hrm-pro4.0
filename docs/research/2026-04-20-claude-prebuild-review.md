# KleenToDiTee — Pre-Build Research Review

**Date:** 2026-04-20  
**Status:** Initial gate — sufficient to begin Phase 1 (platform shell + scaffolding). Payroll/tax rules require ongoing validation with a qualified advisor.

## Validated assumptions

- **Product split:** An admin console plus a separate employee time-tracking app matches how internal cleaning/staffing operations typically run (central payroll vs. field clocking).
- **UX reference:** QuickBooks-style shell (stable nav, search-first, widgets) is a reasonable pattern for a finance-adjacent workforce product.
- **Current prototype:** The legacy browser app correctly models month-scoped timesheets, deduction templates (NHI/SSB/income tax toggles), payroll preview, finalize/mark-paid, CSV, and JSON backup — useful as a **workflow reference**, not as production payroll authority.
- **Architecture:** Modular monolith + PostgreSQL + typed API aligns with the blueprint and keeps early delivery manageable.

## Risky assumptions

- **Statutory accuracy:** NHI/SSB/income tax rates and calculation bases in the prototype are illustrative. Real Belize (or other jurisdiction) rules may use caps, bands, exemptions, or employer vs. employee splits not modeled in v1.
- **“Approved snapshot” payroll:** Legal and audit expectations for payroll corrections, reversals, and year-end filings are not fully specified.
- **Finance module depth:** Full QBO-parity accounting is a multi-year product; first release must narrow to invoicing/banking scope the business actually uses.

## Missing compliance research (before production payroll/finance)

- Official social security and tax guidance for the operating country/region (employee vs. employer portions, reporting calendars).
- Data retention, payslip delivery, and consent for employee data.
- Bank file formats and approval workflows expected by the company’s bank.

## Recommended scope cuts (first release after Phase 1–2)

- **Defer:** Full ATS, performance management, inventory, multi-currency, and full tax filing automation.
- **Ship early:** People core, time approvals, payroll run with exports, audit log skeleton, immutable finalized run records.
- **Finance:** Chart of accounts + AR/AP light path only if operations confirm need in Phase 3; otherwise stub integrations.

## Technical risks

- **Search at scale:** Postgres full-text is fine initially; cross-entity search will need indexing discipline.
- **Offline/PWA:** Employee tracker will need explicit sync strategy once API exists (conflict resolution, queueing).
- **Multi-tenant:** Tenant identifiers should be added early in schema design even if only one tenant is active — retrofitting is costly.

## Architecture adjustments before heavy domain build

- Add **tenant_id** (nullable or default) to core tables in Phase 2 schema design.
- Define **audit_event** schema and middleware early (Phase 1) so new routes inherit it.
- Treat **legacy localStorage app** as reference only; production data lives in PostgreSQL with role-based access.

## Gate conclusion

Phase 1 implementation (monorepo, admin shell scaffold, API skeleton, employee app stub) may proceed. Phase 2 payroll calculations and exports must be reviewed by a human payroll/compliance owner before any live pay run.
