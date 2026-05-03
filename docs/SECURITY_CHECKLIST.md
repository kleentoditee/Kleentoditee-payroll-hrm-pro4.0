# Security Checklist

**Owner:** Agent 2 — Security, Compliance, QA, and Architecture Reviewer
**Scope:** Concrete, code-anchored items that must be true before this platform handles real payroll, HR, or finance data in production.
**How to use:** Each row is a binary check. PR reviewers compare claimed status against current code; "✅" is only valid with a code or commit pointer.

Companion: [ROADMAP_PRODUCTION_HARDENING.md](ROADMAP_PRODUCTION_HARDENING.md) · [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md)

---

## Status legend

- 🟥 **Open** — not implemented, exposes risk today.
- 🟨 **Partial** — some defensive code exists but the control is incomplete or relies on configuration.
- 🟩 **Implemented** — code path matches the requirement; reviewer has verified.
- ⬜ **Not applicable yet** — deliberate scope deferral; revisit at the named trigger.

---

## 1. Authentication and session

| ID | Control | Today | Target | Pointers |
|----|---------|-------|--------|----------|
| A-1 | **No JWT in `localStorage`** | 🟥 | Session is held only in an httpOnly, Secure, SameSite=Lax cookie. | [apps/admin-web/src/lib/auth-storage.ts](apps/admin-web/src/lib/auth-storage.ts) currently uses `localStorage` |
| A-2 | **httpOnly + Secure + SameSite cookie** | 🟥 | API issues `Set-Cookie` on `/auth/login` with `HttpOnly; Secure; SameSite=Lax; Path=/`. Production sets `Secure` unconditionally; dev allows `Secure=false` over `http://localhost`. | New work; see [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md) Phase 1 |
| A-3 | **CSRF protection on state-changing requests** | 🟥 | Once cookies are used, every POST/PATCH/DELETE either requires a `X-CSRF-Token` header validated against a signed token, or a `SameSite=Strict` cookie + same-origin enforcement. | Hono middleware to be added next to existing CORS at [apps/api/src/app.ts:21](apps/api/src/app.ts) |
| A-4 | **Login throttling** | 🟥 | Per-email and per-IP rate limit on `/auth/login` (e.g. 10/minute per IP, exponential backoff per email). Emergency, register, and invite-accept routes also throttled. | [apps/api/src/routes/auth.ts](apps/api/src/routes/auth.ts) |
| A-5 | **Password reset flow** | 🟥 | Token-based reset with single-use, short-lived (≤30 min), bcrypt-hashed token in DB; resets bump `tokenVersion` to invalidate sessions. | New endpoint(s) under `/auth/*` |
| A-6 | **MFA for privileged roles** | 🟥 | TOTP (or WebAuthn) required for `platform_owner`, `hr_admin`, `payroll_admin`, `finance_admin` before they can change roles, run payroll, or view PII documents. Recovery codes issued at enrollment. | New work post-cookie cutover |
| A-7 | **Argon2id review** | 🟨 | Decide: keep `bcryptjs` cost 12 (current) or migrate hashes to `argon2id` on next login. Either way: documented decision, no silent drift. | [apps/api/src/routes/auth.ts:34](apps/api/src/routes/auth.ts) (`bcrypt.hash(password, 12)`) |
| A-8 | **`tokenVersion` invalidation on privilege change** | 🟨 | `User.tokenVersion` exists in schema; verify every role/status mutation in `admin-users.ts` bumps it. PR reviewers must check this for any new auth-touching code. | [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) `User.tokenVersion` |

## 2. Dev emergency login

| ID | Control | Today | Target |
|----|---------|-------|--------|
| D-1 | **`/auth/dev-emergency` cannot exist in production** | 🟨 | The route currently returns 403 in production via runtime `NODE_ENV` check ([apps/api/src/routes/auth.ts:113](apps/api/src/routes/auth.ts)). Target: **route is not even mounted** in production builds (compile-time exclusion or a top-level `if (process.env.NODE_ENV !== "production")` guard at registration), so the URL returns 404 not 403. |
| D-2 | **`ALLOW_DEV_EMERGENCY_LOGIN` cannot leak through env** | 🟥 | API startup must hard-fail when `NODE_ENV === "production"` and `ALLOW_DEV_EMERGENCY_LOGIN` is truthy. Today only a console log warns ([apps/api/src/env.ts:10](apps/api/src/env.ts)). |
| D-3 | **`/dev/db-status` is dev-only** | 🟩 | Mounted only when `NODE_ENV !== "production"` ([apps/api/src/app.ts:71](apps/api/src/app.ts)). Reviewer must keep it that way. |

