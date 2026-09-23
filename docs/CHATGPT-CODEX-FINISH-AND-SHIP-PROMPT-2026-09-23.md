# ChatGPT Codex Finish-and-Ship Prompt

**Created:** 2026-09-23  
**Repository:** `C:\Kleentoditee Payroll HRM\Kleentoditee-payroll-hrm-pro4.0`  
**Current branch:** `kimi/finance-nav-responsive-rebuild`  
**Current committed HEAD at review:** `4f1fdb156ffa46c68bd917efc91be84632e5d6dd`  
**Completed implementation HEAD:** `8031a6d` (documentation commit follows)
**Purpose:** Recover Kimi K3's unfinished finance/navigation batch, finish it safely, and continue through evidence-based release readiness in bounded Codex work sessions.

## Instructions to ChatGPT Codex

You are the primary implementation and release agent for KleenToDiTee Payroll HRM. This is an implementation assignment, not a request for another general plan. Read this document, the original specification in `docs/FINANCE-NAVIGATION-RESPONSIVE-REBUILD-2026-09-23.md`, and the current working tree before editing.

Work in small, independently verifiable batches. Codex usage operates in bounded windows, so reserve the end of every work session for verification, documentation, and a commit. Never leave valuable work unidentified or overwrite another agent's changes.

## Verified Repository State

Kimi created and worked on `kimi/finance-nav-responsive-rebuild`, based on documentation commit `0874946`.

Committed work:

| Commit | Verified scope |
| --- | --- |
| `6cf5eaf` | Simplified and split the global navigation shell |
| `8976d67` | Added backward-compatible server pagination infrastructure and tests |
| `beff47c` | Added the Finance overview and six-section finance navigation |
| `4f1fdb1` | Converted core finance lists to pagination and rebuilt Chart of Accounts |

The branch contains approximately 5,008 inserted lines and 2,540 removed lines across 43 committed paths compared with `0874946`.

At the time of this review, the branch had not been pushed and the original Completion Record remained entirely `Pending`.

## Exact Point Where Kimi Stopped

Kimi completed the navigation, overview, API pagination, main paged lists, and compact Chart of Accounts. Kimi then started the responsive detail-page phase and stopped during the first conversion.

The following six paths contain uncommitted work and must be preserved:

1. `apps/admin-web/src/app/dashboard/finance/bill-payments/[id]/page.tsx`
2. `apps/api/src/lib/finance-summary.ts`
3. `apps/api/src/routes/finance.ts`
4. `apps/admin-web/src/components/finance/record-breadcrumb.tsx`
5. `apps/admin-web/src/components/finance/record-cards.tsx`
6. `apps/api/src/lib/finance-summary.test.ts`

The uncommitted bill-payment page is being converted to breadcrumbs, phone record cards, a bounded desktop table, and 44-pixel controls. The two shared responsive components are new and currently used only by that page.

The uncommitted API work adds organization-wide customer and supplier summary endpoints. Those endpoints are not yet consumed by the Customers and Suppliers pages, so committing them alone would leave the feature incomplete.

## Verified Test State at Handoff

The following checks were run against the working tree on 2026-09-23:

- Workspace type checks: **PASS**
- Existing API suite: **209/209 PASS**
- New pagination and finance-summary tests run explicitly: **16/16 PASS**
- Admin production build: **PASS**, 67 routes generated
- Existing Playwright smoke suite with the local stack running: **24/24 PASS**
- Full `npm run ci`: **FAILS at lint**

Current lint blocker:

- `apps/admin-web/src/lib/use-list-query.ts:84` uses `filterKeys.join("|")` directly in a hook dependency list. Refactor to a stable simple dependency without disabling the rule.

Current warnings:

- `apps/admin-web/src/app/dashboard/finance/accounts/page.tsx` has an effect-cleanup ref warning.
- `apps/admin-web/src/app/dashboard/payroll/forms/page.tsx` has the existing raw `<img>` warning.

Test-wiring defect:

