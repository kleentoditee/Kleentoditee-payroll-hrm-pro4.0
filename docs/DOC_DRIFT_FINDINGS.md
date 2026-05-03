# Documentation Drift Findings

**Owner:** Agent 2 — Security, Compliance, QA, and Architecture Reviewer
**Goal:** Capture every place where existing docs claim something the code does not actually back, or vice versa. This is the worklist for follow-up doc-cleanup PRs.

Scope: read-only audit, performed 2026-05-03 against branch `main`. Findings are **observations**, not fixes — fixes ship as small follow-up PRs.

---

## Severity legend

- 🟥 **High** — readers will be misled into broken setup steps or false security assumptions.
- 🟨 **Medium** — wording mismatch or inventory gap that a careful reader can recover from.
- 🟩 **Low** — cosmetic or style; record for completeness.

---

## Finding 1 — `scripts/smoke-finance-{a,b,c}.mjs` exist but are not exposed via `npm`

**Severity:** 🟨 Medium
**Where:**
- Files present in repo: `scripts/smoke-finance-a.mjs`, `scripts/smoke-finance-b.mjs`, `scripts/smoke-finance-c.mjs`.
- [package.json](package.json) only registers `smoke:core`, `smoke:admin`, `smoke:all` — none of the finance variants.
- [docs/coderabbit-report-for-chatgpt-review.md](docs/coderabbit-report-for-chatgpt-review.md) already calls out the ambiguity (lines 71–79): "may exist only in another worktree".

**Why it's drift:** A new agent following the smoke-test guide ([docs/stability-and-smoke-tests.md](docs/stability-and-smoke-tests.md)) will not know these scripts exist; an agent looking at `scripts/` will not know how to run them.

**Recommended fix (separate small PR):**
- Either expose them as `npm run smoke:finance` (a single combined runner) and reference them from [stability-and-smoke-tests.md](stability-and-smoke-tests.md), **or**
- delete the three orphaned scripts if the checks they perform are already covered elsewhere.
- Either way, the QA matrix row FIN-08 in [QA_TEST_MATRIX.md](QA_TEST_MATRIX.md) flips to 🟩 once this is resolved.

---

## Finding 2 — Auth strategy in architecture doc is "TBD" while admin-web is shipping `localStorage` JWTs

**Severity:** 🟥 High
**Where:**
- [docs/architecture/2026-04-20-platform-tech-decisions.md](docs/architecture/2026-04-20-platform-tech-decisions.md) line 15: *"Auth (production): TBD — shortlist Clerk, WorkOS, or Auth.js. Phase 1 uses a dev placeholder only until roles/SSO requirements are fixed."*
- Reality: [apps/admin-web/src/lib/auth-storage.ts](apps/admin-web/src/lib/auth-storage.ts) stores the JWT in `localStorage` and is being used as the production-style path; the dev-placeholder phrasing implies otherwise.

**Why it's drift:** Anyone reading the architecture doc believes auth is still a placeholder; anyone reading the running app sees a real session pattern in active use. The two readings disagree about how serious the auth surface area is.

**Recommended fix:**
- Update the architecture doc to reference [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md) and state the current state honestly: *"in-house bearer JWT in `localStorage` today; staged migration to httpOnly cookie session in progress."*
- Remove the "dev placeholder only" wording.

---

## Finding 3 — `EMPLOYEE_TRACKER_PUBLIC_URL` and `NEXT_PUBLIC_EMPLOYEE_TRACKER_URL` are both documented; one is enough

**Severity:** 🟨 Medium
**Where:**
- [.env.example](.env.example) lines 27–32 list **two** envs that point at the same tracker URL: `EMPLOYEE_TRACKER_PUBLIC_URL` (server-side, used by API) and `NEXT_PUBLIC_EMPLOYEE_TRACKER_URL` (client-side fallback for admin).
- The reasoning is plausible (server vs client) but the file does not explain why both are needed and when the second one is actually used.

**Why it's drift:** A reader will guess they're duplicates and remove the wrong one in deployment configs.

**Recommended fix:** Add a short comment block to `.env.example` stating which one is read by which app and under what fallback condition. Cross-reference [docs/employee-tracker-sharing.md](docs/employee-tracker-sharing.md).

---

## Finding 4 — `.env.example` says "Min ~32 chars in production" but boot only checks "non-empty"

**Severity:** 🟥 High
**Where:**
- [.env.example](.env.example) line 11: `# Min ~32 chars in production. Dev default is fine for localhost only.`
- [apps/api/src/env.ts:33](apps/api/src/env.ts) (`assertApiBootEnv`) only enforces `process.env.JWT_SECRET?.trim()` is non-empty. The dev placeholder string itself would satisfy the boot check on a production server.

**Why it's drift:** Documentation creates a false sense of safety. An ops engineer reading `.env.example` thinks the API will refuse to start with a weak secret. It will not.

**Recommended fix:** Match the doc with code — either tighten `assertApiBootEnv` to enforce length and reject the dev placeholder when `NODE_ENV=production`, or downgrade the `.env.example` comment to "you must enforce this yourself; the API does not validate it." The first option is preferred and is captured as security item **S-1** in [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md).

---

## Finding 5 — Architecture decisions list `BullMQ + Redis` and `S3-compatible storage` as decided, but neither is integrated

