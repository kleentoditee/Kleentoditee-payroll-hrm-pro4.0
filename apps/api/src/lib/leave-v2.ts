// Batch 20 — Leave Policy v2: policy assignment, days/hours basis, accrual,
// carryover, caps, BVI public holidays, work-schedule-aware day counting,
// time-for-time, and an append-only event ledger so every balance reproduces
// from source events (Gate 20).
import { prisma, requireOrgId, StaffRequestStatus, StaffRequestType } from "@kleentoditee/db";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

export type WeekPattern = Array<{ day: string; hours: number }>;

/** JS getUTCDay() index (0=Sun) for a pattern day name. */
const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** Set of weekday indexes the employee works; default Mon–Fri. */
export function workingWeekdays(pattern?: WeekPattern | null): Set<number> {
  if (!pattern || !pattern.length) return new Set([1, 2, 3, 4, 5]);
  const days = pattern.filter((d) => d.hours > 0).map((d) => DAY_INDEX[String(d.day).toLowerCase()]);
  return new Set(days.length ? days : [1, 2, 3, 4, 5]);
}

export function holidayKeySet(dates: Array<Date | string>): Set<string> {
  return new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)));
}

/**
 * Working days between two dates inclusive, honoring the employee's weekly
 * pattern and (optionally) public holidays. Falls back to Mon–Fri.
 */
export function workdayCount(
  start: Date,
  end: Date,
  opts: { pattern?: WeekPattern | null; holidays?: Set<string>; excludeHolidays?: boolean } = {}
): number {
  if (!(start <= end)) return 0;
  const weekdays = workingWeekdays(opts.pattern);
  const exclude = opts.excludeHolidays !== false;
  const holidays = opts.holidays ?? new Set<string>();
  let count = 0;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    if (weekdays.has(cursor.getUTCDay()) && !(exclude && holidays.has(key))) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

/** Convert a day count into the policy's basis units using the schedule's hours per week. */
export function toBasisUnits(
  days: number,
  policy: { basis: string },
  hoursPerDay = 8
): number {
  return policy.basis === "hours" ? Math.round(days * hoursPerDay * 100) / 100 : days;
}

export type AccrualSpec = { month: number; amount: number };

/**
 * Accrual schedule for one policy+assignment in a year. accrualPerMonth > 0:
 * one event per completed month from the assignment start (clamped to the
 * year). accrualPerMonth = 0 with an allowance: the full allowance is posted
 * up front at the year (or assignment) start. Returns [] for untracked.
 */
export function accrualSpecs(
  policy: { annualAllowanceDays: number; accrualPerMonth: number },
  assignmentStart: Date,
  year: number,
  asOf: Date
): AccrualSpec[] {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const start = assignmentStart > yearStart ? assignmentStart : yearStart;
  const specs: AccrualSpec[] = [];
  if (policy.accrualPerMonth > 0) {
    // accrue at the END of each completed month
    for (let m = start.getUTCMonth(); m < 12; m += 1) {
      const monthEnd = new Date(Date.UTC(year, m + 1, 1));
      if (monthEnd > asOf) break;
      specs.push({ month: m + 1, amount: policy.accrualPerMonth });
    }
  } else if (policy.annualAllowanceDays > 0) {
    specs.push({ month: 0, amount: policy.annualAllowanceDays });
  }
  return specs;
}

/** Carryover into the new year: only a positive balance, capped. */
export function carryoverAmount(yearEndBalance: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.min(Math.max(yearEndBalance, 0), cap);
}

/** Balance at a point in time from the event ledger (the reproducibility core). */
export function balanceFromEvents(events: Array<{ amount: number; eventDate: Date }>, asOf?: Date): number {
  const sum = events
    .filter((e) => !asOf || e.eventDate <= asOf)
    .reduce((s, e) => s + e.amount, 0);
  return Math.round(sum * 100) / 100;
}

/** Apply a policy's maxBalance cap to a prospective accrual. */
export function cappedAccrual(current: number, amount: number, maxBalance: number): number {
  if (maxBalance <= 0) return amount;
  return Math.max(0, Math.min(amount, maxBalance - current));
}

// ---------------------------------------------------------------------------
// BVI public holidays (owner-verifiable seed; editable per org)
// ---------------------------------------------------------------------------

/** Computed Easter Sunday (Anonymous Gregorian algorithm). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month, day));
}

/** nth weekday of a month (1-based; weekday: 0=Sun..6=Sat). */
export function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/** BVI public holidays for a year (dates per the standard gazette pattern; the
 * owner confirms the yearly gazette and can edit rows per org). */
export function bviHolidays(year: number): Array<{ date: Date; name: string }> {
  const easter = easterSunday(year);
  const add = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);
  const fixed = (m: number, d: number) => new Date(Date.UTC(year, m, d));
  return [
    { date: fixed(0, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 2, 1, 1), name: "H. Lavity Stoutt's Birthday" },
    { date: nthWeekday(year, 2, 1, 2), name: "Commonwealth Day" },
    { date: add(easter, -2), name: "Good Friday" },
    { date: add(easter, 1), name: "Easter Monday" },
    { date: add(easter, 50), name: "Whit Monday" },
    { date: nthWeekday(year, 5, 5, 2), name: "Sovereign's Birthday" },
    { date: nthWeekday(year, 7, 1, 1), name: "Emancipation Monday" },
    { date: add(nthWeekday(year, 7, 1, 1), 1), name: "Emancipation Tuesday" },
    { date: add(nthWeekday(year, 7, 1, 1), 2), name: "Emancipation Wednesday" },
    { date: nthWeekday(year, 9, 1, 3), name: "Heroes and Foreparents Day" },
    { date: fixed(11, 25), name: "Christmas Day" },
    { date: fixed(11, 26), name: "Boxing Day" }
  ];
}

