import { StaffRequestStatus, StaffRequestType, prisma } from "@kleentoditee/db";
import { roundMoney } from "./payroll-calc.js";
import { businessDaysBetween, businessDaysOverlap } from "./leave-days.js";

export { businessDaysBetween, businessDaysOverlap, computeUnpaidLeaveDeduction } from "./leave-days.js";

/**
 * Leave / time-off domain (research R8).
 *
 * Policies (`LeavePolicy`) map a staff-request type to a paid/unpaid scheme
 * with an optional annual business-day allowance. Balances are computed from
 * the existing StaffRequest flow — employees already submit TIME_OFF /
 * SICK_LEAVE (and now UNPAID_LEAVE) requests that admins review in the Staff
 * requests queue — so there is a single source of truth for leave history.
 *
 * Payroll impact: approved UNPAID_LEAVE business days overlapping a pay
 * period reduce a fixed-basis employee's fixed pay pro-rata (daily/hourly
 * staff simply have no time entries on those days, so no extra deduction).
 *
 * Day counting and balance aggregation are pure functions for unit testing.
 */

export const REQUEST_TYPE_TO_POLICY_CODE: Partial<Record<StaffRequestType, string>> = {
  [StaffRequestType.TIME_OFF]: "ANNUAL",
  [StaffRequestType.SICK_LEAVE]: "SICK",
  [StaffRequestType.UNPAID_LEAVE]: "UNPAID"
};

export const LEAVE_REQUEST_TYPES = [
  StaffRequestType.TIME_OFF,
  StaffRequestType.SICK_LEAVE,
  StaffRequestType.UNPAID_LEAVE
] as const;

export const DEFAULT_LEAVE_POLICIES = [
  {
    code: "ANNUAL",
    name: "Annual vacation",
    requestType: StaffRequestType.TIME_OFF,
    paid: true,
    annualAllowanceDays: 15,
    sortOrder: 1
  },
  {
    code: "SICK",
    name: "Sick leave",
    requestType: StaffRequestType.SICK_LEAVE,
    paid: true,
    annualAllowanceDays: 10,
    sortOrder: 2
  },
  {
    code: "UNPAID",
    name: "Unpaid leave",
    requestType: StaffRequestType.UNPAID_LEAVE,
    paid: false,
    annualAllowanceDays: 0,
    sortOrder: 3
  }
] as const;

export type LeavePolicyLike = {
  id: string;
  code: string;
  name: string;
  requestType: StaffRequestType;
  paid: boolean;
  annualAllowanceDays: number;
  active: boolean;
  sortOrder: number;
};

export type LeaveRequestLike = {
  employeeId: string;
  type: StaffRequestType;
  status: StaffRequestStatus;
  startDate: Date | null;
  endDate: Date | null;
};

export type LeavePolicyBalance = {
  policyId: string;
  code: string;
  name: string;
  paid: boolean;
  allowanceDays: number;
  usedDays: number;
  pendingDays: number;
  /** null when the policy is untracked (allowance 0). */
  remainingDays: number | null;
};

const USED_STATUSES = new Set<StaffRequestStatus>([StaffRequestStatus.APPROVED, StaffRequestStatus.COMPLETED]);
const PENDING_STATUSES = new Set<StaffRequestStatus>([
  StaffRequestStatus.SUBMITTED,
  StaffRequestStatus.UNDER_REVIEW
]);

/** Pure balance computation for one employee from policies + their requests. */
export function computeLeaveBalances(
  policies: LeavePolicyLike[],
  requests: LeaveRequestLike[]
): LeavePolicyBalance[] {
  return policies
    .filter((policy) => policy.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((policy) => {
      let usedDays = 0;
      let pendingDays = 0;
      for (const request of requests) {
        if (request.type !== policy.requestType || !request.startDate || !request.endDate) {
          continue;
        }
        const days = businessDaysBetween(request.startDate, request.endDate);
        if (USED_STATUSES.has(request.status)) {
          usedDays += days;
        } else if (PENDING_STATUSES.has(request.status)) {
          pendingDays += days;
        }
      }
      const tracked = policy.annualAllowanceDays > 0;
      return {
        policyId: policy.id,
        code: policy.code,
        name: policy.name,
        paid: policy.paid,
        allowanceDays: policy.annualAllowanceDays,
        usedDays,
        pendingDays,
        remainingDays: tracked ? roundMoney(policy.annualAllowanceDays - usedDays - pendingDays) : null
      };
    });
}

/** Idempotently creates the three default policies; never overwrites admin edits. */
export async function ensureDefaultLeavePolicies() {
  for (const policy of DEFAULT_LEAVE_POLICIES) {
    await prisma.leavePolicy.upsert({
      where: { code: policy.code },
      create: {
        code: policy.code,
        name: policy.name,
        requestType: policy.requestType,
        paid: policy.paid,
        annualAllowanceDays: policy.annualAllowanceDays,
        sortOrder: policy.sortOrder
      },
      update: {}
    });
  }
  return prisma.leavePolicy.findMany({ orderBy: [{ sortOrder: "asc" }, { code: "asc" }] });
}

/**
 * Approved unpaid-leave business days overlapping a pay period, per employee.
 * Used by the pay-run builder to pro-rate fixed-basis salaries.
 */
export async function loadUnpaidLeaveDaysByEmployee(
  employeeIds: string[],
  period: { startDate: Date; endDate: Date }
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!employeeIds.length) {
    return result;
  }
  const requests = await prisma.staffRequest.findMany({
    where: {
      employeeId: { in: employeeIds },
      type: StaffRequestType.UNPAID_LEAVE,
      status: { in: [...USED_STATUSES] },
      startDate: { lte: period.endDate },
      endDate: { gte: period.startDate }
    },
    select: { employeeId: true, startDate: true, endDate: true }
  });
  for (const request of requests) {
    if (!request.startDate || !request.endDate) {
      continue;
    }
    const days = businessDaysOverlap(request.startDate, request.endDate, period.startDate, period.endDate);
    result.set(request.employeeId, (result.get(request.employeeId) ?? 0) + days);
  }
  return result;
}

export async function listLeaveBalances(year: number, employeeId?: string) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [policies, employees, requests] = await Promise.all([
    prisma.leavePolicy.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }] }),
    prisma.employee.findMany({
      where: { ...(employeeId ? { id: employeeId } : { active: true }) },
      select: { id: true, fullName: true, role: true, defaultSite: true, active: true },
      orderBy: { fullName: "asc" }
    }),
    prisma.staffRequest.findMany({
      where: {
        type: { in: [...LEAVE_REQUEST_TYPES] },
        startDate: { lt: yearEnd },
        endDate: { gte: yearStart },
        ...(employeeId ? { employeeId } : {})
      },
      select: { employeeId: true, type: true, status: true, startDate: true, endDate: true }
    })
  ]);

  const requestsByEmployee = new Map<string, LeaveRequestLike[]>();
  for (const request of requests) {
    requestsByEmployee.set(request.employeeId, [...(requestsByEmployee.get(request.employeeId) ?? []), request]);
  }

  const rows = employees.map((employee) => ({
    employee,
    balances: computeLeaveBalances(policies, requestsByEmployee.get(employee.id) ?? [])
  }));
  return { year, policies, rows };
}

export function isLeaveRequestType(type: StaffRequestType): boolean {
  return (LEAVE_REQUEST_TYPES as readonly StaffRequestType[]).includes(type);
}
