# PR handoff: local dev hardening, login, OneDrive, CodeRabbit

Use the **title** and **body** below when you open a pull request so **CodeRabbit** (and human reviewers) have full context.

## Suggested PR title

`chore(dev): local Windows setup, admin API proxy, Prisma/OneDrive, emergency login, docs & scripts`

## Suggested PR body (copy for GitHub/GitLab)

### Summary

Improves first-run and day-to-day local development on **Windows** (especially under **OneDrive**): one-click batch scripts, Prisma EPERM workarounds, **same-origin** admin→API in `next dev` to avoid CORS false failures, safer login/JSON handling, `dev` diagnostics on the API, optional **emergency** passwordless sign-in for local only (strictly gated), and README/tooling for moving the repo off OneDrive if needed.

### Security / product notes (please review)

- `POST /auth/dev-emergency` is **intentionally** dangerous if misconfigured. It is disabled unless `isEnvTruthy("ALLOW_DEV_EMERGENCY_LOGIN")`, returns **403** with explicit messages (not generic 404) when off, and is blocked when `NODE_ENV === "production"`. It must be **opt-in** from repo root `.env` and removed before any real deploy.
- `GET /dev/db-status` (non-production) exposes `DATABASE_URL` and user count; acceptable for localhost debugging only.
- CORS: non-production uses origin reflection; production uses `CORS_ALLOWED_ORIGINS` when `NODE_ENV === "production"`.

### Files touched (for reviewers)

| Area | Files |
|------|--------|
| API | `apps/api/src/app.ts`, `apps/api/src/env.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/lib/env-flags.ts` |
| Admin web | `apps/admin-web/next.config.ts`, `apps/admin-web/src/lib/api.ts`, `apps/admin-web/src/app/login/page.tsx` |
| DB / seed | `packages/db/prisma/seed.ts` |
| Config / env | `.env.example` |
| Root scripts | `start-platform.bat`, `restart-platform.bat`, `start-local.bat`, `seed-database.bat`, `repair-prisma-generate.bat`, `enable-emergency-login.bat` |
| `scripts/` | `bootstrap-env.cmd`, `open-admin-delayed.cmd`, `kill-dev-ports.ps1`, `patch-env-emergency.ps1`, `copy-project-to-c-dev.bat` |
| Docs | `README.md` |
| Meta | `PUSH-ME.txt` (git push instructions; optional to delete after merge) |

### How to test locally

1. From repo root: `start-platform.bat` (or `npm run boot`).
2. `http://localhost:3000/login` — health via same-origin: `http://localhost:3000/__kleentoditee_api/health` (in dev, no `NEXT_PUBLIC_API_URL` in `.env` unless you intend direct 8787).
3. `http://127.0.0.1:8787/health` — API without Next.
4. Seed: stop servers, `seed-database.bat` or `npm run db:seed`, restart.
5. Optional emergency: `enable-emergency-login.bat`, restart, confirm log `[api] Emergency passwordless login is ON`, then emergency button on login page.

### Out of scope

- No production auth hardening (still JWT in `localStorage` for dev as before).
- Prisma `package.json#prisma` deprecation warning left as separate follow-up.

---

**After you merge:** delete or trim `PUSH-ME.txt` if you do not want push reminders in the repo.
