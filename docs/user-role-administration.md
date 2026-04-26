# User & role administration

Scope: `platform_owner` only for admin user APIs. Same JWT (localStorage) and Hono + Prisma stack; no new auth provider.

## Routes (API, prefix `/admin` unless noted)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/admin/users` | `?status=invited,active,…` or `?active=true\|false` (legacy) |
| GET | `/admin/users/invitations/pending` | Pending, non-revoked, unexpired invites |
| POST | `/admin/users/invite` | Creates user in `invited` + `UserInvitation` (token hashed with bcrypt) |
| POST | `/admin/users` | Create **active** user with password (optional break-glass) |
| GET | `/admin/users/:id` | Includes `pendingInvitation` when applicable |
| PATCH | `/admin/users/:id` | Display fields, roles, employee; password for **active** users only |
| POST | `/admin/users/:id/suspend` | |
| POST | `/admin/users/:id/deactivate` | Revokes open invitations; last **active** `platform_owner` is protected |
| POST | `/admin/users/:id/reactivate` | From `suspended` or `deactivated` (not from `invited`) |
| POST | `/auth/invite/accept` | **Public** — body `{ token, password, name? }`; `token` is `invitationId:secret` |

## Lifecycle (`UserStatus`)

| Status | Meaning |
|--------|---------|
| `invited` | Awaiting one-time accept; cannot sign in until accept |
| `active` | May sign in (subject to JWT + `tokenVersion`) |
| `suspended` | Blocked; use reactivate or deactivate |
| `deactivated` | Offboarded; reactivate possible |

Users are not **deleted** for admin offboarding; use `deactivated` (or cancel an invite via deactivate on `invited`).

## Invite flow

1. `POST /admin/users/invite` with email, roles, optional employee link. Server creates a user with `status = invited` and a random unusable password hash, plus a `UserInvitation` row with **bcrypt** of the full raw token `invitationId:secret`.
2. In **non-production**, the response may include `devInvitePath` (e.g. `/accept-invite?token=…`) and the API logs a one-line **dev** URL to the server console. **Production** does not return token material in JSON.
3. The invitee opens the admin app `/accept-invite?token=…` (or pastes the token), sets a password, and calls `POST /auth/invite/accept`, which issues a normal session JWT.
4. Passwords and raw tokens are not written to `AuditLog` metadata.

## Session rules

- JWT payload includes `tv` = `User.tokenVersion`. The auth middleware loads the user and requires `status === active` and matching `tokenVersion` on **every** protected request.
- Admin password change, role replacement, suspend, deactivate, and revalidate flows bump `tokenVersion` as appropriate to invalidate old tokens.

## Limitations (this pass)

- No real outbound email: ops rely on **dev** logging/paths, or a separate channel, to deliver the accept link in production.
- `emailCanonical` may be null on very old DB rows; use `packages/db/prisma/backfill-email-canonical.sql` if upgrading in place, or `npm run db:push:loss` + `db:seed` in dev.
- `PUBLIC_APP_URL` (optional) shapes logged dev base URLs; defaults to `http://localhost:3000`.

## Local testing

1. Stop the API if needed; from repo root: `npm run db:push:loss` when Prisma complains about replacing `User.active` (dev-only), then `npm run db:seed`.
2. Start API (`npm run dev:api`) and admin (`npm run dev` or `dev:all`).
3. Register first user or sign in as seeded `admin@kleentoditee.local` (see seed output), open `/dashboard/users`, use **Invite user**, then open the printed dev path or `/accept-invite` with the token.
4. Sign in as the new user after accept.

## Database scripts

- `npm run db:push` — normal sync; may require `npm run db:push:loss` if SQLite cannot migrate `User` in place.
- `packages/db` also exposes `push:loss` (accept data loss) for the same.
