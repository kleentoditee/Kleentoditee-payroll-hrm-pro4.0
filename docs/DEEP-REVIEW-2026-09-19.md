# Deep Review & Gap Analysis — 2026-09-19 (Batch 9)

Reviewer: Kimi (self-audit), run against the live working tree of `Kleentoditee-payroll-hrm-pro4.0`.
Scope: build/merge health, verification of every Batch 1–8 claim, gap measurement against the K3 requirements baseline (`docs/KIMI-K3-COMPLETE-APP-IMPLEMENTATION-PROMPT.md`), and competitor comparison weighted for BVI.
Honesty rules applied: code beats documents; anything not executed or read is marked UNVERIFIED.

---

## 1. Build & merge health

### Commands actually run (this session, real results)

| Check | Result |
|---|---|
| `npm run build` (db, admin-web, employee-tracker, api) | **PASS** — all four workspaces compiled |
| `npm run typecheck` (all workspaces) | **PASS** — exit 0 |
| `npm run test:api` | **PASS** — 111/111, 6 suites, ~3.3s |
| `npm run lint` (all workspaces) | **PASS** — 0 errors, 1 warning (`<img>` instead of `next/image`, one admin page) |
| `npm audit` | **4 high** — all inside the `prisma` dev-CLI dependency chain (`mysql2 <= 3.23.0`, GHSA-3f6p / GHSA-rgwj). Dev-tool-only exposure; `npm audit fix --force` would downgrade Prisma to 6.19.3 (breaking) — correctly rejected. Same state as Batch 7 record. |

### Git / merge state — the uncomfortable part

- Main checkout is on branch `cleanup/project-workflow-audit`, last commit `5163b84` (staff-hub Phase 3).
- **Working tree: 214 modified files + 86 untracked files/dirs, ZERO of it committed.** All of Batches 1–8 — cookie auth/CSRF, YTD import, payroll reports, leave, the Prisma 7 upgrade, and the entire double-entry GL — exists only as uncommitted working-tree state on one machine. There is no commit, no branch, no stash, no backup of this work. A `git reset --hard`, disk failure, or careless checkout wipes two days of verified work. **This is the single highest-risk finding in this review.**
- Lane worktrees and their tips:
  - `claude-finance-core` @ `05b889a` — **merged** (ancestor of current branch).
  - `codex-integration-qa` @ `9a4c06f` — **merged**.
  - `cursor-employee-tracker` @ `1f01a34` — **merged**.
  - `frontend-auth-client-cookie-ready` @ `56feb29` ("feat(frontend): prepare auth clients for cookie sessions", May 2026) — **NOT merged into any branch**. Its content (centralized cookie-credential auth transport) appears functionally superseded by Batch 2's uncommitted cookie-auth implementation, but nobody has diffed it to confirm nothing unique is stranded there. **Verify before ever deleting that branch.**
- Integration branch `codex/consolidate-live-build` sits at `fb75b72`, far behind the working tree. The "integration branch" has not integrated any of Batches 1–8.
- `main` @ `421e761` — likewise behind; everything recent flows through the current branch.

**Verdict:** the build is green and tests pass, but the repository is one accident away from losing all of it. Merge state is "nothing stranded except one old cookie-prep branch", but commit state is "nothing committed at all".

---

## 2. Batch 1–8 implementation verification

Each item checked against actual code in this session.

