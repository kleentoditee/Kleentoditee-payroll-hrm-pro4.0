# Staff Hub — schedule, messages, and rewards (Phase 3)

Operational engagement for the **employee-tracker** (Staff Hub) and related **admin** screens. Does **not** change payroll math or expose sensitive HR fields in the tracker.

## Work assignments (`WorkAssignment`)

- Ops create rows per **employee** + **date** with **location** (and optional address, times, notes). Status: `SCHEDULED` | `COMPLETED` | `CANCELLED`.
- **Employee API:** `GET /staff/self/schedule?from&to`, `GET /staff/self/schedule/today` — own rows only.
- **Admin API:** `GET/POST /admin/schedules`, `PATCH /admin/schedules/:id`, `POST /admin/schedules/:id/cancel` (see `admin-staff.ts` for roles).
- **UIs:** Admin `/dashboard/schedule` · Tracker **Today** and **Schedule** sections.

## Announcements (`StaffAnnouncement`)

- In-app list for employees with audience **ALL** or **EMPLOYEES** and optional schedule window. Categories include GENERAL, SAFETY, HOLIDAY, POLICY, WEATHER, PAYROLL, SCHEDULE.
- **API:** `GET /staff/self/announcements` (tracker) · `GET/POST/PATCH /admin/announcements` (admin).
- **UI:** Admin `/dashboard/announcements` · tracker **Messages**.

## Notifications (`NotificationLog`)

- Schema only for **future** queued/sent records (e.g. `IN_APP`, `EMAIL_DRAFT`, `WHATSAPP_DRAFT`, provider channels). **Phase 3 does not** send email or WhatsApp automatically. Do not treat publishing an announcement as “staff were emailed.”

## Quiz and rewards (non-monetary)

- `StaffQuizQuestion` (JSON `choices`, `correctIndex`), `StaffQuizAttempt`, `RewardLedger` (points, reason).
- **API:** `GET /staff/self/quiz/daily`, `POST /staff/self/quiz/attempt`, `GET /staff/self/rewards/summary`.
- If no active question exists, the tracker can show a **local** practice question from `apps/employee-tracker/src/lib/staff-hub-data.ts`. Points are **not** pay or cash.

## Daily checklist

- **Placeholder** in the tracker UI; a data model can be added in a later phase.

## See also

- `docs/staff-requests.md` (Phase 2)
- `docs/current-system-inventory.md` (API tables)
