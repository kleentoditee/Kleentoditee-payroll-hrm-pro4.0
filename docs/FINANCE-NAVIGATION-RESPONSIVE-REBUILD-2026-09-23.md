# Finance Navigation and Responsive Rebuild

**Review date:** 2026-09-23  
**Repository:** `Kleentoditee-payroll-hrm-pro4.0`  
**Audience:** Kimi K3 or the next implementation agent  
**Status:** Finance/navigation implementation complete and locally release-gated; production deployment prerequisites remain external

## Purpose

Rebuild the application navigation and finance presentation into a professional, responsive business interface without deleting working features, routes, data, permissions, payroll behavior, or accounting behavior.

This document is both the review record and the implementation prompt. Read the referenced code before editing, preserve the existing business workflows, and update this document with completion evidence when the work is finished.

## Confirmed Review Findings

1. `apps/admin-web/src/app/dashboard/finance/layout.tsx` exposes 22 finance destinations as equal-level tabs. At tablet and desktop breakpoints they wrap into multiple rows and lose their relationship to one another.
2. All 22 destinations are real routes, but they are presented without a usable information hierarchy.
3. `/dashboard/finance` redirects directly to Chart of Accounts instead of providing a Finance overview.
4. The application shell repeats destinations through Primary, Pinned, Workspace, All Apps, hover previews, Create, and page-level finance tabs.
5. Workspace buttons open the All Apps launcher instead of navigating directly to the selected workspace.
6. The mobile finance selector is only used below 640px. Tablet widths receive the full 22-tab navigation while the desktop sidebar remains hidden until 1024px.
7. Accounts, suppliers, products, invoices, bills, payments, expenses, deposits, journals, and other finance lists do not consistently use server pagination.
8. Chart of Accounts renders all returned accounts down one page.
9. The Customers page downloads customers, invoices, and payments together, then limits only the displayed customer rows on the client.
10. Hover previews and deeply repeated launchers increase complexity without improving access on touch devices.

## Implemented Outcome

- The permanent sidebar now contains exactly seven workspace links: Home, People, Time, Payroll, Finance, Reports, and Admin. It no longer repeats workspace destinations.
- All detailed destinations remain available through workspace-local navigation and the searchable All Apps launcher.
- Finance now has a real overview and six primary sections. At widths below 1280px, the section and page controls become two compact selectors instead of wrapped tab rows.
- All existing finance URLs remain in place. The automated responsive suite visits every one of the 22 mapped finance destinations at 390px, 768px, 1024px, and 1440px.
- Growing finance lists use backward-compatible server pagination with 25, 50, and 100 row options. Search, page size, sorting, and filters are represented in the URL where applicable.
- Wide financial grids scroll only inside bounded regions; phone layouts use record summaries where tables would be unreadable.
- Bank statement lines and the bank register now use real server paging. Register opening, closing, and running balances retain full-range meaning across pages.

## Existing Finance Route Map

The existing routes must be retained and grouped as follows.

| New section | Existing destinations |
| --- | --- |
| Overview | New `/dashboard/finance` overview |
| Sales | Customers, Products & services, Invoices, Payments received |
| Purchases | Suppliers, Bills, Bill payments, Expenses |
| Banking | Deposits, Bank statements, Reconciliation, Bank register |
| Accounting | Chart of accounts, General journal, Manual journals, Fiscal periods |
| Reports & compliance | Financial statements, Trial balance, AR/AP aging, Year-end close, Filing support, Finance reports |

General Journal must remain the posted ledger view. Manual Journals must remain the create, approve, post, and reverse workflow. Their labels and descriptions must make this distinction clear.

## Implementation Prompt for Kimi K3

### Role

Act as the principal product designer and senior Next.js engineer responsible for rebuilding the KleenToDiTee Payroll HRM navigation and finance presentation into a professional, responsive business application.

Work in the current repository and active integration branch. Begin by confirming the branch, HEAD commit, clean or dirty working-tree state, and existing user changes. Never overwrite unrelated user work.

### Non-Negotiable Rules

- Do not delete any working page, route, API endpoint, database record, audit record, or permission.
- Do not alter payroll calculations, statutory calculations, journal posting rules, reconciliation rules, or year-end accounting behavior.
- Do not add QuickBooks OAuth or live synchronization. QuickBooks remains a file-import migration source only.
- Preserve all existing URLs and deep links. Add redirects only if a route genuinely must move.
- Move and reorganize features instead of hiding or removing them.
- Do not create placeholder pages, `Coming soon` items, AI notes, development summaries, or correction wording in the user interface.
- Preserve role-based access in both navigation visibility and API authorization.
- Use the existing visual system and dependencies unless a change is demonstrably necessary.
- Commit completed work only after the required checks pass.

### Global Navigation Rebuild

