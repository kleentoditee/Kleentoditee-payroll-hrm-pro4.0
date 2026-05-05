# Auth and Session Migration Plan

**Owner:** Agent 2 — Security, Compliance, QA, and Architecture Reviewer
**Goal:** Move admin-web and employee-tracker off `localStorage` JWTs and onto a server-issued, httpOnly cookie session, in small, reversible steps. Add the controls (throttling, password reset, MFA) that production needs without breaking the existing user/role/invite model.

Companion: [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) · [ROADMAP_PRODUCTION_HARDENING.md](ROADMAP_PRODUCTION_HARDENING.md)

---

## Current state (2026-05)

- API: Hono with `Authorization: Bearer <jwt>` header auth (`signSessionToken` in [apps/api/src/lib/token.ts](apps/api/src/lib/token.ts), validated by `authRequired` middleware).
- Admin-web: stores the JWT in `window.localStorage` ([apps/admin-web/src/lib/auth-storage.ts](apps/admin-web/src/lib/auth-storage.ts)) and attaches it via `authHeaders()`.
- Employee-tracker: same storage pattern.
- `User.tokenVersion` ([packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma)) is bumped on privilege changes to invalidate outstanding tokens.
- CSRF: none. CORS allowlist (`CORS_ALLOWED_ORIGINS`) is the only cross-origin gate.
- Throttling: none. Password reset: none. MFA: none.

The `tokenVersion` mechanism, role enum, and audit logging are good — those stay. The transport layer (`localStorage` + raw bearer header) is what changes.

---

## Hard constraints

These cannot be violated by the migration:

1. **No big-bang.** Each phase is reversible by feature flag or by reverting the PR.
2. **Existing logins keep working.** No forced password reset for the cutover.
3. **Roles, invitations, and `tokenVersion` keep working.** No schema rewrite.
4. **Two clients change in lockstep.** Admin-web and employee-tracker move together — they share `authHeaders()` patterns and the same `/auth/me` shape.
5. **Smoke tests stay green.** `npm run smoke:core` and `npm run smoke:admin` must pass after each phase.

---

## Phase 1 — httpOnly cookie session + CSRF (P0-2)

**Outcome:** No JWT is ever written to or read from JavaScript. Browsers send the session as a cookie. State-changing requests are CSRF-protected. Both web clients are migrated. The bearer-header path is removed once both clients are confirmed working.

### Server-side changes

1. Introduce a session cookie issuer at `/auth/login`, `/auth/invite/accept`, and `/auth/dev-emergency`:
   - Cookie name: `kleentoditee_session`.
   - Attributes: `HttpOnly; SameSite=Lax; Path=/; Max-Age=` (the existing token TTL).
   - `Secure` is required when `NODE_ENV === "production"`. In dev over `http://localhost`, `Secure=false` is acceptable.
2. The cookie value is the same signed session token already produced by `signSessionToken` (no new format). The `authRequired` middleware reads it from either the cookie **or** the existing `Authorization: Bearer` header during a transition window.
3. Add `POST /auth/logout`:
   - Clears the cookie (`Set-Cookie: kleentoditee_session=; Max-Age=0`).
   - Optionally bumps `tokenVersion` if the client requests "log out everywhere".
4. CSRF: add a Hono middleware that, for any non-`GET`/`HEAD`/`OPTIONS` request, requires either:
   - A `X-CSRF-Token` header that matches a signed CSRF cookie set at login (double-submit pattern), **or**
   - A `SameSite=Strict` enforcement plus an `Origin` / `Referer` check against `CORS_ALLOWED_ORIGINS`. Pick one and document it; do not ship both.
5. CORS update: when `credentials: "include"` is in use the API must respond with `Access-Control-Allow-Credentials: true` and a specific origin (not `*`). Wildcards are rejected.
6. Keep `/auth/me` unchanged in shape — only the auth source changes.

### Client-side changes (admin-web and employee-tracker)

