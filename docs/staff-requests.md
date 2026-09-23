# Staff Hub requests

## Purpose

Phase 2 adds a real **Staff Hub request system** so employees can submit
common HR requests (job letters, time off, sick leave, profile updates,
supplies, equipment, incident and damage reports) from the employee
tracker, and so HR / managers can review and act on them from the admin
console.

This document is the contract for the API, UI, and roles. It does **not**
introduce any payroll calculation changes and does **not** expose any
sensitive HR identifiers (SSN / NHI / IRD) to the tracker.

## Data model

`StaffRequest` (see [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma)):

| Field | Notes |
|-------|-------|
| `id` | cuid |
| `employeeId` | FK to `Employee` (cascade) |
| `type` | `StaffRequestType` enum |
| `status` | `StaffRequestStatus` enum, default `SUBMITTED` |
| `subject` | Optional short label entered by employee |
| `startDate`, `endDate` | Used by `TIME_OFF` and `SICK_LEAVE` |
| `reason` | Free text — used by `JOB_LETTER` to describe purpose |
| `details` | Free text — used by job-letter, supplies, equipment, incident, damage |
| `requestedContactUpdate` | JSON — only for `PROFILE_UPDATE`. Restricted keys (see below). |
| `reviewNote` | Set by admin on status change |
| `reviewedByUserId`, `reviewedAt` | Set when an admin updates status |
| `cancelledAt` | Set when status reaches `CANCELLED` |
| `createdAt`, `updatedAt` | Auto |

Indexes: `employeeId`, `status`, `type`, `createdAt`, `[employeeId, status]`.

### Allowed `requestedContactUpdate` keys

To prevent the tracker becoming a backdoor for sensitive HR fields, the
API **silently drops** any key not on this allowlist:

```
phone
personalEmail
address
emergencyContactName
emergencyContactPhone
emergencyContactRelationship
uniformSize
```

SSN, NHI, IRD, work-permit numbers, pay rates and other compensation
fields are **never** accepted from this endpoint.

## Request types

| Enum | Used for |
|------|----------|
| `JOB_LETTER` | Letter of employment (bank, embassy, landlord). Requires `reason` or `details`. |
| `TIME_OFF` | Vacation / personal time. Requires `startDate` and `endDate`. |
| `SICK_LEAVE` | Sick days. Requires `startDate` and `endDate`. |
| `PROFILE_UPDATE` | Update phone / address / emergency contact / uniform size. Requires `requestedContactUpdate`. |
| `SUPPLIES_REQUEST` | Site consumables (cleaners, mops, etc.). Requires `details`. |
| `EQUIPMENT_UNIFORM_REQUEST` | Uniforms, larger equipment. Requires `details`. |
| `INCIDENT_REPORT` | Workplace incident. Requires `details`. |
| `DAMAGE_REPORT` | Reporting broken equipment / property. Requires `details`. |

## Statuses and transitions

```
SUBMITTED ──► UNDER_REVIEW ──► APPROVED ──► COMPLETED
        │                ├──► DENIED
        │                └──► CANCELLED
        ├─────────────► APPROVED ──► COMPLETED
        ├─────────────► DENIED
        └─────────────► CANCELLED   (also reachable from any active state)
```

`DENIED`, `COMPLETED`, and `CANCELLED` are terminal. Active requests are
`SUBMITTED` and `UNDER_REVIEW`. Approved requests can still be moved to
`COMPLETED` or `CANCELLED`.

## API

### Employee self-service

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/staff/self/requests` | `employee_tracker_user` | List the signed-in employee's requests |
| POST | `/staff/self/requests` | `employee_tracker_user` | Submit a new request |
| POST | `/staff/self/requests/:id/cancel` | `employee_tracker_user` | Cancel an active request the employee owns |

The actor must have a linked `employeeId`. Employees only ever see their
own rows. They cannot review, approve, deny, or change another employee's
data.

### Admin review

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| GET | `/admin/staff-requests` | platform_owner, hr_admin, operations_manager, site_supervisor (full); payroll_admin (TIME_OFF / SICK_LEAVE only) | List requests; supports `status`, `type`, `employeeId` filters |
| GET | `/admin/staff-requests/:id` | same as list | Detail |
| PATCH | `/admin/staff-requests/:id/status` | platform_owner, hr_admin, operations_manager, site_supervisor | Move to a new status with optional `reviewNote` |

`payroll_admin` is intentionally **read-only** and is restricted to
`TIME_OFF` and `SICK_LEAVE` so they can plan around leave without
accessing job letters, profile updates, incident reports, etc.

## UI

### Employee tracker

`apps/employee-tracker/src/app/requests/page.tsx`:

- New "Requests" tab on the Staff Hub home (mobile-first card layout).
- Type-aware form: shows date range for `TIME_OFF` / `SICK_LEAVE`,
  letter purpose for `JOB_LETTER`, profile fields for `PROFILE_UPDATE`,
  and a free `details` textarea otherwise.
- Status badges, reviewer note display, "Cancel request" button on
  active rows.
- Friendly success and error messages around submit and cancel.

### Admin web

`apps/admin-web/src/app/dashboard/people/requests/page.tsx`:

- Filters by status and type.
- Two-column queue / detail layout.
- Status badges with counts in the header strip.
- Detail panel shows employee, dates, reason, details, requested
  profile changes, reviewer info, and a `reviewNote` textarea.
- Action buttons render dynamically based on the current status using
  the transition table above.
- Linked from the People sub-nav and the global sidebar (under
  **People → Staff requests**).

## Audit log

Every API write produces an entry via the existing `writeAudit` helper:

| Action | When |
|--------|------|
| `staff_request.self_create` | Employee submits a new request |
| `staff_request.self_cancel` | Employee cancels their own request |
| `staff_request.review` | Admin patches the status (with before / after status and reviewer note) |

## Limitations and non-goals

- **No notifications** — Phase 2 does not send WhatsApp or email when a
  request is submitted or reviewed. Reviewers must check the queue.
- **No file attachments** — incident / damage / supplies requests only
  capture text. File uploads happen on the employee record, not on the
  request.
- **Profile updates do not auto-apply** — approving a `PROFILE_UPDATE`
  records the decision; the actual write to the `Employee` record
  remains an HR-admin action and may be wired up in a later phase.
- **Manager scoping** — site supervisors and operations managers can
  see requests for any employee, not only their site. Site-level
  scoping is deferred until the org has a site / team model.
