# QA Test Matrix

**Owner:** Agent 2 — Security, Compliance, QA, and Architecture Reviewer
**Goal:** A single page that tells any agent or reviewer **what must be tested** for each domain, **at which layer** (unit / integration / API smoke / admin smoke / Playwright E2E), and **what's missing today**.

Companion: [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) · [stability-and-smoke-tests.md](stability-and-smoke-tests.md)

---

## Test layers in this repo

| Layer | Tool today | What it covers |
|-------|------------|----------------|
| **Unit (api)** | `npm run test --workspace api` (`tsx --test`, currently `payroll-utils.test.ts`) | Pure helpers; no I/O. |
| **Unit (web)** | _None today._ Add Vitest when the first non-trivial helper exists. | Pure client helpers (e.g. `api-contracts.ts`). |
| **API smoke** | `npm run smoke:core` ([scripts/smoke-core.mjs](scripts/smoke-core.mjs)) | HTTP shape contract for high-traffic GETs against a live API + seeded DB. |
| **Admin smoke** | `npm run smoke:admin` ([scripts/smoke-admin-pages.mjs](scripts/smoke-admin-pages.mjs)) | Admin pages return 200 (or 200-after-redirect) and not 404/5xx. |
| **All smoke** | `npm run smoke:all` | Both of the above. Requires API on `:8787` and admin on `:3000`. |
| **E2E (Playwright)** | _Not yet wired._ | Cross-app browser flows; written in [§ 7](#7-playwright-e2e-flows-future) and tracked as future work. |

> The smoke scripts `scripts/smoke-finance-{a,b,c}.mjs` exist but are **not exposed** as `npm` scripts — see [DOC_DRIFT_FINDINGS.md](DOC_DRIFT_FINDINGS.md) for the gap.

---

## Status legend

- 🟩 **Covered** — automated test exists and runs in the named layer.
- 🟨 **Partial** — covered by smoke but missing unit/integration depth.
- 🟥 **Gap** — no automated test yet; manual only.

---

## 1. Auth, session, and identity

| ID | Scenario | Layer | Status | Notes |
|----|----------|-------|--------|-------|
| AUTH-01 | `POST /auth/login` valid credentials → cookie/token + user | API smoke | 🟨 | smoke-core asserts `{ token, user }` shape; needs assertion that `Set-Cookie` is httpOnly once Phase 1 ships |
| AUTH-02 | `POST /auth/login` wrong password → 401 | Integration | 🟥 | add to api integration tests |
| AUTH-03 | `POST /auth/login` user `status != active` → 401 with reason | Integration | 🟥 | branch coverage for `invited`, `suspended`, `deactivated` |
| AUTH-04 | `POST /auth/login` rate-limited after N failures | Integration | 🟥 | requires Phase 2 throttle |
| AUTH-05 | `GET /auth/me` with valid session → user payload | API smoke | 🟨 | not currently in `smoke-core.mjs`; add it |
| AUTH-06 | `GET /auth/me` with invalid/expired token → 401 | Integration | 🟥 | |
| AUTH-07 | Logout clears cookie / invalidates session | Integration | 🟥 | requires Phase 1 |
| AUTH-08 | `POST /auth/dev-emergency` returns 403 in production | Unit + integration | 🟨 | code path exists ([apps/api/src/routes/auth.ts:113](apps/api/src/routes/auth.ts)); add a test that boots in `NODE_ENV=production` and asserts 403 / 404 |
| AUTH-09 | `POST /auth/dev-emergency` returns 403 when env flag off (dev) | Integration | 🟥 | |
| AUTH-10 | `POST /auth/invite/accept` with valid token | Integration | 🟥 | currently exercised manually |
| AUTH-11 | Invite token cannot be reused after `acceptedAt` | Integration | 🟥 | |
| AUTH-12 | Privilege change bumps `tokenVersion` and invalidates outstanding sessions | Integration | 🟥 | |
| AUTH-13 | `Authorization` header **and** cookie are both supported during transition | Integration | 🟥 | only relevant during Phase 1 cutover |
| AUTH-14 | CSRF token required on POST/PATCH/DELETE | Integration | 🟥 | requires Phase 1 |

## 2. Role access and authorization

| ID | Scenario | Layer | Status | Notes |
|----|----------|-------|--------|-------|
| ROLE-01 | `platform_owner` can access `/admin/users/*` | API smoke | 🟨 | `GET /admin/users` is in smoke; mutations are not |
| ROLE-02 | Non-`platform_owner` gets 403 on `/admin/users/invite` | Integration | 🟥 | |
| ROLE-03 | `payroll_admin` cannot access finance write routes | Integration | 🟥 | |
| ROLE-04 | `employee_tracker_user` is restricted to `/time/self/*` and `/staff/self/*` | Integration | 🟥 | |
| ROLE-05 | Non-PII document download by an unauthorized role → 403 | Integration | 🟥 | NHI/work-permit/ID restricted to platform_owner, hr_admin, payroll_admin |
| ROLE-06 | Suspended user's existing session is rejected | Integration | 🟥 | |

## 3. People (employees and templates)

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| PPL-01 | `GET /people/employees` list omits SSN/NHI/IRD/work permit | API smoke | 🟨 |
| PPL-02 | `GET /people/employees` shape `{ items: array }` | API smoke | 🟩 |
| PPL-03 | `POST /people/employees` requires platform_owner / hr_admin / payroll_admin to set government IDs | Integration | 🟥 |
| PPL-04 | `GET /people/employees/:id` returns masked PII for non-privileged role and full PII for privileged | Integration | 🟥 |
| PPL-05 | `PATCH /people/employees/:id` mutating PII writes audit log with redaction | Integration | 🟥 |
| PPL-06 | `DELETE /people/employees/:id` (or soft delete) cannot orphan time entries / paystubs | Integration | 🟥 |
| PPL-07 | Deduction template CRUD round-trip | Integration | 🟥 |
| PPL-08 | Template deletion blocked when in use by an Employee or TimeEntry | Integration | 🟥 |

## 4. Employee documents (HR uploads)

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| DOC-01 | Upload happy path (PDF, ≤ size cap) | Integration | 🟥 |
| DOC-02 | Upload with disallowed MIME type → 400 | Integration | 🟥 |
| DOC-03 | Upload over size cap → 400 / 413 | Integration | 🟥 |
| DOC-04 | Path traversal in filename rejected | Unit | 🟥 |
| DOC-05 | List omits `deletedAt != null` rows | Integration | 🟥 |
| DOC-06 | Download a soft-deleted document → 404 | Integration | 🟥 |
| DOC-07 | PII document download by `operations_manager` → 403 | Integration | 🟥 |
| DOC-08 | Profile photo binary endpoint returns correct content-type | Integration | 🟥 |
| DOC-09 | Once on object storage: signed URL expires; reused URL after expiry → 403 | Integration | ⬜ (pending P0-4) |

## 5. Time entries (admin and employee)

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| TIME-01 | `GET /time/entries?queue=all` shape | API smoke | 🟩 |
| TIME-02 | `GET /time/entries/count?queue=all&status=submitted` shape | API smoke | 🟩 |
| TIME-03 | `POST /time/entries/bulk-approve` requires manager role; non-manager → 403 | Integration | 🟥 |
| TIME-04 | Approving an already-paid entry is rejected | Integration | 🟥 |
| TIME-05 | `GET /time/self/profile` returns linked employee for `employee_tracker_user` | Integration | 🟥 |
| TIME-06 | `POST /time/self/entries` then `POST /time/self/entries/:id/submit` lifecycle | Integration | 🟥 |
| TIME-07 | Employee cannot edit a submitted (non-draft) line via self routes | Integration | 🟥 |
| TIME-08 | `POST /time/preview` produces same gross/deductions as a saved entry would | Unit | 🟨 (`payroll-utils.test.ts` covers helpers; preview itself isn't tested) |

## 6. Payroll (period → run → paystub → export)

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| PAY-01 | `GET /payroll/periods` shape | API smoke | 🟩 |
| PAY-02 | `POST /payroll/periods` then `POST /payroll/runs` then rebuild → finalize → export → mark-paid happy path | Integration | 🟥 |
| PAY-03 | Finalize fails on a period with zero matching time entries | Integration | 🟥 |
| PAY-04 | Re-running rebuild on a finalized run is a no-op or 409 (whichever the API contract says) | Integration | 🟥 |
| PAY-05 | `GET /payroll/paystubs/:id` returns the printable payload for a valid id | API smoke | 🟥 |
| PAY-06 | Export CSV row count matches PayRunItem count for the run | Integration | 🟥 |
| PAY-07 | Audit entries written for finalize and mark-paid | Integration | 🟥 |
| PAY-08 | Payroll calculations: existing helper unit tests | Unit | 🟩 ([apps/api/src/lib/payroll-utils.test.ts](apps/api/src/lib/payroll-utils.test.ts)) |

## 7. Finance (invoices, payments, bills, expenses, deposits)

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| FIN-01 | `GET /finance/accounts` shape | API smoke | 🟩 |
| FIN-02 | `GET /finance/invoices` shape | API smoke | 🟩 |
| FIN-03 | Invoice create → send → void lifecycle | Integration | 🟥 |
| FIN-04 | Bill create → receive → void lifecycle | Integration | 🟥 |
| FIN-05 | Payment apply, then unapply, restores invoice balance | Integration | 🟥 |
| FIN-06 | Expense post → void writes inverse audit entry | Integration | 🟥 |
| FIN-07 | Deposit post groups available payments and rejects already-deposited ones | Integration | 🟥 |
| FIN-08 | `scripts/smoke-finance-{a,b,c}.mjs` exposed as `npm` scripts and runnable | API smoke | 🟥 — see [DOC_DRIFT_FINDINGS.md](DOC_DRIFT_FINDINGS.md) |
| FIN-09 | Voiding a posted document does not silently mutate locked periods (once closing controls exist) | Integration | ⬜ (pending P1-3) |

## 8. Audit log

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| AUD-01 | `GET /audit/recent?take=5` shape | API smoke | 🟩 |
| AUD-02 | `take` query is capped at 200 | Integration | 🟥 |
| AUD-03 | Non-authorized role gets 403 | Integration | 🟥 |
| AUD-04 | Sensitive PII fields are redacted in `before` / `after` payloads | Unit | 🟥 — write a fixture-based test |
| AUD-05 | Auth events (login, dev-emergency, invite accept) appear in audit | Integration | 🟥 |

## 9. Employee tracker submit flow

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| TRK-01 | `/login` page loads (200 or redirect) | Admin smoke (tracker variant) | 🟥 — current admin smoke does not include tracker port `:3001`; add a tracker-smoke counterpart |
| TRK-02 | After login, `/` shows linked employee profile, not marketing landing | E2E | 🟥 |
| TRK-03 | Create draft → edit → submit lifecycle for time entry | E2E | 🟥 |
| TRK-04 | Submitted entries cannot be edited from tracker UI | E2E | 🟥 |
| TRK-05 | Submit a `STAFF_REQUEST` of each allowed type | E2E | 🟥 |
| TRK-06 | Cancel a `SUBMITTED` request from tracker | E2E | 🟥 |

## 10. Cross-cutting smoke

| ID | Scenario | Layer | Status |
|----|----------|-------|--------|
| SMK-01 | `npm run smoke:core` passes | API smoke | 🟩 (when API + DB seeded) |
| SMK-02 | `npm run smoke:admin` passes | Admin smoke | 🟩 (when admin running) |
| SMK-03 | `npm run smoke:all` runs both | Smoke | 🟩 |
| SMK-04 | `npm run typecheck` clean | CI | 🟥 (no CI yet — see roadmap P0-1) |
| SMK-05 | `npm run lint` clean | CI | 🟥 |
| SMK-06 | `npm run build` clean | CI | 🟥 |
| SMK-07 | `npm audit` no high/critical | CI | 🟥 |

---

## Coverage gap summary (what to build, in order)

1. **Wire CI** so SMK-04..07 actually run on every PR.
2. **Add API integration test harness** (Hono app + ephemeral SQLite or in-memory Prisma test DB). Most of the 🟥 rows in §1, §2, §4–§8 land there.
3. **Expose `smoke-finance-{a,b,c}.mjs`** as `npm` scripts (`finance:smoke:a` …) or fold their checks into `smoke-core.mjs`. See [DOC_DRIFT_FINDINGS.md](DOC_DRIFT_FINDINGS.md).
4. **Add tracker smoke** counterpart for `:3001`.
5. **Add Playwright** for the E2E rows once CI is green.

---

## Playwright E2E flows (future)

These are the priority flows for the first Playwright suite. Do not start before §10 SMK-04..06 are green in CI.

1. **Admin login → dashboard → people → create employee → upload document → log out.**
2. **Admin payroll close-out:** create period → create run → rebuild → finalize → export CSV → open paystub.
3. **Admin time approval:** open approvals queue → bulk-approve a known submitted entry → confirm `paid` lifecycle is unchanged.
4. **Admin finance:** create invoice → send → record payment → unapply → void.
5. **Tracker employee:** login → submit time entry → submit a TIME_OFF staff request → cancel it.
6. **Cross-app:** admin creates a tracker-shared sign-in URL → employee uses it → admin sees the new submission.

Each flow asserts: the UI happy path completes; a corresponding audit entry exists; the relevant API smoke check still passes after the flow.