## 3. Transport, CORS, and headers

| ID | Control | Today | Target |
|----|---------|-------|--------|
| T-1 | **Production CORS allowlist** | 🟨 | Allowlist driven by `CORS_ALLOWED_ORIGINS` ([apps/api/src/app.ts:21](apps/api/src/app.ts)). Target: deploy fails if the env is unset in prod (no silent fallback to `localhost:3000`). |
| T-2 | **HTTPS enforced upstream** | ⬜ | Decide at deploy. Document the platform (Fly.io / Vercel / Caddy) that terminates TLS; require HSTS at the edge. |
| T-3 | **Security headers** | 🟥 | Add a Hono middleware (or edge config) for `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` (or CSP `frame-ancestors`). |
| T-4 | **Content Security Policy** | 🟥 | At least a baseline CSP for admin-web that disallows inline scripts (Next.js can be configured with nonces). Tracker app gets the same baseline. |
| T-5 | **No Authorization header in URL or query** | 🟩 | All routes use `Authorization: Bearer …` headers; no token-in-URL. Keep enforced when migrating to cookies. |

## 4. Secret and config validation

| ID | Control | Today | Target |
|----|---------|-------|--------|
| S-1 | **`JWT_SECRET` minimum entropy in production** | 🟥 | `assertApiBootEnv` ([apps/api/src/env.ts:33](apps/api/src/env.ts)) only checks "not empty". Target: in production, require ≥ 32 bytes and reject the dev placeholder string. |
| S-2 | **`DATABASE_URL` shape check** | 🟨 | Boot fails on missing URL; doesn't enforce postgres in production. Target: in production, refuse `file:` (SQLite) URLs with a clear error. |
| S-3 | **No real secrets in `.env.example`** | 🟩 | The placeholder `JWT_SECRET` in [.env.example](.env.example) is clearly marked dev-only; reviewer must keep it that way. |
| S-4 | **Env vars never logged** | 🟨 | `[api] Emergency passwordless login is ON …` is a known log; no secret values are emitted. Keep this discipline when adding boot diagnostics. |

## 5. Audit logging and PII

| ID | Control | Today | Target |
|----|---------|-------|--------|
| L-1 | **Audit log writes happen on auth and privileged mutations** | 🟩 | `writeAudit` is called on register, login, dev-emergency, invite accept, employee mutations, staff request status changes. Reviewer must verify any new privileged route also writes audit. |
| L-2 | **Audit log redaction of PII** | 🟨 | Inventory states "audit redacts PII" for employee detail; verify every new audit `before/after` payload either omits or masks SSN, NHI, IRD, work permit, password hashes, tokens. Add a unit test that asserts redaction. |
| L-3 | **Append-only audit log** | 🟨 | Schema is append-only by convention; at the application layer ensure no `update`/`delete` calls land in `auditLog`. Optional DB-level `REVOKE UPDATE, DELETE` on the audit table once on Postgres. |
| L-4 | **PII masking in list responses** | 🟩 | `/people/employees` list omits SSN/NHI/IRD/work permit; detail response is gated by role. Reviewer must keep new endpoints aligned. |
| L-5 | **Sensitive fields cannot be set by employee self-service** | 🟩 | Staff request `requestedContactUpdate` is restricted to a fixed allowlist; SSN/NHI/IRD never accepted ([docs/current-system-inventory.md](docs/current-system-inventory.md) §2). Keep enforced for any new self-service route. |

## 6. HR document storage

