# KleenToDiTee — Platform Technical Decisions

**Date:** 2026-04-20  
**Applies to:** Implementation plan Phase 1 onward (iterable; major changes recorded here).

## Decisions

| Area | Choice | Notes |
|------|--------|--------|
| Monorepo | **npm workspaces** | Single lockfile; familiar on Windows; no extra toolchain. |
| Admin web | **Next.js** (App Router) + **TypeScript** + **Tailwind CSS** | Matches blueprint; fast iteration on shell and dashboards. |
| Employee tracker | **Next.js** (App Router) + **TypeScript** + **Tailwind** | Mobile-first layouts; PWA/manifest added when flows stabilize. |
| API | **Node.js** + **Hono** + **TypeScript** | Lightweight, explicit routes; deploys as a single service beside Next. |
| Database | **Prisma** + **SQLite** (default local dev) / **PostgreSQL** (Docker or hosted for production-like and prod) | Same schema; swap `DATABASE_URL` in `.env`. |
| Auth (production) | **TBD** — shortlist **Clerk**, **WorkOS**, or **Auth.js** | Phase 1 uses a dev placeholder only until roles/SSO requirements are fixed. |
| Object storage | **S3-compatible** (AWS S3 or **Cloudflare R2**) | For documents and exports; wire in Phase 2+. |
| Background jobs | **BullMQ** + **Redis** | When payroll/finance needs async processing; not required for Phase 1 scaffold. |
| Search | **PostgreSQL** full-text first | Upgrade path: Meilisearch/Typesense if needed. |
| Deployment | **Docker Compose** (dev) / **Vercel** (web) + **Fly.io** or **Railway** (API) — flexible | Final hosting to match org IT constraints. |

## Rejected alternatives

- **Turborepo-only without workspaces:** Unnecessary complexity for the current team size; can add Turborepo later if cache graphs help CI.
- **Separate React SPA (Vite) + custom router:** Next.js gives routing, SSR/SSG options, and conventions the blueprint expects for admin scale.
- **Python FastAPI for API:** Fine long-term; TypeScript API shares types with frontends and matches the master plan stack.
- **MongoDB:** Relational model fits payroll, finance, and audit; PostgreSQL stays canonical.

## Review trigger

Revisit this document when: tax jurisdiction is finalized, auth/SSO vendor is chosen, or first production deployment target is locked.
