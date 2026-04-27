# Employee tracker — sharing and remote access

## Purpose

HR and payroll staff can direct employees to the **employee-tracker** app so they enter time from a phone or browser. This document describes how links are produced, what security guarantees apply, and how to configure production.

## Architecture (no new auth system)

- **Authentication** is unchanged: employees use the same **email + password** users as the rest of the platform (`POST /auth/login`), with an account that has the **employee_tracker_user** role and an `employeeId` link to their `Employee` record.
- **No invite tokens** are placed in shared links. If you use the existing user-invite flow, that remains a separate step (admin sends the invite; the employee sets a password). The tracker link only opens the sign-in page.
- **No unauthenticated write access**: all time APIs under `/time/self/*` require a valid JWT.

## Admin: “Share tracker access” on the employee record

On **People → Employee → detail** (`/dashboard/people/employees/[id]`), the **Share tracker access** card:

1. Loads **`GET /people/employees/:id/tracker-share`** (requires the same roles as other People routes).
2. Shows the **sign-in URL** for the tracker app (see below).
3. Provides:
   - **Copy link** — copies the sign-in URL only.
   - **Email link** — `mailto:` with a generic subject/body (no passwords, no tax IDs).
   - **WhatsApp** — opens `https://api.whatsapp.com/send?text=...` with the same generic text (suitable for the employee to pick a contact).

If a **user account is linked** to the employee (`User.employeeId`), the card shows that user’s **email** and status so admins know which sign-in identity to reference in a separate, secure channel. That email is **not** auto-inserted into WhatsApp or mailto bodies.

If no user is linked, the card points to **Invite user** so a platform owner can create and link an account.

## API: tracker share metadata

**`GET /people/employees/:id/tracker-share`**

Returns JSON:

| Field | Meaning |
|-------|--------|
| `employeeId` | Confirms which employee was requested (internal id; not a government id). |
| `loginUrl` | Public URL of the tracker sign-in page (no query tokens). |
| `appHomeUrl` | Public URL of the tracker home page. |
| `linkedUser` | `null`, or `{ email, status }` for the user linked to this employee. |

The **public base URL** of the tracker is read from the API environment variable:

- **`EMPLOYEE_TRACKER_PUBLIC_URL`** — full origin, no trailing slash (e.g. `https://time.yourcompany.com` or `http://localhost:3001` for local dev).

If unset, the API defaults to `http://localhost:3001` to match `npm run dev` in `apps/employee-tracker`.

## Admin web: optional fallback URL

If the API call fails (e.g. old server without the route), the admin card can still show a URL when **`NEXT_PUBLIC_EMPLOYEE_TRACKER_URL`** is set in the admin app’s environment. This does not replace server configuration for production; set **`EMPLOYEE_TRACKER_PUBLIC_URL`** on the API so the canonical link is consistent.

## Employee tracker UX

- **Landing (`/`)** when logged out explains remote time entry, monthly lines, and approval — and links to **Sign in**.
- **Login (`/login`)** is styled for mobile; seed hints appear only in **development** (`NODE_ENV=development`).
- After sign-in, the header shows **pay schedule** (weekly / biweekly / monthly) from `GET /time/self/profile`.
- **Staff Hub tabs:** "Time" (existing monthly entry) and "Requests" (`/requests`). The Requests tab calls `/staff/self/requests` and lets employees submit job letters, time off, sick leave, profile updates, supplies, equipment, incident, and damage reports, see a status-tracked list, and cancel their own active requests. Sensitive HR identifiers (SSN / NHI / IRD) are never collected through this form — see `docs/staff-requests.md`.

## Security checklist

- Shared text and URLs must **not** include passwords, NHI/SSN/IRD numbers, or one-time invite tokens.
- The sign-in URL is **not** a magic link; employees must authenticate.
- Prefer sending credentials through an existing secure channel, not inside the same WhatsApp thread as the link.

## Known limitations

- **Email** uses the client’s `mailto:` handler; there is no built-in transactional email provider in this repo.
- **WhatsApp** opens the composer with prefilled text; it does not send automatically.
- **Per-employee deep links** with tokens were intentionally avoided to prevent token-in-URL anti-patterns; all employees use the same app entry point and their own login.