1. Replace `getToken/setToken/clearToken/authHeaders()` with a no-op stub:
   - `apiFetch` adds `credentials: "include"` for every call.
   - `apiFetch` reads the CSRF token from a non-httpOnly companion cookie (e.g. `kleentoditee_csrf`) and sets `X-CSRF-Token` on POST/PATCH/DELETE.
2. Login page calls `POST /auth/login` with `credentials: "include"`; the response no longer contains a `token` field for the client to handle.
3. On logout, call `POST /auth/logout` then redirect to `/login`.
4. Remove all `localStorage.getItem("kleentoditee_admin_token")` references. Reviewer greps to confirm zero hits.

### Acceptance for Phase 1

- `grep -r "localStorage" apps/admin-web/src apps/employee-tracker/src` returns nothing token-related.
- `curl -i POST /auth/login` returns a `Set-Cookie: kleentoditee_session=…; HttpOnly; SameSite=Lax`.
- A POST without `X-CSRF-Token` (or with a wrong value) is rejected `403`.
- Smoke tests pass.

### Phase 1 rollback

- Feature-flag the cookie path with `AUTH_COOKIE_SESSION=on`. If a regression appears in prod, flip the flag off and the old bearer-header path resumes (kept for one full release after Phase 1 lands; removed in the cleanup PR after Phase 1 has been stable for 2 weeks).
- Revert PR is safe because no DB migration is required for Phase 1.

### Phase 1 testing

- Unit: cookie middleware sets attributes correctly under prod and dev `NODE_ENV`.
- Unit: CSRF middleware rejects mismatched / missing tokens, accepts valid pair.
- Integration: Playwright (or supertest) login → fetch `/auth/me` → mutate (employee update) → logout. Run with cookies, no header.
- Smoke: existing `npm run smoke:core` and `npm run smoke:admin` adapted to use cookies (the smoke client must capture `Set-Cookie` and replay it).
- Manual: log in on admin and tracker, restart API, confirm the session survives (or is correctly invalidated by `tokenVersion`).

---

## Phase 2 — login throttling, password reset, MFA for privileged roles (A-4, A-5, A-6)

**Outcome:** Brute-force is rate-limited. Users can recover access without an admin reissuing an invite. Privileged actions require a second factor.

### Login throttling (A-4)