export async function seedBviHolidays(year: number) {
  const orgId = requireOrgId();
  let created = 0;
  for (const h of bviHolidays(year)) {
    const existing = await prisma.publicHoliday.findFirst({ where: { date: h.date } });
    if (existing) continue;
    await prisma.publicHoliday.create({ data: { orgId, date: h.date, name: h.name } });
    created += 1;
  }
  return { year, seeded: created, total: bviHolidays(year).length };
}

// ---------------------------------------------------------------------------
// Event-ledger sync from staff requests (the write path)
// ---------------------------------------------------------------------------

const USED_STATUSES = new Set<string>([StaffRequestStatus.APPROVED, StaffRequestStatus.COMPLETED]);

async function holidaySetForYearRange(start: Date, end: Date): Promise<Set<string>> {
  const rows = await prisma.publicHoliday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true }
  });
  return holidayKeySet(rows.map((r) => r.date));
}

/**
 * Keep the LeaveEvent ledger in sync with a leave staff request:
 * - APPROVED/COMPLETED -> one usage event (negative, schedule+holiday aware)
 * - leaving APPROVED/COMPLETED (denied/cancelled) -> usage_release (positive)
 * Idempotent per request via sourceType 'staff_request' + sourceId.
 */
export async function syncLeaveEventForRequest(request: {
  id: string;
  employeeId: string;
  type: StaffRequestType;
  startDate: Date | null;
  endDate: Date | null;
}) {
  if (!request.startDate || !request.endDate) return null;
  const policy = await prisma.leavePolicy.findFirst({ where: { requestType: request.type, active: true } });
  if (!policy) return null;
  const orgId = requireOrgId();

  const existing = await prisma.leaveEvent.findFirst({
    where: { sourceType: "staff_request", sourceId: request.id, kind: "usage" }
  });
  if (existing) return existing;

  const employee = await prisma.employee.findFirst({
    where: { id: request.employeeId },
    select: { workSchedule: { select: { pattern: true } } }
  });
  const holidays = policy.excludePublicHolidays
    ? await holidaySetForYearRange(request.startDate, request.endDate)
    : new Set<string>();
  const days = workdayCount(request.startDate, request.endDate, {
    pattern: (employee?.workSchedule?.pattern as WeekPattern | null) ?? null,
    holidays,
    excludeHolidays: policy.excludePublicHolidays
  });
  if (days <= 0) return null;
  const amount = -toBasisUnits(days, { basis: policy.basis });
  return prisma.leaveEvent.create({
    data: {
      orgId,
      kind: "usage",
      employeeId: request.employeeId,
      policyId: policy.id,
      amount,
      eventDate: request.startDate,
      sourceType: "staff_request",
      sourceId: request.id,
      note: `${request.type} ${request.startDate.toISOString().slice(0, 10)} → ${request.endDate.toISOString().slice(0, 10)}`
    }
  });
}

export async function releaseLeaveEventForRequest(requestId: string, note = "") {
  const usage = await prisma.leaveEvent.findFirst({
    where: { sourceType: "staff_request", sourceId: requestId, kind: "usage" }
  });
  if (!usage) return null;
  const existing = await prisma.leaveEvent.findFirst({
    where: { sourceType: "staff_request_release", sourceId: requestId, kind: "usage_release" }
  });
  if (existing) return existing;
  return prisma.leaveEvent.create({
    data: {
      orgId: requireOrgId(),
      kind: "usage_release",
      employeeId: usage.employeeId,
      policyId: usage.policyId,
      amount: -usage.amount,
      eventDate: new Date(),
      sourceType: "staff_request_release",
      sourceId: requestId,
      note: note || "Leave request reversed after approval"
    }
  });
}