| ID | Control | Today | Target |
|----|---------|-------|--------|
| H-1 | **No raw filesystem in production** | 🟥 | Files written under `UPLOADS_DIR` via `writeFileSync` ([apps/api/src/lib/employee-files.ts](apps/api/src/lib/employee-files.ts)). Target: S3/R2 with server-side encryption; production bootstrap refuses local-disk uploads. |
| H-2 | **Path traversal cannot occur** | 🟨 | All filenames must be normalized and never include `..`. Add a unit test that rejects `../` and absolute paths regardless of storage backend. |
| H-3 | **Document download authorization** | 🟩 | PII document types (NHI, work permit, ID) restricted to `platform_owner`, `hr_admin`, `payroll_admin` ([docs/current-system-inventory.md](docs/current-system-inventory.md) §2). Reviewer must keep this gate when moving to object storage. |
| H-4 | **Soft-deleted documents are inaccessible** | 🟨 | Soft-delete via `deletedAt`. Verify download routes always filter `deletedAt: null`. Add a regression test. |
| H-5 | **MIME / size limits** | 🟥 | Enforce explicit allow-list of MIME types per `EmployeeDocumentType` and a hard size cap (e.g. 15 MB) at the API boundary. |
| H-6 | **Antivirus / malware scan** | ⬜ | Defer until object storage lands. Then either ClamAV-as-a-service or the cloud provider's built-in scanning. |

## 7. Compliance and data handling

| ID | Control | Today | Target |
|----|---------|-------|--------|
| C-1 | **Data retention policy** | 🟥 | Document the retention window for: audit logs, employee documents, terminated-employee records, time entries. Codify the cut-off in a scheduled job (P1+). |
| C-2 | **Subject-access export** | 🟥 | An authorized HR admin must be able to export an employee's full record (employee row, documents, time entries, paystubs) in a structured form. |
| C-3 | **Right to erasure boundary** | 🟥 | Define what "erase" means against payroll and audit (which are legally retained). Document the policy before building tooling. |
| C-4 | **Backup of production DB and object storage** | 🟥 | Encrypted off-site backups; documented restore drill. Required before first production launch. |
| C-5 | **Vendor inventory** | 🟥 | Maintain a list of every third-party that touches PII (DB host, object storage, email provider, log aggregator) with each vendor's data-processing posture. |

## 8. Dependency and supply chain

| ID | Control | Today | Target |
|----|---------|-------|--------|
| Dep-1 | **`npm audit` in CI** | 🟥 | CI fails on `high` or `critical` advisories. |
| Dep-2 | **Renovate / Dependabot** | 🟥 | Weekly PRs to bump dependencies; auto-merge for patch updates after CI green. |
| Dep-3 | **Lockfile committed** | 🟩 | `package-lock.json` is the workspace lockfile (`packageManager: npm@11.11.0`). Keep it the only lockfile. |
| Dep-4 | **No unsigned post-install scripts in new deps** | 🟨 | Reviewer must spot-check `package.json` for new packages with install scripts. |

## 9. PR-level reviewer checks (use this whenever an agent opens a PR)

- [ ] Does the PR change auth, storage, or schema? If yes, is there a rollback plan?
- [ ] If response shapes change, is `scripts/smoke-core.mjs` updated and passing?
- [ ] If a new privileged route is added, does it write an audit log entry?
- [ ] If a new env var is introduced, is it validated in [apps/api/src/env.ts](apps/api/src/env.ts)?
- [ ] If a new dev-only route is added, is it gated `if (process.env.NODE_ENV !== "production")` at registration?
- [ ] If a new PII field is added to schema, is it omitted from list responses and redacted in audit?
- [ ] If a new file upload path is added, is it covered by H-2/H-3/H-5?
- [ ] If a new dependency is introduced, did `npm audit` run?
- [ ] Are tests added or is the gap explicitly stated in the PR body?

A PR that fails any of the boxes above must be either updated or held until the gap is documented.

---

## Out of scope here (handled elsewhere)

- The staged migration to httpOnly cookie sessions: see [AUTH_SESSION_MIGRATION_PLAN.md](AUTH_SESSION_MIGRATION_PLAN.md).
- The QA matrix that exercises these controls: see [QA_TEST_MATRIX.md](QA_TEST_MATRIX.md).
- Doc-versus-code drift findings: see [DOC_DRIFT_FINDINGS.md](DOC_DRIFT_FINDINGS.md).
