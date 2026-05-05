# Production Hardening Roadmap

**Owner:** Agent 2 — Security, Compliance, QA, and Architecture Reviewer
**Status:** Source of truth for sequencing. Update this file when priorities change; do not start work that contradicts it.
**Companion docs:**
[SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) ·
[AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md) ·
[QA_TEST_MATRIX.md](QA_TEST_MATRIX.md) ·
[DOC_DRIFT_FINDINGS.md](DOC_DRIFT_FINDINGS.md)

---

## North-star decision

> **Continue the existing monorepo. Do NOT rewrite this project.**

The audit confirmed the repo already has solid domain coverage (people, time, payroll, finance, audit, staff requests) and a defensible modular-monolith direction. The bottleneck is **production readiness**, not architecture. The work in this roadmap hardens what exists; it does not redesign it.

A future agent who finds themselves about to "redo" auth, "split" the API into services, or "replace" Prisma should stop and re-read this section.

---

## Priority order

Every priority in **P0** must be in flight or done before any **P1** is started. Within a priority, items can run in parallel as long as they live on independent branches and small PRs.

### P0 — platform hardening (blockers for any production deploy)

| # | Item | Why | Acceptance signal |
|---|------|-----|-------------------|
| P0-1 | **CI/CD + branch safety** | No automated build/test/lint runs on PRs today (no `.github/workflows`). Every claim of "green" is manual. | GitHub Actions runs `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run test --workspace api` on every PR. Branch protection requires the workflow to pass. |
| P0-2 | **Auth/session safety** | Admin-web stores the JWT in `localStorage` ([apps/admin-web/src/lib/auth-storage.ts](apps/admin-web/src/lib/auth-storage.ts)) — readable by any XSS. The `dev-emergency` route is gated by `NODE_ENV !== "production"` only — one misconfigured env var lets an attacker log in as the first user. | httpOnly cookie session + CSRF in place; emergency route guarded at build time, not just env. See [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md). |
| P0-3 | **Database migration workflow** | Today: SQLite + `prisma db push` ([packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) `provider = "sqlite"`). `db push` is destructive and has no migration history. Production cannot run on SQLite at this scale. | PostgreSQL is the default for non-local environments. Schema changes go through `prisma migrate dev` → `prisma migrate deploy` with versioned migration files committed. SQLite remains an opt-in for local dev only. |
| P0-4 | **HR document storage** | Employee documents (NHI / work permit / ID / contracts) are written to a local filesystem path via `UPLOADS_DIR` ([apps/api/src/lib/employee-files.ts](apps/api/src/lib/employee-files.ts)). One container restart on a managed host loses the files; one path-traversal bug exfiltrates them. | S3-compatible object storage (AWS S3 or Cloudflare R2), server-side encryption at rest, signed-URL access patterns, no raw filesystem in production. |

### P1 — production polish (once P0 is done)

| # | Item | Why | Acceptance signal |
|---|------|-----|-------------------|
| P1-1 | **Observability + structured logging** | Today the API emits ad-hoc `console.log`/`console.error` strings. No request ID, no level, no JSON. Outages will be diagnosed by reading raw stdout. | A request-scoped logger (pino or equivalent) emits JSON with level, request ID, user ID (when known), route, latency. Errors are captured to a single sink (e.g. Sentry or a log aggregator). |
| P1-2 | **Global search / settings / schedule** | Currently disabled tooltip / "Coming soon" pages ([docs/current-system-inventory.md](docs/current-system-inventory.md) §5). Useful, but not security or data-safety blockers. | Real spec, real implementation — only after the auth and storage foundation is solid. |
| P1-3 | **Finance ledger depth** | Schema is document-centric; `Account` has no period balance, no journal, no posting batches, no reconciliation. The product looks complete in lists but cannot close a period. | Journal entries, posting batches, account balances, reconciliation, and closing controls. Substantial work; do not start before P0 is closed. |

### P2 — backlog (do not start without explicit approval)

- SSO / IdP integration (decision deferred — see [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md) Phase 3).
- Multi-tenant org model.
- `@kleentoditee/ui` design system promotion.
- Background-job queue (BullMQ + Redis) — only when a real async workload demands it.

---

## Explicit non-goals

These are off the table for the foreseeable future. A PR proposing any of them needs an audit revision first.

1. **No rewrite.** Not the API stack, not the ORM, not the framework. Hono + Prisma stays.
2. **No microservices.** The platform is a modular monolith. Splits are not on the table.
3. **No new feature modules before hardening.** "Just a small new dashboard" is not allowed if it touches auth, storage, or schema before P0 closes.
4. **No frontend redesign.** Visual polish lands as small PRs; no big-bang rewrite of the admin shell or tracker.
5. **No removing existing domain models** unless a migration plan and a data backfill story land in the same PR.
6. **No replacing Prisma or Hono** because a newer library exists — argument from novelty is not an audit.

---

## Branch and PR rules

- Branch naming: `<area>/<short-slug>` (e.g. `docs/security-roadmap-qa`, `auth/cookie-session-phase1`, `infra/postgres-migration`).
- One PR per concern. Splits are cheap; conflated PRs are expensive.
- Every PR body must include: **Summary**, **Documents added/updated**, **Tests run** (or an explicit gap statement), **Follow-up risks**.
- Auth, storage, and schema changes additionally need: a **rollback plan** and a sign-off line from Agent 2 (the reviewer).
- Smoke checks (`npm run smoke:core` / `smoke:admin`) must still pass for any change that touches API response shapes.

---

## Review cadence

- This roadmap is reviewed when any P0 ships, when an audit revision lands, or when the team's hosting target changes (Vercel + Fly.io vs. self-hosted Docker, etc.).
- A change to "north-star" or "non-goals" requires the user's explicit sign-off, not just an agent's PR.