1. Per-IP limit at the API edge: 10 failed attempts per minute, then exponential backoff up to 15 minutes. Successful logins reset the counter.
2. Per-email limit: 5 failed attempts per 15 minutes, regardless of IP.
3. Apply to `/auth/login`, `/auth/invite/accept`, `/auth/dev-emergency` (in dev), and password reset confirm endpoint.
4. Storage: in-memory cache for single-node deploys; Redis when the platform scales out (don't introduce Redis for this alone — wait for the first actual need).
5. Audit log: every blocked attempt writes an audit entry (`auth.login.throttled`).

### Password reset (A-5)

1. New tables (additive migration; no rename):
   - `PasswordResetToken { id, userId, tokenHash, expiresAt, usedAt }`.
2. New endpoints:
   - `POST /auth/password/forgot` — accepts `{ email }`, always returns 202 (no enumeration), enqueues an email if the user exists.
   - `POST /auth/password/reset` — accepts `{ token, newPassword }`, validates, rotates `passwordHash`, bumps `tokenVersion`, marks token used.
3. Token TTL: 30 minutes; single use; bcrypt-hashed at rest; never returned in API responses.
4. Email transport: the same provider that sends invitations. If invitations are still console-only at the time of this work, password reset is also dev-only until the email provider is wired.
5. Audit: writes for `auth.password.reset_requested` and `auth.password.reset_complete`.

### MFA for privileged roles (A-6)

1. Roles requiring MFA: `platform_owner`, `hr_admin`, `payroll_admin`, `finance_admin`. `operations_manager` and `site_supervisor` are recommended but not blocking.
2. TOTP first (RFC 6238), with WebAuthn as an additive option later.
3. New tables (additive):
   - `UserMfaSecret { userId, secretEnc, confirmedAt }` (encrypt at rest with a key derived from `JWT_SECRET` or a dedicated `MFA_KEY`).
   - `UserMfaRecoveryCode { id, userId, codeHash, usedAt }`.
4. New endpoints under `/auth/mfa/*`:
   - `POST /auth/mfa/enroll/start` (returns provisioning URI / QR), `POST /auth/mfa/enroll/confirm` (verifies first TOTP).
   - `POST /auth/mfa/challenge` during login.
   - `POST /auth/mfa/recovery` to consume a recovery code.
5. Login flow:
   - Phase 2.0: MFA optional, opt-in only for users who enroll.
   - Phase 2.1: MFA required for the privileged role list — login returns a `mfa_required` step before issuing the session cookie.
6. Audit: enrollment, success, failure, recovery use, and admin-initiated reset.

### Phase 2 rollback

- Throttle and password reset are additive; rollback is "remove the feature flag" for throttle and revert the migration for the new tables.
- MFA mandatory enforcement is gated behind a configuration flag (`MFA_REQUIRED_ROLES`). Flip it back to empty to restore the pre-MFA login path while leaving enrolled users untouched.

### Phase 2 testing

- Unit: throttle window math; reset-token issue/consume/expiry; TOTP secret encrypt/decrypt; recovery-code one-shot consume.
- Integration: full forgot → reset → login flow (cookie); enroll-then-challenge MFA login; admin disable MFA on a user (audit log written).
- Adversarial: 20 wrong passwords in 30 seconds → blocked; reuse of consumed reset token → 400; reuse of consumed recovery code → 400; MFA challenge with wrong code → audit + retry counter.

---

## Phase 3 — SSO / IdP decision (deferred)

**Outcome:** A documented decision, not necessarily an implementation. Pre-requisite: the org's identity strategy is settled (Google Workspace? Microsoft 365? Okta? Self-hosted?).

### Options on the table

| Option | Pros | Cons |
|--------|------|------|
| **WorkOS / Clerk-style hosted auth** | Fastest path; SAML/OIDC out of the box; MFA managed. | New vendor; cost; lock-in; PII handling. |
| **Auth.js (NextAuth) + provider plugins** | Open source; aligns with Next.js admin. | More integration glue; still need to handle CSRF / cookies. |
| **Stay on the in-house cookie session, add OIDC client only when needed** | Lowest dependency; reuses Phase 1/2. | More code to own. |

### What to deliver in Phase 3

- A decision memo recording the chosen option and why, plus a follow-up roadmap entry.
- If implementing: a feature flag that toggles between the in-house cookie session and the SSO flow per environment, so the rollback is a config change.

### Phase 3 rollback

- Until adoption is mandatory, the in-house session remains active in parallel. Removing SSO is a flag flip plus disabling the IdP provider.

---

## Cross-phase: testing checklist

For every phase, before merging the final PR:

- [ ] Unit tests for new middleware and helpers.
- [ ] Integration tests for the affected `/auth/*` and protected routes.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build` all green.
- [ ] `npm run test --workspace api` green.
- [ ] `npm run smoke:core` updated and green.
- [ ] `npm run smoke:admin` green.
- [ ] Manual login + logout exercised on both admin-web (`:3000`) and employee-tracker (`:3001`).
- [ ] Audit log entries verified for every new auth-touching action.

---

## Open decisions blocking specific items

Track these with the user; don't unilaterally pick:

1. **CSRF strategy:** double-submit cookie token vs `SameSite=Strict` + Origin/Referer enforcement. Recommendation: double-submit, because LAN dev and production may differ on cookie scope.
2. **Argon2id migration:** keep bcrypt or migrate on next login. Recommendation: keep bcrypt for Phase 1; revisit alongside MFA in Phase 2 if the dependency is otherwise updated.
3. **Email provider:** invites currently work via dev token; password reset needs real email. Decision required before Phase 2 ships externally.
4. **Throttle store:** in-memory until first multi-node deploy; Redis only when needed.
5. **MFA mandatory enforcement window:** how long users have to enroll before login is blocked. Recommendation: 14 days from enforcement turn-on, with admin override per user.