**Severity:** 🟨 Medium
**Where:**
- [docs/architecture/2026-04-20-platform-tech-decisions.md](docs/architecture/2026-04-20-platform-tech-decisions.md) lines 16–17: *"Object storage: S3-compatible … For documents and exports; wire in Phase 2+."* and *"Background jobs: BullMQ + Redis — When payroll/finance needs async processing; not required for Phase 1 scaffold."*
- Reality: HR documents are written to a local filesystem path ([apps/api/src/lib/employee-files.ts](apps/api/src/lib/employee-files.ts)); there is no queue, no Redis dependency, no S3 client.

**Why it's drift:** The phrasing reads as "decided and partially in flight" while the code says neither has been touched. New agents may assume an S3 wrapper or job runner exists somewhere.

**Recommended fix:** Reword the table cells with explicit status — e.g. `Choice: S3-compatible (not yet integrated; tracked in roadmap P0-4)`. Reference [ROADMAP_PRODUCTION_HARDENING.md](ROADMAP_PRODUCTION_HARDENING.md).

---

## Finding 6 — `/dashboard/schedule` and `/dashboard/settings` are described in two ways

**Severity:** 🟩 Low
**Where:**
- [docs/current-system-inventory.md](docs/current-system-inventory.md) §4 calls them "Coming soon placeholder routes".
- The same doc §5 lists them under "Stubs, placeholders, or 'phase later' in UI".

**Why it's drift:** Same status, two phrasings. Easy to read as if they're tracked separately.

**Recommended fix:** Pick one phrasing ("Coming soon placeholder, no feature UI yet") and use it consistently. Cross-reference [ROADMAP_PRODUCTION_HARDENING.md](ROADMAP_PRODUCTION_HARDENING.md) P1-2 so future agents know not to start them ahead of P0.

---

## Finding 7 — HANDOFF.md references `start-platform.bat` normalization but that script's current state isn't shown in scripts/

**Severity:** 🟩 Low
**Where:**
- [HANDOFF.md](HANDOFF.md) line 95 mentions `start-platform.bat` was normalized to ASCII.
- `ls scripts/` shows `bootstrap-env.cmd`, `copy-project-to-c-dev.bat`, `kill-dev-ports.ps1`, etc., but no `start-platform.bat` at the repo root visible in the survey above.

**Why it's drift:** Either the file lives at the repo root (not under `scripts/`) and the doc never says so, or it was renamed/removed and the verification log is stale.

**Recommended fix:** A follow-up reviewer should locate the file and either fix the path in HANDOFF.md or remove the dated verification line if obsolete. Low priority — does not affect production correctness.

---

## Finding 8 — Smoke-test doc shows Windows `set` syntax for env overrides but Bash session expects POSIX exports

**Severity:** 🟩 Low
**Where:**
- [docs/stability-and-smoke-tests.md](docs/stability-and-smoke-tests.md) lines 36, 71, 91 use `set VAR=value`, which is `cmd.exe`-only.

**Why it's drift:** Repo runs on Windows but agents may be in WSL/bash; the bash equivalent (`VAR=value npm run …`) isn't shown.

**Recommended fix:** Add a one-liner showing both `cmd` and `bash` forms, or pick one and standardize.

---

## Finding 9 — `current-system-inventory.md` says "JWT to localStorage" matter-of-factly without warning

**Severity:** 🟨 Medium
**Where:**
- [docs/current-system-inventory.md](docs/current-system-inventory.md) §4 row for `/login`: *"Admin sign-in (JWT to localStorage; API calls use authHeaders())."*

**Why it's drift:** This is presented as the architecture, not as a known security debt. New contributors will treat it as the target design rather than the migration starting point.

**Recommended fix:** Add a footnote pointing at [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) **A-1** and [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md) Phase 1 so the inventory and the security position agree.

---

## Finding 10 — `docs/coderabbit-report-for-chatgpt-review.md` lives in `docs/` but is a transcript, not a doc

**Severity:** 🟩 Low
**Where:**
- [docs/coderabbit-report-for-chatgpt-review.md](docs/coderabbit-report-for-chatgpt-review.md)

**Why it's drift:** It's a one-off review artifact that future agents may mistake for a maintained doc. Mixing transcripts with reference docs muddies the `docs/` index.

**Recommended fix:** Move under a `docs/reviews/` (or `docs/archive/`) sub-folder, or add a top-of-file banner: *"Archived review notes — not maintained."* Low-priority cleanup.

---

## Out of scope for this report

- Checking that every API route in [docs/current-system-inventory.md](docs/current-system-inventory.md) §2 still matches the current Hono routes — that is large and should be its own audit pass tied to the next inventory refresh.
- Detecting drift in the package READMEs under `packages/` (not part of the priority docs).
- Inspecting `docs/research/` and `docs/superpowers/` — those subfolders weren't surveyed for this pass.

---

## Suggested follow-up PRs

Each of these is small and focused; none should bundle multiple findings.

1. **`docs/architecture: reflect current auth and storage state`** — fixes findings 2, 5, 9.
2. **`infra: validate JWT_SECRET and DATABASE_URL in production boot`** — fixes finding 4 (also closes security item S-1, S-2).
3. **`scripts: expose or remove smoke-finance scripts`** — fixes finding 1, closes QA matrix FIN-08.
4. **`docs/.env.example: clarify tracker URL envs`** — fixes finding 3.
5. **`docs: tidy schedule/settings phrasing and archive review transcript`** — fixes findings 6 and 10.