- `apps/api/package.json` does not include `pagination.test.ts` or `finance-summary.test.ts` in the normal API test command. A reported 209-test pass therefore does not test the new pagination work. Wire both files into the standard test command and record the new total.

The existing Playwright suite is only a smoke suite. It does not test the new global navigation, six finance sections, pagination, query-string preservation, drawer behavior, page overflow, or finance detail responsiveness.

## Non-Negotiable Recovery Rules

- Do not run `git reset --hard`, `git checkout --`, destructive clean commands, or any operation that discards the six uncommitted paths.
- Do not stash and forget the work. Inspect it, finish it, test it, and commit it.
- Do not switch to another branch until the current work is safely committed.
- Do not combine unrelated Prisma upgrades, payroll calculation changes, statutory rate changes, or QuickBooks live synchronization with this UI batch.
- Preserve all finance URLs, APIs, records, permissions, journal behavior, audit behavior, and import behavior.
- QuickBooks remains file import and migration only. Do not build QBO OAuth or live synchronization.
- Do not claim a pass for a command that was not run.
- Do not mark the app ready to ship while a required gate is pending or failed.

## Five-Hour Work-Window Discipline

Treat each Codex work window as a release checkpoint:

1. Spend the first 15 minutes reading the current branch, dirty files, latest completion ledger, and newest user request.
2. Select only one numbered batch from this document.
3. Target no more than 90 to 150 minutes of implementation in that batch.
4. Stop starting new code when approximately 90 minutes remain.
5. Use the remaining time for focused tests, full required checks, visual inspection, documentation, and a commit.
6. Before ending, update the Progress Ledger in this file with the commit hash, exact commands, results, remaining risks, and the next single action.
7. Leave the working tree clean whenever possible. If a failure prevents this, list every dirty path and explain its state in the ledger.

## Batch 0: Recover and Close Kimi's Uncommitted Work

This batch must be completed first.

1. Inspect all six dirty/untracked paths and preserve their intent.
2. Fix the `use-list-query.ts` lint error using a stable filter-key signature or stable normalized key list. Do not suppress the hook rule.
3. Fix the Chart of Accounts effect-cleanup ref warning.
4. Add `pagination.test.ts` and `finance-summary.test.ts` to the normal API test command.
5. Finish the organization-wide customer and supplier summary flow:
   - Keep the new scoped API summary endpoints.
   - Load them from the Customers and Suppliers pages.
   - Ensure tiles represent all matching organization records, not only the current page.
   - Provide loading, authorization, and recoverable error states.
   - Test zero values, overdue values, recent payments, and organization isolation.
6. Finish the bill-payment detail responsive conversion and verify that both card and table presentations expose the same data and actions.
7. Add focused tests for the summary endpoints and any pure UI state helper introduced.
8. Run typecheck, lint, the newly wired API suite, admin build, and focused browser verification.
9. Commit only after the batch is green.

Suggested commit: `fix(finance): recover responsive detail and summary work`

## Batch 1: Complete Responsive Purchases Workflows

Convert and visually verify the remaining Purchases pages:

- Suppliers
- Bills list, create, and detail
- Bill payments list, create, and detail
- Expenses list, create, and detail

Requirements:

- Use the shared record-card and bounded-table patterns consistently.
- Add complete record breadcrumbs to new and detail pages.
- Preserve every action: post, receive, apply, unapply, void, delete, navigate, and return.
- Forms must be single-column on phones and logically grouped at larger widths.
- Long supplier names, references, memos, and account names must wrap without causing page overflow.
- No page-level horizontal overflow at 390px or 768px.

Suggested commit: `fix(finance): complete responsive purchases workflows`

## Batch 2: Complete Responsive Sales Workflows

Convert and visually verify:

- Customers list and detail
- Products and services
- Invoices list, create, and detail
- Payments received list, create, and detail

Preserve invoice lines, applications, send, receive, void, delete, customer navigation, exports, column settings, and existing customer-management behavior. Do not reduce functionality to make mobile layouts easier.

