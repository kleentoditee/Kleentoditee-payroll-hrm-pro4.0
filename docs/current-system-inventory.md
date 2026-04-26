# Current system inventory

**Generated from repository review (read-only documentation; no runtime changes).**  
Stack: npm workspaces, Next.js (`admin-web`, `employee-tracker`), Hono API (`apps/api`), Prisma + SQLite (`@kleentoditee/db`).

---

## 1. Apps and packages overview

### Applications (`apps/`)

| App | Role | Notes |
|-----|------|--------|
| **admin-web** | Next.js App Router admin console | Primary UI for HR/payroll/finance operations; uses `NEXT_PUBLIC_API_URL` or dev rewrites to `http://127.0.0.1:8787` via `/__kleentoditee_api/*`. |
| **api** | Hono on Node (`@hono/node-server`) | JSON API, JWT auth, CORS; default port **8787** (`PORT`). |
| **employee-tracker** | Next.js “mobile-style” client | Thin UI for employees: login, month selector, draft lines, submit/delete; calls `/time/self/*`. |

### Packages (`packages/`)

| Package | Role |
|---------|------|
| **@kleentoditee/db** | Prisma schema (`packages/db/prisma/schema.prisma`), generated client, `prisma db push` / `seed` / `studio`; exports `prisma` and re-exports `@prisma/client`. |
| **@kleentoditee/ui** | Placeholder shared UI (`uiPackageVersion` only); not yet a design system. |

### Root workspace

- **packageManager:** `npm@11.11.0`  
- **Workspaces:** `apps/*`, `packages/*`  
- **Common scripts:** `db:generate`, `db:push`, `db:seed`, `dev:api`, `dev` / `dev:admin`, `dev:tracker`, `dev:all` (api + admin), `build` (admin + tracker + api).

---

## 2. API route groups

All JSON routes (except where noted) live under the Hono app in `apps/api/src/app.ts`. Multiple routers mount on the same prefix (e.g. several on `/finance`); paths below are **full URL paths** as seen by clients.

### Root

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | HTML landing with links to admin and a route index. |
| GET | `/health` | Liveness JSON (`ok`, `service`, `time`). |
| GET | `/dev/db-status` | **Non-production only:** DB URL hint, user count, JWT env flag (debugging seed/URL mismatches). |

### `/auth` (`routes/auth.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Bootstrap first user only; then disabled. |
| POST | `/auth/login` | Email/password → JWT + user profile. Invited (not yet accepted) users get an error. |
| POST | `/auth/dev-emergency` | Dev-only passwordless login when env opt-in; **403 in production**. |
| POST | `/auth/invite/accept` | Public. One-time body `{ token, password, name? }` → session JWT; token format `invitationId:secret` (not logged by API in responses). |
| GET | `/auth/me` | Current user (Bearer JWT); `status` field; **401** if not `active`. |

### `/admin` (`routes/admin-users.ts`)