| # | Claim | Status | Evidence |
|---|---|---|---|
| 1 | StatutoryRateVersion model | VERIFIED | `packages/db/prisma/schema.prisma:1101` |
| 1 | Nav fixes | VERIFIED (indirect — admin layout/build green) | `apps/admin-web/src/app/dashboard/layout.tsx` modified, build PASS |
| 2 | HttpOnly `kt_session` + `kt_csrf` double-submit | VERIFIED | `apps/api/src/lib/auth-cookies.ts`, `csrf-guard.tsx` |
| 2 | CSRF enforced on mutating requests | VERIFIED (route-level header check present; full route-by-route audit NOT re-run this session — marked partial-depth) | `apps/api/src/lib/auth-cookies.ts` + route imports |
| 2/5 | `hasSessionCookie()` checks `kt_csrf` not HttpOnly cookie | VERIFIED in both apps | `apps/admin-web/src/lib/auth-storage.ts:29-33`, `apps/employee-tracker/src/lib/auth-storage.ts:29-33` |
| 3 | YTD opening-balance import | VERIFIED | `PayrollYtdOpeningBalance` model (`schema.prisma:1162`), `/dashboard/payroll/ytd-import/page.tsx` |
| 4 | Payroll register + year summary + reconciliation | VERIFIED | `/dashboard/payroll/reports/page.tsx` exists; endpoints live-tested in Batch 4 |
| 5 | Leave domain (UNPAID_LEAVE, policies, pro-rata deduction) | VERIFIED | `LeavePolicy` (`schema.prisma:1191`), `apps/api/src/lib/leave-days.ts`, `leave.ts`, `/dashboard/people/leave/page.tsx` |
| 6 | npm-override attempt cleanly reverted | VERIFIED — no `overrides` key in root `package.json` | grep, this session |
| 7 | Prisma 7.10.0 + adapter-pg | VERIFIED | `packages/db/package.json`: `prisma`, `@prisma/client`, `@prisma/adapter-pg` all `^7.10.0` |
| 7 | `datasource.url` removed, `prisma.config.ts` added | VERIFIED | no `url` in `schema.prisma` datasource; `packages/db/prisma.config.ts` exists |
| 7 | Lazy Proxy singleton; proxy NOT cached on globalThis | VERIFIED | `packages/db/src/index.ts:27-28` — comment + code confirm only the real client is cached |
| 8 | JournalEntry/JournalLine models | VERIFIED | `schema.prisma:1057`, `:1079` |
| 8 | Posting wired same-transaction into all six domains + payroll | VERIFIED | `postJournal(...)` calls inside `finance-invoices.ts:337`, `finance-payments.ts:215`, `finance-bills.ts:329`, `finance-bill-payments.ts:210`, `finance-expenses.ts:310`, `payroll-service.ts:465` — all inside `tx` blocks |
| 8 | Reports endpoints | VERIFIED | `finance-reports.ts:156` trial-balance + journal + ledger via `gl-reports.ts` |
| 8 | Admin UI journal + trial balance | VERIFIED | `apps/admin-web/src/app/dashboard/finance/journal/page.tsx`, `trial-balance/page.tsx` |
| 8 | Deposits posting | **CONFIRMED NOT DONE** (documented open slice) | zero `postJournal` references in `finance-deposits.ts` |

No batch claim was found to be false. The record in `TASKS.md` matches the code.

---

## 3. Requirements completion matrix (K3 baseline)

| K3 requirement | Status | What remains |
|---|---|---|
| Multi-tenant `Organization`/tenant model + isolation | **NOT STARTED** | Entire design: tenant entity, memberships, org-scoped unique constraints, server-side scoping on every query, cross-tenant tests, data migration. **Schema today has zero tenant/company/organization fields — confirmed by grep.** The product is structurally single-company. |
| Auth/session hardening | DONE (Batch 2) | DB-backed throttle recorded in TASKS; periodic re-audit |
| Private object storage | PARTIAL | `document-storage.ts` has provider abstraction; `local` works; **S3/R2 class exists but throws "not implemented yet"** |
| Double-entry ledger core | PARTIAL (Batch 8 slice 1) | Fiscal years/periods with open/soft-close/locked — **no models exist**; manual journals with approval — none; opening balances/conversion — none; recurring journals — none; retained-earnings closing — none |
| Idempotent posting engine | PARTIAL | 6 of ~15 required event types wired. Missing: **deposits (confirmed)**, credit/refunds, bank transfers, owner contribution/draw, asset purchase/disposal, loans, bad debt |
| Banking & reconciliation | **NOT STARTED** | No bank/cash account model beyond chart accounts, no statement import, no matching, no reconciliation sessions, no registers |
| Accounting reports | PARTIAL | Trial balance, journal, account ledger exist. Missing: P&L, balance sheet, cash flow, changes in equity, **AR/AP aging (zero matches in API)**, payroll-liability status report, per-customer/job/location profitability, budgets, PDF/CSV export of accounting reports |
| Year-end financial-statement package | **NOT STARTED** | Entire workspace: cover/TOC, 4 statements, editable notes, comparatives, schedules, approval/signature/lock workflow, PDF, reproducible snapshot |
| BVI filing-support outputs | **NOT STARTED** | Inland Revenue package, Business Companies annual financial return mapping (2023 Order schedule), registered-agent applicability flow, rule-version storage with verified dates |
| WhatsApp | **NOT DONE** | `share-tracker-access-card.tsx:33` still builds `https://api.whatsapp.com/send?text=...` with no recipient number — the exact behavior K3 says to replace. No E.164 normalization, no `wa.me/<number>` mode, no provider mode |
| Email service | PARTIAL | `email.ts` = 92-line nodemailer SMTP wrapper; sends invitations + password resets only. Missing: queue, idempotency, retries, templates, provider settings page, delivery log UI, webhooks, suppression list |
| Payroll statutory engine | PARTIAL | Versioned rates exist; see §4 findings on rate correctness/provenance |
| Payroll runs, paystubs, YTD, register, reconciliation | DONE (Batches 1–5) | Government-form outputs are "foundations" per K3 inventory — depth UNVERIFIED this session |
| HR records, documents, work authorization | DONE (pre-existing) | Depth UNVERIFIED this session |
| Staff requests / schedule / announcements / rewards | DONE (pre-existing + Phase 3 commit) | R10 scheduling depth vs rostering needs UNVERIFIED |
| Release gates (e2e, visual, cross-tenant, backup/restore) | **NOT STARTED** | No Playwright/Cypress anywhere in the repo — confirmed. 111 API unit tests exist; zero browser/e2e tests, zero cross-tenant tests, no backup/restore proof |