Suggested commit: `fix(finance): complete responsive sales workflows`

## Batch 3: Complete Banking, Accounting, and Report Responsiveness

Convert and verify:

- Deposits list, create, and detail
- Bank statements and statement-line actions
- Reconciliation list and detail
- Bank register
- General journal
- Manual journals
- Fiscal periods
- Financial statements
- Trial balance
- AR/AP aging
- Year-end close
- Filing support

Use internal bounded table scrolling only where a financial grid genuinely requires it. Add phone summaries or cards when a table cannot be understood on a narrow screen. Do not allow the complete page to scroll horizontally.

Confirm whether Bank statement lines and other growing banking records use real server pagination in both API and UI. Finish any endpoint or page missed by the earlier pagination batch.

Suggested commit: `fix(finance): complete responsive accounting and banking`

## Batch 4: Navigation, Pagination, and Accessibility Proof

Add dedicated Playwright coverage. The tests must prove, rather than merely render headings:

- The seven global workspaces appear once in the permanent navigation.
- Clicking each workspace name navigates to its landing page.
- The mobile/tablet drawer opens, traps focus, closes with Escape, closes after navigation, and restores focus appropriately.
- Finance exposes exactly six primary sections.
- Every preserved finance destination is reachable through its assigned section.
- Detail and new routes retain the correct active section and breadcrumbs.
- Search is debounced and represented in the URL.
- Page, page size, sort, and filters survive refresh and browser Back/Forward.
- Previous and Next do not duplicate or skip records.
- Role restrictions remain enforced.
- No tested route displays `Application error`.
- `document.documentElement.scrollWidth <= window.innerWidth` at 390px, 768px, 1024px, and 1440px for every core finance route.

Update Playwright projects to include the required 390, 768, 1024, and 1440 widths. Capture named screenshots for the Finance overview, navigation drawer, Chart of Accounts, one Sales workflow, one Purchases workflow, Banking, and Financial Statements. Inspect the images manually and record defects fixed.

Make the E2E prerequisite explicit. Either provide a reliable supervised test-stack command or configure an equivalent setup. A stopped server must produce one clear prerequisite failure, not 24 repetitive connection failures.

Suggested commit: `test(finance): prove navigation pagination and responsive workflows`

## Batch 5: Finish the Documentation and Merge the Feature Branch

1. Update the Completion Record in `docs/FINANCE-NAVIGATION-RESPONSIVE-REBUILD-2026-09-23.md`.
2. Update the Progress Ledger below.
3. Record the final route map and prove that no existing route was removed.
4. Record build and test totals, screenshot paths, known risks, performance measurements, and rollback instructions.
5. Remove dead exports such as old Primary/Pinned navigation constants only after proving that no code consumes them. This is code cleanup, not removal of user-facing finance features.
6. Run the full release gate from a clean working tree.
7. Push `kimi/finance-nav-responsive-rebuild` and open a pull request into `codex/consolidate-live-build`.
8. Review the final diff and resolve findings before merge.

Do not merge directly into stale `main`. The integration branch remains the reviewed source until the release-branch decision is executed.

Suggested commit: `docs(finance): record responsive rebuild acceptance`

## Batch 6: Production Ship Blockers

After the finance/navigation pull request is merged, return to the whole-application release blockers from the independent deep review. Do not confuse UI completion with production readiness.

Required before an internal live pilot:

1. Promote the reviewed integration commit to the actual deployment branch or explicitly configure Render to deploy it.
2. Configure production SMTP and verify invitation and password-reset delivery end to end.
3. Implement and rehearse a Render-compatible PostgreSQL and employee-document backup/restore process. The existing Windows PowerShell backup scripts are not sufficient for Render.
4. Confirm production object storage, private document authorization, health checks, secrets, CORS, cookies, and domain configuration.
5. Record RPO, RTO, restore evidence, rollback steps, and responsible owner.

Required before the real QuickBooks file cutover:

1. Compare source and destination Balance Sheet, Profit and Loss, Trial Balance, retained earnings, bank/card balances, AR, AP, and aging by document.
2. Require notes, evidence, reviewer identity, and acceptance date for every discrepancy.
3. Block cutover acceptance until the signed exception report is complete.
4. Rehearse using a real owner-supplied QuickBooks export before final sign-off.

Required before multiple subscribers share the platform:

1. Move operational roles from global user roles to organization-membership-scoped roles.
2. Resolve the remaining monetary `Float` persistence risk using Decimal or integer cents, or document a formally approved interim control with exhaustive reconciliation tests.
3. Complete tenant-isolation, capacity, monitoring, document retention, and support procedures.

## Required Final Release Gate

Run and record all applicable checks from a clean tree:

```powershell
npm run db:generate
npm run typecheck
npm run lint
npm run test:api
npm run build
npm run test:e2e
npm audit --omit=dev
git diff --check
git status --short
```

Also verify database migration status, `/health/ready`, SMTP state, document storage state, admin login, tracker login, and the production deployment configuration.

## Definition of Done

The finance/navigation rebuild is complete only when:

- Kimi's six uncommitted paths are either completed and committed or deliberately replaced with documented evidence; none are silently discarded.
- `npm run ci` passes with zero errors.
- New pagination and finance-summary tests run through the normal test command.
- The required finance-specific Playwright workflows pass at all four widths.
- Screenshots are inspected, not merely generated.
- All existing finance URLs and actions remain available.
- No core finance route has page-level horizontal overflow.
- The two dated finance documents contain real completion evidence.
- The feature branch is pushed, reviewed, and merged into the integration branch.

The application is ready for production only when the separate production, SMTP, backup/restore, deployment-branch, and cutover gates are also complete.

## Progress Ledger

Update this section at the end of every Codex work window.

| Batch | Status | Commit | Verification | Remaining action |
| --- | --- | --- | --- | --- |
| Batch 0: Recover Kimi WIP | Complete | `0c21414` | Lint defect fixed; new tests wired; summaries and bill-payment detail completed | None |
| Batch 1: Purchases responsive | Complete | `b14ce86` | Typecheck, lint, build, and visual checks passed | None |
| Batch 2: Sales responsive | Complete | `432de6e` | Typecheck, lint, build, and visual checks passed | None |
| Batch 3: Banking/accounting responsive | Complete | `671644b` | Real bank paging, phone records, bounded tables, and balance semantics verified | None |
| Batch 4: Browser/accessibility proof | Complete | `9bb29b8`, `8031a6d` | 48/48 full E2E; 16 finance tests at 390/768/1024/1440; every mapped route visited | None |
| Batch 5: Documentation and merge | In progress | Documentation commit pending | Full local release gate passed; working tree clean before this update | Push branch, open PR, attach review, and record URL |
| Batch 6: Production ship blockers | Owner action required | — | Readiness endpoint works locally; migrations current | Configure SMTP, rehearse backup/restore, deploy reviewed branch, perform real QB cutover |

### Current Working-Tree Handoff

- **Branch:** `kimi/finance-nav-responsive-rebuild`
- **HEAD before this documentation update:** `8031a6d`
- **Dirty paths:** Only the two dated documentation records while this completion evidence is being written
- **Known failing code gate:** None
- **Last verified API suite:** 225/225
- **Last verified build:** All workspaces passed; admin generated 67 routes and tracker generated 12 routes
- **Last verified E2E:** 48/48 across desktop, laptop, tablet, and phone
- **Database state:** 19 migrations; schema up to date; readiness database check passes
- **Configuration blockers:** SMTP not configured; document storage is local; production deployment and backup/restore are not yet rehearsed
- **Security audit:** Four high transitive Prisma-chain advisories are disclosed and deferred to the separate breaking-upgrade batch
- **Next single action:** Commit these records, push the branch, open the pull request into `codex/consolidate-live-build`, and complete review before merge