**platform_owner only** — user and role administration. JWTs are checked against the database (`User.status`, `User.tokenVersion`) on every protected request. Responses never include `passwordHash` or raw invite tokens (production non-dev invite payloads omit the dev path).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/users` | List users. Optional `?status=` (comma list: `invited,active,suspended,deactivated`) or legacy `?active=true\|false`. |
| GET | `/admin/users/invitations/pending` | Pending invitations (not accepted, not revoked, not expired). |
| POST | `/admin/users/invite` | **Preferred:** invite (creates `invited` user + one-time `UserInvitation`; dev-only response may include a path to `/accept-invite?token=…`). |
| POST | `/admin/users` | Optional: create an **active** user with a known password (break-glass / scripts; same as before). |
| GET | `/admin/users/:id` | User detail + `pendingInvitation` summary (no `passwordHash`). |
| PATCH | `/admin/users/:id` | Update display fields, optional password (active users), roles, employee link. |
| POST | `/admin/users/:id/suspend` | `active` → `suspended`; invalidates sessions. |
| POST | `/admin/users/:id/deactivate` | → `deactivated`; revokes pending invites; cannot remove last **active** `platform_owner`. |
| POST | `/admin/users/:id/reactivate` | `suspended` or `deactivated` → `active` (not for `invited`). |

### `/audit` (`routes/audit.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/audit/recent` | Paginated audit log (`take` query, cap 200); platform / payroll / hr / finance roles. |

### `/people` (`routes/people.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/people/templates` | List / create **DeductionTemplate** (NHI/SSB/tax rules). |
| GET, PATCH, DELETE | `/people/templates/:id` | Read / update / delete template. |
| GET, POST | `/people/employees` | List / create **Employee** records. |
| GET, PATCH, DELETE | `/people/employees/:id` | Read / update / delete employee. |

### `/time` (`routes/time.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/time/preview` | Compute preview for entry payload (gross/deductions) without persisting. |
| GET | `/time/entries` | Admin list/filter time entries. |
| GET | `/time/entries/count` | Count for queues (e.g. submitted for approval). |
| POST | `/time/entries/bulk-approve` | Approve many entries (manager roles). |
| GET, POST, PATCH, DELETE | `/time/entries`, `/time/entries/:id` | Full CRUD for staff-edited **TimeEntry** rows. |
| GET | `/time/self/profile` | **employee_tracker_user:** linked **Employee** profile. |
| GET, POST, PATCH, DELETE | `/time/self/entries`, `/time/self/entries/:id` | Self-service draft lines. |
| POST | `/time/self/entries/:id/submit` | Employee submits a draft line. |

### `/payroll` (`routes/payroll.ts`)

| Method | Path | Purpose |
|--------|------|---------|
| GET, POST | `/payroll/periods` | List / create **PayPeriod**. |
| GET, PATCH | `/payroll/periods/:id` | Read / update period. |
| GET, POST | `/payroll/runs` | List / create **PayRun** (draft) for a period. |
| GET | `/payroll/runs/:id` | Run detail with items. |
| POST | `/payroll/runs/:id/rebuild` | Recompute draft lines from time data. |
| POST | `/payroll/runs/:id/finalize` | Finalize run. |
| POST | `/payroll/runs/:id/export` | Create **PayrollExport** (e.g. CSV in DB). |
| POST | `/payroll/runs/:id/mark-paid` | Mark run paid. |
| GET | `/payroll/paystubs/:id` | **Paystub** detail (JSON including printable payload). |

### `/finance` (multiple files; all mounted at `/finance`)

**Master data** (`routes/finance.ts`):

| Method | Path | Purpose |
|--------|------|---------|
| CRUD | `/finance/accounts`, `/finance/accounts/:id` | **Account** (chart of accounts). |
| CRUD | `/finance/customers`, `/finance/customers/:id` | **Customer** (AR). |
| CRUD | `/finance/suppliers`, `/finance/suppliers/:id` | **Supplier** (AP). |
| CRUD | `/finance/products`, `/finance/products/:id` | **Product** (links to income/expense accounts). |

**Invoices** (`routes/finance-invoices.ts`):  
`GET/POST /finance/invoices`, `GET/PATCH/DELETE /finance/invoices/:id`, `POST .../send`, `POST .../void`

**Bills** (`routes/finance-bills.ts`):  
`GET/POST /finance/bills`, `GET/PATCH/DELETE /finance/bills/:id`, `POST .../receive`, `POST .../void`

**Customer payments** (`routes/finance-payments.ts`):  
`GET/POST /finance/payments`, `GET/DELETE /finance/payments/:id`, `POST /finance/payments/:id/apply`, `POST /finance/payments/:id/unapply/:applicationId`

**Bill payments** (`routes/finance-bill-payments.ts`):  
`GET/POST /finance/bill-payments`, `GET/DELETE /finance/bill-payments/:id`, `POST /finance/bill-payments/:id/unapply/:applicationId`

**Expenses** (`routes/finance-expenses.ts`):  
`GET/POST /finance/expenses`, `GET/PATCH/DELETE /finance/expenses/:id`, `POST .../post`, `POST .../void`

**Deposits** (`routes/finance-deposits.ts`):  
`GET /finance/deposits`, `GET /finance/deposits/available-payments`, `GET/POST /finance/deposits`, `GET/DELETE /finance/deposits/:id`, `POST .../post`, `POST .../void`

**Role pattern (typical):** view — platform_owner, hr_admin, payroll_admin, finance_admin, operations_manager, site_supervisor; finance edit — platform_owner, finance_admin (and payroll routes add finance on some mutations). `time` self routes require **employee_tracker_user**.

---

## 3. Prisma models and usage

| Model | Purpose |
|-------|---------|
| **User** | Login identity; password hash; **status** (`UserStatus`: invited, active, suspended, deactivated); **emailCanonical** (optional until backfilled); **tokenVersion** (JWT invalidation); optional `employeeId` for tracker link. |
| **UserRole** | Join table: many roles per user (`Role` enum: platform_owner, hr_admin, payroll_admin, finance_admin, operations_manager, site_supervisor, employee_tracker_user). |
| **UserInvitation** | One-time invite: bcrypt **tokenHash**, `expiresAt`, `acceptedAt`, `revokedAt`. |
| **AuditLog** | Append-only event log (actor, action, entity type/id, before/after JSON). |
| **DeductionTemplate** | Reusable NHI/SSB/income tax rates and flags; assigned to **Employee** and **TimeEntry**. |
| **Employee** | Master HR/payroll record: name, pay basis/rates, schedule, site string, `templateId`, active flag. |
| **TimeEntry** | Monthly (or per-period) working time line: site, days/hours/OT, earnings adjustments, per-line tax flags, **TimeEntryStatus** (draft → submitted → approved → paid). |
| **PayPeriod** | Payroll window (label, schedule, start/end, optional pay date). |
| **PayRun** | One run per period; **PayRunStatus**; links **PayRunItem** and **PayrollExport**. |
| **PayRunItem** | Frozen payroll line per employee in a run (amounts, templates snapshot, **sourceEntryIds** JSON). |
| **Paystub** | Printable artifact per **PayRunItem** (`stubNumber`, `payload` JSON). |
| **PayrollExport** | Stored file contents (e.g. CSV) for a run. |
| **Account** | Chart of accounts; **AccountType**; optional parent/child tree. |
| **Customer** | AR customer. |
| **Supplier** | AP vendor. |
| **Product** | SKU, kind, pricing, default income (and optional expense) **Account** links. |
| **Invoice** + **InvoiceLine** | AR invoice documents and line items. |
| **Bill** + **BillLine** | AP bill documents and line items. |
| **Payment** + **PaymentApplication** | Customer receipts applied to **Invoice**s; deposit **Account**. |
| **BillPayment** + **BillPaymentApplication** | Outflows applied to **Bill**s; source **Account**. |
| **Expense** + **ExpenseLine** | Direct (non-AP) spend; optional **Supplier**; **PaymentMethod**. |
| **Deposit** + **DepositLine** | Bank deposits grouping **Payment**s into a bank **Account**. |

**Enums (high level):** `Role`, `UserStatus`, `PayBasis`, `PaySchedule`, `TimeEntryStatus`, `PayRunStatus`, `AccountType`, `ProductKind`, `TransactionStatus`, `PaymentMethod`.

**Not modeled:** full double-entry journal with running account balances, bank reconciliation beyond deposit workflow, multi-company tenants, self-service registration after bootstrap (use admin user APIs instead).

---

## 4. admin-web pages and purpose

Path prefix: `src/app/`. All dashboard routes are under `/dashboard/…` unless noted.

| Route | Purpose |
|-------|---------|
| `/` | Marketing/entry; routes toward login. |
| `/login` | Admin sign-in (JWT to localStorage; API calls use `authHeaders()`). |
| `/dashboard` | Home: metrics (submitted time count, draft pay runs), links to main areas. |
| `/dashboard/people` | Redirect → `/dashboard/people/employees`. |
| `/dashboard/users` | User admin list, status filters, pending invitation banner (platform_owner; **Users** in shell). |
| `/dashboard/users/new` | **Invite** user (roles, optional employee); no initial password. |
| `/dashboard/users/[id]` | View/edit, suspend, deactivate, reactivate; no delete. |
| `/accept-invite` | Public. Paste token or `?token=`; set password; issues JWT. |
| `/dashboard/people/employees` | Employee list, search, link to new/detail. |
| `/dashboard/people/employees/new` | Create employee. |
| `/dashboard/people/employees/[id]` | View/edit employee. |
| `/dashboard/people/templates` | Deduction templates list. |
| `/dashboard/people/templates/new` | Create template. |
| `/dashboard/people/templates/[id]` | View/edit template. |
| `/dashboard/time` | Time area landing (per layout; entries are primary). |
| `/dashboard/time/entries` | List/filter time entries. |
| `/dashboard/time/entries/new` | Create entry (admin). |
| `/dashboard/time/entries/[id]` | View/edit time entry. |
| `/dashboard/time/approvals` | Submitted timesheets approval queue. |
| `/dashboard/payroll` | Redirect → `/dashboard/payroll/periods`. |
| `/dashboard/payroll/periods` | Pay periods list and create. |
| `/dashboard/payroll/periods/[id]` | Period detail, create run. |
| `/dashboard/payroll/runs` | Pay runs list. |
| `/dashboard/payroll/runs/[id]` | Run detail: rebuild, finalize, export, mark paid, line items, paystub links. |
| `/dashboard/payroll/paystubs/[id]` | Printable paystub view. |
| `/dashboard/finance` | Redirect → `/dashboard/finance/accounts`. |
| `/dashboard/finance/accounts` | Chart of accounts. |
| `/dashboard/finance/customers` | Customers CRUD. |
| `/dashboard/finance/suppliers` | Suppliers CRUD. |
| `/dashboard/finance/products` | Products CRUD. |
| `/dashboard/finance/invoices` | Invoices list. |
| `/dashboard/finance/invoices/new` | New invoice. |
| `/dashboard/finance/invoices/[id]` | Invoice detail/edit. |
| `/dashboard/finance/bills` | Bills list. |
| `/dashboard/finance/bills/new` | New bill. |
| `/dashboard/finance/bills/[id]` | Bill detail. |
| `/dashboard/finance/payments` | Customer payments. |
| `/dashboard/finance/payments/new` | Record payment. |
| `/dashboard/finance/payments/[id]` | Payment detail / apply. |
| `/dashboard/finance/bill-payments` | Bill payments list. |
| `/dashboard/finance/bill-payments/new` | New bill payment. |
| `/dashboard/finance/bill-payments/[id]` | Bill payment detail. |
| `/dashboard/finance/expenses` | Expenses list. |
| `/dashboard/finance/expenses/new` | New expense. |
| `/dashboard/finance/expenses/[id]` | Expense detail. |
| `/dashboard/finance/deposits` | Deposits list. |
| `/dashboard/finance/deposits/new` | New deposit. |
| `/dashboard/finance/deposits/[id]` | Deposit detail / post. |
| `/dashboard/audit` | Recent audit events (`/audit/recent`). |

**Layouts:** `dashboard/layout.tsx`, `people/layout.tsx`, `payroll/layout.tsx`, `time/layout.tsx`, `finance/layout.tsx` provide section navigation chrome.

**employee-tracker (separate app):** `/` home (self time), `/login` — not part of `admin-web` but part of the same platform API.

---

## 5. Complete vs stub vs missing

### Largely complete (API + data model + admin UI or client)

- **Authentication:** register (first user), login, `/me`, JWT usage from admin and tracker.  
- **People:** templates and employees; audit on mutations.  
- **Time (admin):** list, count, create/edit, bulk approve.  
- **Time (employee):** self profile, draft lines, submit, delete drafts (`employee-tracker`).  
- **Payroll:** periods, runs, rebuild/finalize/export/mark paid, paystub read; admin screens wired.  
- **Finance:** AR/AP-style documents, payments, bill payments, expenses, deposits; master data; heavy coverage in `apps/api` + matching admin pages.  
- **Audit:** list recent events in admin.  
- **Seeding:** `packages/db/prisma/seed.ts` creates admin user, sample employees (including a linked **employee_tracker_user** for Maria), template(s), time entries, and sample finance data (per seed file).  
- **User & role administration (implemented):** Invitation-first `POST /admin/users/invite`, token-hashed `UserInvitation`, `POST /auth/invite/accept`, `UserStatus` lifecycle, `GET /admin/users/invitations/pending`, suspend/reactivate/deactivate, optional `POST /admin/users` with password, admin UI with status badges and `/accept-invite` (platform_owner). Audit: `user.admin.invite`, `user.admin.suspend`, plus prior create/update/roles_set/deactivate/reactivate. Last **active** `platform_owner` is protected. Sessions enforce DB **tokenVersion** + `status === active` on every request.  

### Stubs, placeholders, or “phase later” in UI

- **App shell** (`app-shell.tsx`): left “rail” items (Create, Bookmarks, Feed, Reports, All apps, Customize) are mostly **non-navigating buttons**; only Home links to `/dashboard`. Pinned row includes **Hiring** and **Reports** **without** `href` (non-clickable).  
- **Global search** in header: **disabled** with tooltip *“Global search — wired in a later phase”*.  
- **@kleentoditee/ui:** placeholder token export only.  

### Missing or not exposed in admin

- **Register** after the first user exists is blocked by design.  
- **Full general ledger** with balanced journal posts and **account running balances** (schema is document- and line-centric; `Account` has no period balance field).  
- **Invoices/employee payroll** integration: payroll and finance are separate domains in the current schema.  
- **Transaction email delivery for invitations** — not implemented; non-production may log or return a dev-only accept path. Wider **email / notifications, file uploads, multi-tenancy, SSO** — not present.  
- **Production hardening** left as environment concerns (CORS allowlist, `NODE_ENV`, emergency login off, etc., documented in code).  

*Stub vs “thin but complete” is judgmental: feature screens that call real APIs are treated as **complete**; empty navigation affordances and missing admin domains are **stub** or **missing**.*

---

## 6. Recommended next implementation order

1. **Clarify or implement shell affordances** — Either wire Create/Reports/Hiring to real routes or remove/label as future to avoid a “broken” console feel.  
2. **Global search (optional but high impact)** — If product priority is findability, replace the disabled field with server-backed search over employees, invoices, etc.; if not, hide it until a spec exists.  
3. **employee-tracker hardening** — Edit policy for non-draft lines, error states, and parity with any new approval rules.  
4. **Financial reporting** — If required beyond document lists: define whether to add **journal entries** and balance reporting or stay invoice-centric and export to external tools.  
5. **@kleentoditee/ui** — Promote only when multiple apps need the same components; until then, keep admin patterns local to avoid abstracting too early.  

**Done:** user & role administration (invitation flow, status model, session checks, API + admin UI for `platform_owner`). See [user-role-administration.md](user-role-administration.md) for details.