Replace the repeated permanent sidebar sections with one clear top-level hierarchy:

1. Home
2. People
3. Time
4. Payroll
5. Finance
6. Reports
7. Admin

Keep one Create control for frequent actions. Remove the permanent Pinned section. All Apps may remain as an optional compact launcher, but it must not repeat an entire second navigation system on screen.

Clicking People, Time, Payroll, Finance, Reports, or Admin must navigate to that workspace landing page. It must not merely open a hover preview or launcher.

On desktop, allow the active workspace to reveal its immediate section links using a restrained accordion, submenu, or local navigation. On tablet and phone, use a drawer with the same hierarchy. No destination may depend on hover.

Preserve active-route indication for list, new, edit, and detail URLs. Navigation must close after selection on touch devices and return keyboard focus correctly when dialogs or drawers close.

### Finance Information Architecture

Create a real `/dashboard/finance` overview instead of redirecting to Chart of Accounts. Use existing APIs where practical and show compact operational information such as:

- Accounts receivable
- Accounts payable
- Overdue invoices and bills
- Bank or cash balances
- Unreconciled bank activity
- Recent finance activity
- Shortcuts for invoice, expense, bill, payment, and deposit creation

Finance must expose no more than these six primary sections:

1. Overview
2. Sales
3. Purchases
4. Banking
5. Accounting
6. Reports & compliance

Place the existing destinations into the route map documented above. Secondary navigation must appear only inside its relevant finance section.

Desktop may use six compact section controls. Tablet and phone must use a compact section menu, selector, or accessible disclosure. Never render all 22 finance destinations across the page.

Add breadcrumbs to creation and detail pages, for example `Finance / Sales / Invoices / INV-1004`. Breadcrumbs must not replace a clear Back action where a workflow requires one.

### Page Length and Pagination

Add backward-compatible server pagination to finance list endpoints using `page`, `pageSize`, search, sorting, and existing filters. Return pagination metadata. Existing callers without pagination parameters must keep working until all callers are migrated.

Use a default page size of 25 with 25, 50, and 100 options. Provide Previous and Next controls, total result count, current range, loading state, empty state, and recoverable error state.

Apply real pagination where data can grow, including:

- Chart of accounts
- Customers
- Suppliers
- Products and services
- Invoices
- Payments received
- Bills
- Bill payments
- Expenses
- Deposits
- General journal and manual journals
- Bank statement lines
- Reconciliations

Change Chart of Accounts into a compact, searchable list with account-type and active-status filters. Account groups may use accessible accordions. Move Add Account into a modal, drawer, or dedicated creation action instead of keeping a large form permanently above the list.

Do not load every invoice and payment merely to calculate customer summary information. Add server-side aggregate or lightweight summary endpoints. Do not perform fake pagination by downloading every record and slicing it in the browser.

Preserve filters, sort, page, and search in the URL so browser Back, Forward, refresh, bookmarks, and shared links work correctly.

### Responsive Requirements

Verify the application at 390px, 768px, 1024px, and 1440px widths.

- No page-level horizontal overflow at 320px or wider.
- Interactive touch targets must be at least 44 by 44 pixels.
- Forms become one column on phones and use logical field grouping on larger screens.
- Large filter collections collapse into an accessible Filters control on small screens.
- Financial tables may scroll inside a bounded table region, but the entire page must not scroll sideways.
- Use record cards on phones where a wide table would be unreadable.
- Keep primary actions visible without covering content or forcing excessive empty space.
- Long navigation and record labels must wrap or truncate deliberately.
- Do not place cards inside cards or turn every page section into a floating panel.
- Preserve keyboard navigation, visible focus, form labels, error association, and screen-reader names.
- Do not rely on hover for discovery or operation.

### Code Structure and Performance

Split the oversized `apps/admin-web/src/components/app-shell.tsx` into focused navigation components while preserving behavior outside this assignment. Keep navigation definitions centralized so desktop navigation, the mobile drawer, and optional All Apps launcher consume the same source.

Lazy-load optional launchers and secondary panels where appropriate. Avoid loading inactive finance sections. Remove duplicate navigation calculations and unnecessary client data aggregation.

Measure the production build before and after. Report meaningful changes in JavaScript bundle size, route size, request count, and initial finance-page data volume. Do not claim that the app is lighter without measurements.

### Required Tests

Add automated tests proving that:

- Every existing finance URL remains reachable.
- Each finance destination appears in one logical section.
- No finance feature is lost during the move.
- Active navigation works on list, new, edit, and detail routes.
- Workspace buttons navigate directly to their workspace.
- Pagination preserves filters, sorting, search, and browser history.
- Role restrictions remain enforced.
- Desktop, tablet, and phone navigation can reach every permitted feature.
- Keyboard users can operate menus, dialogs, drawers, selectors, and pagination.
- No route requires hover.
- No tested viewport has page-level horizontal overflow.
- Server pagination does not introduce duplicate or missing records between pages.