/** One-time backfill: usage events for every approved leave request that has none. */
export async function backfillLeaveEvents() {
  const requests = await prisma.staffRequest.findMany({
    where: {
      type: { in: [StaffRequestType.TIME_OFF, StaffRequestType.SICK_LEAVE, StaffRequestType.UNPAID_LEAVE] },
      status: { in: [StaffRequestStatus.APPROVED, StaffRequestStatus.COMPLETED] },
      startDate: { not: null },
      endDate: { not: null }
    },
    select: { id: true, employeeId: true, type: true, startDate: true, endDate: true }
  });
  let created = 0;
  let skipped = 0;
  for (const r of requests) {
    const existing = await prisma.leaveEvent.findFirst({
      where: { sourceType: "staff_request", sourceId: r.id, kind: "usage" },
      select: { id: true }
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const ev = await syncLeaveEventForRequest(r);
    if (ev) created += 1;
  }
  return { requests: requests.length, created, skipped };
}

// ---------------------------------------------------------------------------
// Accrual + carryover posting (idempotent per year/month/policy/employee)
// ---------------------------------------------------------------------------

type AssignmentRow = { employeeId: string; effectiveFrom: Date; effectiveTo: Date | null };

async function assignmentAudience(policyId: string, year: number): Promise<AssignmentRow[]> {
  const rows = await prisma.leavePolicyAssignment.findMany({
    where: { policyId },
    select: { employeeId: true, effectiveFrom: true, effectiveTo: true }
  });
  if (rows.length) return rows;
  // no assignment rows -> org-wide: every active employee from their start date
  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, employmentStartDate: true, createdAt: true }
  });
  return employees.map((e) => ({
    employeeId: e.id,
    effectiveFrom: e.employmentStartDate ?? e.createdAt,
    effectiveTo: null
  }));
}

/** Post accrual events for a year (completed months only). Idempotent. */
export async function postAccruals(year: number, asOf = new Date()) {
  const orgId = requireOrgId();
  const policies = await prisma.leavePolicy.findMany({ where: { active: true } });
  let posted = 0;
  let capped = 0;
  for (const policy of policies) {
    const audience = await assignmentAudience(policy.id, year);
    for (const a of audience) {
      if (a.effectiveTo && a.effectiveTo < new Date(Date.UTC(year, 0, 1))) continue;
      const specs = accrualSpecs(policy, a.effectiveFrom, year, asOf);
      for (const spec of specs) {
        const sourceId = `${year}-${spec.month}-${policy.id}-${a.employeeId}`;
        const existing = await prisma.leaveEvent.findFirst({
          where: { sourceType: "accrual_run", sourceId },
          select: { id: true }
        });
        if (existing) continue;
        let amount = spec.amount;
        if (policy.maxBalance > 0) {
          const events = await prisma.leaveEvent.findMany({
            where: { employeeId: a.employeeId, policyId: policy.id },
            select: { amount: true, eventDate: true }
          });
          const current = balanceFromEvents(events);
          const allowed = cappedAccrual(current, amount, policy.maxBalance);
          if (allowed < amount) capped += 1;
          amount = allowed;
          if (amount <= 0) continue;
        }
        await prisma.leaveEvent.create({
          data: {
            orgId,
            kind: "accrual",
            employeeId: a.employeeId,
            policyId: policy.id,
            amount,
            eventDate: spec.month === 0 ? new Date(Date.UTC(year, 0, 1)) : new Date(Date.UTC(year, spec.month, 1)),
            sourceType: "accrual_run",
            sourceId,
            note: spec.month === 0 ? `Up-front allowance ${year}` : `Accrual ${year}-${String(spec.month).padStart(2, "0")}`
          }
        });
        posted += 1;
      }
    }
  }
  return { year, posted, capped };
}

