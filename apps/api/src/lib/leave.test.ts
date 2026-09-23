import assert from "node:assert/strict";
import test from "node:test";
import { StaffRequestStatus, StaffRequestType } from "@kleentoditee/db";
import {
  businessDaysBetween,
  businessDaysOverlap,
  computeUnpaidLeaveDeduction
} from "./leave-days.js";
import { computeLeaveBalances, type LeavePolicyLike } from "./leave.js";
import { buildRunItemsFromEntries, type RunPeriodLike } from "./payroll-run-builder.js";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

test("businessDaysBetween counts weekdays inclusively and skips weekends", () => {
  // Mon 2026-09-14 → Fri 2026-09-18 = 5 days
  assert.equal(businessDaysBetween(d("2026-09-14"), d("2026-09-18")), 5);
  // Fri → Mon spans a weekend = 2 days
  assert.equal(businessDaysBetween(d("2026-09-18"), d("2026-09-21")), 2);
  // single Saturday = 0
  assert.equal(businessDaysBetween(d("2026-09-19"), d("2026-09-19")), 0);
  // full week Mon–Sun = 5
  assert.equal(businessDaysBetween(d("2026-09-14"), d("2026-09-20")), 5);
  // inverted range = 0
  assert.equal(businessDaysBetween(d("2026-09-18"), d("2026-09-14")), 0);
});

test("businessDaysOverlap clamps the request to the period", () => {
  // request Wed 16th → Wed 23rd; period starts Mon 21st → counts Mon 21–Wed 23 = 3
  assert.equal(businessDaysOverlap(d("2026-09-16"), d("2026-09-23"), d("2026-09-21"), d("2026-09-30")), 3);
  // no overlap
  assert.equal(businessDaysOverlap(d("2026-08-03"), d("2026-08-07"), d("2026-09-01"), d("2026-09-30")), 0);
});

test("computeUnpaidLeaveDeduction pro-rates fixed pay and respects caps", () => {
  // 5 unpaid days out of 22 standard days on $2,200 fixed = $500
  assert.equal(
    computeUnpaidLeaveDeduction({ basePayType: "fixed", fixedPay: 2200, standardDays: 22, periodBusinessDays: 22, unpaidLeaveDays: 5 }),
    500
  );
  // capped at fixed pay
  assert.equal(
    computeUnpaidLeaveDeduction({ basePayType: "fixed", fixedPay: 2200, standardDays: 22, periodBusinessDays: 22, unpaidLeaveDays: 30 }),
    2200
  );
  // daily/hourly employees are not adjusted (no time entry = no pay already)
  assert.equal(
    computeUnpaidLeaveDeduction({ basePayType: "daily", fixedPay: 0, standardDays: 0, periodBusinessDays: 22, unpaidLeaveDays: 5 }),
    0
  );
  // falls back to period business days when standardDays is unset
  assert.equal(
    computeUnpaidLeaveDeduction({ basePayType: "fixed", fixedPay: 1000, standardDays: 0, periodBusinessDays: 20, unpaidLeaveDays: 10 }),
    500
  );
});

const policies: LeavePolicyLike[] = [
  { id: "p1", code: "ANNUAL", name: "Annual vacation", requestType: StaffRequestType.TIME_OFF, paid: true, annualAllowanceDays: 15, active: true, sortOrder: 1 },
  { id: "p2", code: "SICK", name: "Sick leave", requestType: StaffRequestType.SICK_LEAVE, paid: true, annualAllowanceDays: 10, active: true, sortOrder: 2 },
  { id: "p3", code: "UNPAID", name: "Unpaid leave", requestType: StaffRequestType.UNPAID_LEAVE, paid: false, annualAllowanceDays: 0, active: true, sortOrder: 3 }
];

test("computeLeaveBalances separates used, pending, and remaining days", () => {
  const balances = computeLeaveBalances(policies, [
    { employeeId: "e1", type: StaffRequestType.TIME_OFF, status: StaffRequestStatus.APPROVED, startDate: d("2026-03-02"), endDate: d("2026-03-06") }, // 5 used
    { employeeId: "e1", type: StaffRequestType.TIME_OFF, status: StaffRequestStatus.SUBMITTED, startDate: d("2026-07-06"), endDate: d("2026-07-08") }, // 3 pending
    { employeeId: "e1", type: StaffRequestType.TIME_OFF, status: StaffRequestStatus.DENIED, startDate: d("2026-05-04"), endDate: d("2026-05-08") }, // ignored
    { employeeId: "e1", type: StaffRequestType.SICK_LEAVE, status: StaffRequestStatus.COMPLETED, startDate: d("2026-02-02"), endDate: d("2026-02-03") }, // 2 used
    { employeeId: "e1", type: StaffRequestType.UNPAID_LEAVE, status: StaffRequestStatus.APPROVED, startDate: d("2026-09-14"), endDate: d("2026-09-18") } // 5 used, untracked
  ]);
  const annual = balances.find((b) => b.code === "ANNUAL");
  assert.ok(annual);
  assert.equal(annual.usedDays, 5);
  assert.equal(annual.pendingDays, 3);
  assert.equal(annual.remainingDays, 7); // 15 - 5 - 3
  const sick = balances.find((b) => b.code === "SICK");
  assert.ok(sick);
  assert.equal(sick.usedDays, 2);
  assert.equal(sick.remainingDays, 8);
  const unpaid = balances.find((b) => b.code === "UNPAID");
  assert.ok(unpaid);
  assert.equal(unpaid.usedDays, 5);
  assert.equal(unpaid.remainingDays, null); // untracked policy
});

test("pay run pro-rates fixed salary for approved unpaid leave and statutory follows", () => {
  const period: RunPeriodLike = {
    schedule: "monthly",
    startDate: d("2026-09-01"),
    endDate: d("2026-09-30") // 22 business days
  };
  const fixedEmployee = {
    id: "emp-fixed",
    fullName: "Maria Monthly",
    role: "Cleaner",
    defaultSite: "Site A",
    paySchedule: "monthly" as const,
    basePayType: "fixed" as const,
    dailyRate: 0,
    hourlyRate: 0,
    overtimeRate: 0,
    fixedPay: 2200,
    standardDays: 22,
    templateName: "Standard"
  };

  const withoutLeave = buildRunItemsFromEntries(period, [], undefined, { fixedEmployees: [fixedEmployee] });
  const withLeave = buildRunItemsFromEntries(period, [], undefined, {
    fixedEmployees: [fixedEmployee],
    unpaidLeaveDaysByEmployee: new Map([["emp-fixed", 11]])
  });

  assert.equal(withoutLeave[0].gross, 2200);
  assert.equal(withoutLeave[0].unpaidLeaveDeduction, 0);
  // 11 of 22 days unpaid → half the fixed pay ($1,100) removed from gross.
  assert.equal(withLeave[0].unpaidLeaveDays, 11);
  assert.equal(withLeave[0].unpaidLeaveDeduction, 1100);
  assert.equal(withLeave[0].gross, 1100);
  // Statutory is computed on the reduced gross (NHI 3.75% default).
  assert.equal(withLeave[0].nhi, round2(1100 * 0.0375));
  assert.ok(withLeave[0].nhi < withoutLeave[0].nhi);
  // Register invariant still holds: gross = net + deductions.
  assert.equal(withLeave[0].gross, round2(withLeave[0].net + withLeave[0].totalDeductions));
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