Run type checks, lint, all API tests, all existing builds, and Playwright. Add Playwright coverage for Finance overview, each finance section, paginated lists, global navigation, phone navigation, and tablet navigation.

Capture and inspect screenshots at 390px, 768px, 1024px, and 1440px. Check text clipping, overlapping controls, inaccessible menus, excessive scrolling, empty space, table overflow, and sticky elements covering content.

### Implementation Order

1. Record the pre-change route map, screenshots, performance measurements, and test baseline.
2. Rebuild the global navigation hierarchy.
3. Create the Finance overview and six-section navigation.
4. Group existing routes without deleting or breaking URLs.
5. Add server pagination and migrate finance list pages.
6. Rebuild Chart of Accounts as a searchable, paged interface.
7. Complete phone and tablet layouts across finance and the global shell.
8. Add automated workflow, accessibility, route, and responsive tests.
9. Run the complete verification suite and inspect screenshots.
10. Update this document with the completed commits, test evidence, screenshots, remaining risks, and rollback instructions.

### Commit Plan

Use small, reviewable commits:

1. `refactor(nav): simplify global application navigation`
2. `feat(finance): add overview and grouped finance navigation`
3. `feat(finance): add server pagination to finance lists`
4. `refactor(finance): compact chart of accounts workflow`
5. `fix(responsive): complete phone and tablet finance layouts`
6. `test(finance): cover navigation pagination and responsive workflows`
7. `docs(finance): record route map verification and completion evidence`

Do not combine unrelated financial-calculation, deployment, Prisma-major-upgrade, or QuickBooks-cutover changes into this batch.

## Definition of Done

The assignment is complete only when:

- The permanent sidebar has one understandable hierarchy without repeated Primary, Pinned, and Workspace destinations.
- Finance opens to a useful overview.
- No more than six primary Finance sections are visible.
- All existing finance pages remain accessible in their correct section.
- Finance lists use real server pagination where records can grow.
- Chart of Accounts no longer creates one uncontrolled page-length list.
- Every required viewport works without overlapping controls or page-level horizontal scrolling.
- Touch and keyboard users can reach all permitted destinations.
- Tests and production builds pass.
- Visual screenshots have been inspected, not merely generated.
- Changes are committed and this record contains the resulting commit hashes and verification results.

## Completion Record

- **Implementation branch:** `kimi/finance-nav-responsive-rebuild`
- **Starting commit:** `0874946b6b216ed27ffd1b32956db24bfc44f1fc`
- **Completion commits:** `6cf5eaf`, `8976d67`, `beff47c`, `4f1fdb1`, `92bd2d3`, `0c21414`, `b14ce86`, `432de6e`, `671644b`, `9bb29b8`, `8031a6d`
- **Type check:** PASS - all workspaces, 2026-09-23
- **Lint:** PASS with zero errors. One pre-existing Next.js warning remains for the official payroll-form `<img>` element.
- **API tests:** PASS - 225/225, including pagination and organization-wide finance summary coverage
- **Playwright:** PASS - 48/48. The finance-specific 16 tests cover every mapped finance destination and all four target widths.
- **Production builds:** PASS - database package, API, 67-route admin app, and 12-route employee tracker
- **Database:** PASS - PostgreSQL reachable; 19 migrations found; schema up to date; `/health/ready` reports database ready
- **Responsive inspection:** PASS - live visual inspection at 390px, 768px, 1024px, and 1440px covered the phone drawer, manual journals, bank statements, bank register, and financial statements. Automated captures are attached to the Playwright run.
- **Performance evidence:** No reproducible pre-change JavaScript bundle baseline was recorded, so no bundle-size reduction is claimed. Measured structural improvements are seven permanent sidebar links, zero permanent destination submenus, no more than six finance section controls, compact selectors below 1280px, default 25-row server payloads, and no page-level overflow across all 22 finance destinations at all four widths.
- **Dependency audit:** Four high-severity transitive advisories remain in the Prisma CLI/config dependency chain (`deepmerge-ts` and `mysql2`). npm proposes a breaking Prisma change; this is intentionally deferred to the disclosed Prisma-major-upgrade batch rather than forced into this release.
- **Known remaining production risks:** SMTP is not configured; local document storage has no rehearsed Render backup/restore; the real owner-supplied QuickBooks file cutover is not signed off; subscriber-scale organization roles and monetary persistence controls remain separate release gates.
- **Rollback instructions:** Revert the completion commits in reverse order on a recovery branch or redeploy the previous reviewed integration SHA. Pagination responses remain backward-compatible for callers without paging parameters. Do not use a destructive database reset; restore PostgreSQL only from a verified backup if a data rollback is independently required.