---

## 4. BVI statutory correctness — flags found this session

Seed values in `packages/db/prisma/seed.ts` checked against current public sources:

| Item | Seed value | Public record | Verdict |
|---|---|---|---|
| Payroll tax employee rate | 8% | 8% employee, first US$10,000 exempt | MATCHES [Baker Tilly BVI](https://www.bakertilly.vg/services/taxation-and-payroll-bureau "citation"), [Wikipedia BVI taxation](https://en.wikipedia.org/wiki/Taxation_in_the_British_Virgin_Islands "citation") |
| Payroll tax employer class | `NOT_SET` | Class 1 employer 2% (total 10%), Class 2 employer 6% (total 14%) | **GAP — employer side cannot be computed until class is configured; must be a required, owner-confirmed setting** [Papaya Global BVI](https://www.papayaglobal.com/blog/employer-of-record-in-the-british-virgin-islands/ "citation") |
| Payroll tax exemption | $10,000/yr | $10,000/yr | MATCHES |
| SSB rates | 4% EE / 4.5% ER | 4% EE / 4.5% ER (private sector) | MATCHES [US SSA BVI summary](https://www.ssa.gov/policy/docs/progdesc/ssptw/2018-2019/americas/bvi.html "citation") |
| SSB annual ceiling | $53,400 | ~$43,524/yr as of Jan 2020 per SSA summary | **MISMATCH — verify against current SSB contribution regulations; seed provenance fields are empty so the figure is unsourced** |
| NHI rates | 3.75% / 3.75% | 3.75% each | MATCHES [US SSA BVI summary](https://www.ssa.gov/policy/docs/progdesc/ssptw/2018-2019/americas/bvi.html "citation") |
| NHI annual ceiling | $106,800 | SSA summary lists $84,760/yr | ~~MISMATCH~~ **CORRECTED 2026-09-19:** official NHI 2026 bulletin confirms $106,800 — the seed is right; Kimi's comparison used an outdated SSA summary. Provenance fields still empty — record the source. See [reconciliation](DEEP-REVIEW-RECONCILIATION-2026-09-19.md) §4 |
| Rate provenance | `sourceUrl`, `verifiedBy`, `approvedBy` all **empty strings** | K3 requires stored rule versions with source links and verified dates | **GAP — the versioning model exists but no rate row is actually verified** |
| Legacy `DeductionTemplate` | Template literally named **"NHI + SSB + income tax"** with `incomeTaxRate: 0.08`, `applyIncomeTax: true` | BVI income tax rate is **zero**; the 8% is payroll tax | **JURISDICTION BUG — a seeded template mislabels BVI payroll tax as "income tax" and can apply it as such. Rename/repair before any subscriber sees it** [Baker Tilly BVI](https://www.bakertilly.vg/services/taxation-and-payroll-bureau "citation") |
| Leave policy seed | SICK 10 days | BVI Labour Code minimum sick leave cited as 12 working days | **POSSIBLE UNDER-ENTITLEMENT — verify Labour Code s. and bump seed if confirmed** [Papaya Global BVI](https://www.papayaglobal.com/blog/employer-of-record-in-the-british-virgin-islands/ "citation") |
| Leave policy seed | ANNUAL flat 15 days | Statutory scale reported as 12–20 days by service length | ACCEPTABLE as a company policy above minimum for junior staff, but **flat 15 exceeds minimum for long-service staff minimum is fine; verify against service-based scale** |
| Minimum wage | not modeled | US$7.25/hr effective 2025-07-01 | **GAP — no minimum-wage validation on employee pay rates** [Papaya Global BVI](https://www.papayaglobal.com/blog/employer-of-record-in-the-british-virgin-islands/ "citation") |

---

## 5. Competitor comparison, weighted for BVI

Sources: feature/pricing facts from the comparison and vendor pages returned in this session's search; BVI applicability is the decisive column.

| Feature | This app (verified state) | QBO | Xero | Gusto | BambooHR | Wave | BVI reality check |
|---|---|---|---|---|---|---|---|
| BVI payroll (NHI/SSB/payroll tax) | Core engine + versioned rates, provenance missing | No BVI payroll (US/Canada focus) | Payroll only AU/NZ/UK native | **US-only** | US payroll add-on | US/Canada | **This app is the only one of the six that computes BVI statutory payroll at all.** Real regional competitor is Celery (Caribbean payroll, has a BVI module), not the big five [Celery BVI](https://support.celerypayroll.com/en/support/solutions/folders/6000242463 "citation") |
| Double-entry GL | Core + auto-postings; no fiscal periods, no manual journals | Full | Full | No | No | Full | Behind QBO/Xero/Wave on ledger completeness |
| Invoicing / bills / payments | Working, GL-posted | Best-in-class | Strong | No | No | Strong | Competitive at small-business scale |
| Banking & reconciliation | **None** | Strong + feeds | Best-in-class + feeds | n/a | n/a | Good | **Largest accounting gap** — every accounting competitor has this |
| Financial statements | Trial balance only | Full suite | Full suite | No | No | P&L/BS | Behind all accounting players |
| Year-end / filing package | None | Accountant ecosystem | Accountant ecosystem | US filings | n/a | Basic | Nobody does BVI annual financial return — **open lane if built** |
| HR records / onboarding / docs | Working | Minimal | Minimal | Strong | **Best-in-class** | No | Behind BambooHR on HR depth; ahead of QBO/Xero/Wave |
| Leave management | Policies, balances, approval, payroll deduction | No | Minimal | Yes | Strong | No | Competitive; statutory minimums need verification (§4) |
| Time tracking | Multi-location entries + approvals | Add-on/higher tier | Via integration | Yes | Yes | No | Competitive |
| Scheduling/rostering | Phase-3 foundation | No | No | Basic | Add-on | No | Ahead of most at this price point |
| Employee self-service | Tracker app (auth fixed Batch 2/5) | Workforce portal | Via Gusto | Strong | Strong | No | Competitive |
| Multi-tenancy for subscribers | **None — single company** | n/a (per-company files) | n/a | n/a | n/a | n/a | **Blocks the subscriber business model entirely** |
| Multi-currency | No | Higher tiers | Yes (160+) | n/a | n/a | Yes | BVI uses USD — low priority locally, matters for subscribers' foreign clients |
| Mobile apps | Responsive web only | Native apps | Native apps | Native | Native | Native | Behind everyone on native; web is acceptable for v1 |
| Bank feeds / app ecosystem / uptime SLA | None | 650+ apps, SOC-grade ops | 1,000+ apps | Many | Many | Some | Cannot match in near term — do not try; win on BVI fit |
| e2e/release quality gates | Unit tests only | Industrial QA | Industrial QA | Industrial | Industrial | Industrial | Behind; R13 open |

**Plain-language verdict:** for a BVI business, this product already beats QBO/Xero/Gusto/BambooHR/Wave on the thing that matters most — correct BVI payroll with an integrated ledger — because none of them do BVI payroll at all. It loses to all of them on banking/reconciliation, financial statements, mobile, and operational hardening. Its actual head-to-head competitor is regional payroll software (e.g. Celery), which does BVI payroll but not an integrated subscriber-ready accounting suite — that integrated suite is exactly what K3 specced and what is only ~1 slice (Batch 8) into existence.

---

## 6. Prioritized gap list (severity-ranked)

### Severity 1 — data loss / security / business-model blockers

1. **Everything is uncommitted.** 214 modified + 86 untracked files carry Batches 1–8. Commit the verified work in coherent chunks (K3 already specced the commit sequence). Nothing else matters until this is done.
2. **No multi-tenancy.** Zero tenant fields in the schema. The subscriber business model and K3's isolation requirement are unbuilt. Must land before any external subscriber; requires org entity, scoped queries everywhere, migration of existing records, cross-tenant tests.
3. **Stranded branch `frontend/auth-client-cookie-ready` (56feb29).** Probably superseded by Batch 2, but undiffed. Diff it, salvage anything unique, then archive.
4. **"Income tax" template bug.** Seeded `DeductionTemplate` "NHI + SSB + income tax" applies 8% as income tax in a zero-income-tax jurisdiction. Fix naming/mapping before a subscriber or an auditor sees it.

### Severity 2 — payroll / accounting correctness

5. **Unsourced statutory rates + two ceiling mismatches** (SSB $53,400 vs ~$43.5k; NHI $106,800 vs ~$84.8k per public summaries) and `payrollTaxEmployerClass: NOT_SET`. Populate `sourceUrl`/`verifiedBy`/`approvedBy` after verifying with SSB/NHI/Inland Revenue directly; make employer class a required owner-confirmed setting.
6. **Sick-leave seed (10d) possibly below the 12-day statutory minimum** — verify Labour Code, bump if confirmed.
7. **GL incompleteness:** no fiscal periods/locks, no manual journals, no opening balances, deposits don't post, no credit/refund/transfer/loan/asset posting events.
8. **No P&L, balance sheet, cash flow, changes in equity, AR/AP aging** — a ledger without statements cannot produce the year-end package K3 demands.

### Severity 3 — blocked workflows

9. **No banking/reconciliation at all** — statement import, matching, sessions, registers.
10. **WhatsApp still uses the recipient-less `api.whatsapp.com/send` link** — the exact behavior K3 ordered replaced.
11. **Email is invite/reset-only**, no queue/retry/log/templates/settings page.
12. **S3/R2 storage throws "not implemented"** — production document hosting blocked (R6).

### Severity 4 — compliance / filing exposure

13. No Inland Revenue package, no Business Companies annual financial return mapping (2023 Order schedule categories), no registered-agent applicability flow, no rule-version storage with verified dates.
14. No minimum-wage validation ($7.25/hr since 2025-07-01).

### Severity 5 — UX / polish / process

15. Zero e2e/visual tests (no Playwright/Cypress), no backup/restore proof, R10 scheduling depth and R11 ops unverified, 1 lint warning (`<img>`), tracker/admin cookie shadowing across localhost ports (dev-only quirk, documented Batch 7).

---

## 7. Recommended next 3 batches

Ordered by the severity list, sized to the one-session batch pattern used so far:

1. **Batch 10 — Commit the verified baseline.** Chunk the working tree into the K3 commit sequence (audit baseline → auth → payroll → leave → prisma 7 → GL), diff the stranded cookie branch first, confirm `.gitignore` covers tmp/uploads, push. Deliverable: clean worktree, all batch work durable. No new features.
2. **Batch 11 — Statutory truth pack.** Fix the "income tax" template, set up employer-class configuration (required, owner-confirmed), verify SSB/NHI ceilings + sick-leave minimum against official BVI sources, populate provenance fields, add minimum-wage validation. Small, high-value, unblocks "compliant payroll" claims.
3. **Batch 12 — GL slice 2: fiscal periods + manual journals + deposits posting.** Then Batch 13+: P&L/BS/cash-flow + aging, then banking. Multi-tenancy is the biggest single lift — schedule it as a dedicated multi-batch track immediately after Batch 10 if the subscriber timeline matters more than accounting depth; otherwise after the ledger can produce statements.

---

## 8. What this review did NOT verify (honest limits)

- Route-by-route CSRF coverage (spot-checked, not exhaustively re-audited).
- Depth of pre-existing HR/schedule/staff-hub/government-form features — existence verified, workflow depth not re-exercised this session.
- BVI Labour Code leave minimums and SSB/NHI ceilings — flagged from public summaries; official confirmation is a Batch 11 task.
- The stranded cookie branch's diff — existence proven, content not yet compared line-by-line.