/** Post carryover events on Jan 1 of `year` from the prior year's closing balance. Idempotent. */
export async function postCarryovers(year: number) {
  const orgId = requireOrgId();
  const policies = await prisma.leavePolicy.findMany({ where: { active: true, carryoverCap: { gt: 0 } } });
  let posted = 0;
  const yearStart = new Date(Date.UTC(year, 0, 1));
  for (const policy of policies) {
    const audience = await assignmentAudience(policy.id, year);
    for (const a of audience) {
      const sourceId = `${year}-carryover-${policy.id}-${a.employeeId}`;
      const existing = await prisma.leaveEvent.findFirst({
        where: { sourceType: "carryover_run", sourceId },
        select: { id: true }
      });
      if (existing) continue;
      const prior = await prisma.leaveEvent.findMany({
        where: { employeeId: a.employeeId, policyId: policy.id, eventDate: { lt: yearStart } },
        select: { amount: true, eventDate: true }
      });
      const amount = carryoverAmount(balanceFromEvents(prior), policy.carryoverCap);
      if (amount <= 0) continue;
      await prisma.leaveEvent.create({
        data: {
          orgId,
          kind: "carryover",
          employeeId: a.employeeId,
          policyId: policy.id,
          amount,
          eventDate: yearStart,
          sourceType: "carryover_run",
          sourceId,
          note: `Carryover into ${year} (cap ${policy.carryoverCap})`
        }
      });
      posted += 1;
    }
  }
  return { year, posted };
}

// ---------------------------------------------------------------------------
// Balances + time-for-time
// ---------------------------------------------------------------------------

export async function leaveBalancesV2(year: number, employeeId?: string) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [policies, employees, events, pendingRequests] = await Promise.all([
    prisma.leavePolicy.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.employee.findMany({
      where: { ...(employeeId ? { id: employeeId } : { active: true }) },
      select: { id: true, fullName: true, role: true, active: true },
      orderBy: { fullName: "asc" }
    }),
    prisma.leaveEvent.findMany({
      where: { eventDate: { lt: yearEnd }, ...(employeeId ? { employeeId } : {}) },
      select: { employeeId: true, policyId: true, kind: true, amount: true, eventDate: true }
    }),
    prisma.staffRequest.findMany({
      where: {
        type: { in: [StaffRequestType.TIME_OFF, StaffRequestType.SICK_LEAVE, StaffRequestType.UNPAID_LEAVE] },
        status: { in: [StaffRequestStatus.SUBMITTED, StaffRequestStatus.UNDER_REVIEW] },
        startDate: { lt: yearEnd },
        endDate: { gte: yearStart },
        ...(employeeId ? { employeeId } : {})
      },
      select: { employeeId: true, type: true, startDate: true, endDate: true }
    })
  ]);

  const rows = employees.map((employee) => {
    const balances = policies.map((policy) => {
      const ev = events.filter((e) => e.employeeId === employee.id && e.policyId === policy.id);
      const balance = balanceFromEvents(ev);
      const used = Math.round(
        -ev.filter((e) => e.kind === "usage" && e.eventDate >= yearStart).reduce((s, e) => s + e.amount, 0) * 100
      ) / 100;
      const pending = pendingRequests
        .filter((r) => r.employeeId === employee.id && r.type === policy.requestType && r.startDate && r.endDate)
        .reduce((s, r) => s + workdayCount(r.startDate!, r.endDate!), 0);
      return {
        policyId: policy.id,
        code: policy.code,
        name: policy.name,
        basis: policy.basis,
        paid: policy.paid,
        balance,
        used,
        pending: toBasisUnits(pending, policy),
        accrued: Math.round(ev.filter((e) => e.kind === "accrual" && e.eventDate >= yearStart).reduce((s, e) => s + e.amount, 0) * 100) / 100,
        carried: Math.round(ev.filter((e) => e.kind === "carryover" && e.eventDate >= yearStart).reduce((s, e) => s + e.amount, 0) * 100) / 100
      };
    });
    return { employee, balances };
  });
  return { year, policies, rows };
}

/** Convert approved overtime hours into a leave credit on an hours-basis policy. */
export async function convertOvertimeToLeave(
  employeeId: string,
  policyId: string,
  hours: number,
  note: string,
  actorUserId?: string
) {
  const policy = await prisma.leavePolicy.findFirst({ where: { id: policyId, active: true } });
  if (!policy) throw new Error("Leave policy not found.");
  if (policy.basis !== "hours") throw new Error("Time-for-time requires an hours-basis policy.");
  if (!Number.isFinite(hours) || hours <= 0 || hours > 500) throw new Error("Hours must be between 0 and 500.");
  const sourceId = `tft-${employeeId}-${policyId}-${Date.now()}`;
  return prisma.leaveEvent.create({
    data: {
      orgId: requireOrgId(),
      kind: "time_for_time",
      employeeId,
      policyId,
      amount: Math.round(hours * 100) / 100,
      eventDate: new Date(),
      sourceType: "time_for_time",
      sourceId,
      note: note || "Overtime converted to time-for-time leave",
      createdByUserId: actorUserId ?? null
    }
  });
}
