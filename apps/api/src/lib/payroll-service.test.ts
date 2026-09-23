import assert from "node:assert/strict";
import test from "node:test";
import type { PayBasis, PaySchedule } from "@kleentoditee/db";
import {
  buildRunItemsFromEntries,
  type RunPeriodLike,
  type RunSourceEntry
} from "./payroll-run-builder.js";

function period(schedule: PaySchedule, startDate: string, endDate: string): RunPeriodLike {
  return {
    schedule,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`)
  };
}

let nextId = 0;

function sourceEntry(overrides: {
  employeeId: string;
  month: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  basePayType?: PayBasis;
  paySchedule?: PaySchedule;
  dailyRate?: number;
  hourlyRate?: number;
  overtimeRate?: number;
  fixedPay?: number;
  daysWorked?: number;
  hoursWorked?: number;
  overtimeHours?: number;
  bonus?: number;
  allowance?: number;
  flatGross?: number;
  fullName?: string;
  site?: string;
}): RunSourceEntry {
  nextId += 1;
  return {
    id: `entry-${nextId}`,
    month: overrides.month,
    periodStart: overrides.periodStart ? new Date(`${overrides.periodStart}T00:00:00.000Z`) : null,
    periodEnd: overrides.periodEnd ? new Date(`${overrides.periodEnd}T00:00:00.000Z`) : null,
    site: overrides.site ?? "Site A",
    daysWorked: overrides.daysWorked ?? 0,
    hoursWorked: overrides.hoursWorked ?? 0,
    overtimeHours: overrides.overtimeHours ?? 0,
    flatGross: overrides.flatGross ?? 0,
    bonus: overrides.bonus ?? 0,
    allowance: overrides.allowance ?? 0,
    advanceDeduction: 0,
    withdrawalDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    applyNhi: false,
    applySsb: false,
    applyIncomeTax: false,
    employeeId: overrides.employeeId,
    employee: {
      fullName: overrides.fullName ?? overrides.employeeId,
      role: "Cleaner",
      defaultSite: overrides.site ?? "Site A",
      paySchedule: overrides.paySchedule ?? "monthly",
      basePayType: overrides.basePayType ?? "daily",
      dailyRate: overrides.dailyRate ?? 100,
      hourlyRate: overrides.hourlyRate ?? 20,
      overtimeRate: overrides.overtimeRate ?? 30,
      fixedPay: overrides.fixedPay ?? 0
    },
    template: { name: "Standard", nhiRate: 0, ssbRate: 0, incomeTaxRate: 0 }
  };
}

test("monthly entries match the monthly period via explicit dates", () => {
  const items = buildRunItemsFromEntries(period("monthly", "2026-04-01", "2026-04-30"), [
    sourceEntry({
      employeeId: "emp-monthly",
      month: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      daysWorked: 20
    })
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].gross, 2000);
});

test("weekly entries with no period dates still match via the month fallback (issue #1)", () => {
  const items = buildRunItemsFromEntries(period("weekly", "2026-04-06", "2026-04-12"), [
    sourceEntry({
      employeeId: "emp-weekly",
      month: "2026-04",
      paySchedule: "weekly",
      daysWorked: 5
    })
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].employeeId, "emp-weekly");
  assert.equal(items[0].gross, 500);
});

test("biweekly entries with no period dates still match via the month fallback (issue #1)", () => {
  const items = buildRunItemsFromEntries(period("biweekly", "2026-04-01", "2026-04-14"), [
    sourceEntry({
      employeeId: "emp-biweekly",
      month: "2026-04",
      paySchedule: "biweekly",
      daysWorked: 10
    })
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].gross, 1000);
});

test("entries from a different month are excluded", () => {
  const items = buildRunItemsFromEntries(period("monthly", "2026-04-01", "2026-04-30"), [
    sourceEntry({ employeeId: "emp-x", month: "2026-05", daysWorked: 10 })
  ]);
  assert.equal(items.length, 0);
});

test("a fixed-pay employee with multiple site lines is paid the salary once (issue #2)", () => {
  const items = buildRunItemsFromEntries(period("monthly", "2026-04-01", "2026-04-30"), [
    sourceEntry({
      employeeId: "emp-fixed",
      month: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      basePayType: "fixed",
      fixedPay: 3000,
      site: "Site A",
      bonus: 100
    }),
    sourceEntry({
      employeeId: "emp-fixed",
      month: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      basePayType: "fixed",
      fixedPay: 3000,
      site: "Site B",
      bonus: 50
    })
  ]);
  assert.equal(items.length, 1);
  // 3000 salary once + 100 + 50 of bonuses = 3150 (NOT 6000+).
  assert.equal(items[0].gross, 3150);
  assert.equal(items[0].sourceEntryIds.length, 2);
});

test("a daily employee accumulates days across lines without stacking hours (issue #7)", () => {
  const items = buildRunItemsFromEntries(period("monthly", "2026-04-01", "2026-04-30"), [
    sourceEntry({
      employeeId: "emp-daily",
      month: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      dailyRate: 100,
      hourlyRate: 20,
      daysWorked: 10,
      hoursWorked: 0
    }),
    sourceEntry({
      employeeId: "emp-daily",
      month: "2026-04",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-30",
      dailyRate: 100,
      hourlyRate: 20,
      daysWorked: 5,
      hoursWorked: 8
    })
  ]);
  assert.equal(items.length, 1);
  // (10 + 5) days * 100 = 1500. The 8 hoursWorked are informational only.
  assert.equal(items[0].gross, 1500);
  assert.equal(items[0].daysWorked, 15);
  assert.equal(items[0].hoursWorked, 8);
});

test("a daily employee working multiple locations on one date is paid one day", () => {
  const items = buildRunItemsFromEntries(period("monthly", "2026-04-01", "2026-04-30"), [
    sourceEntry({
      employeeId: "emp-mobile",
      month: "2026-04",
      periodStart: "2026-04-08",
      periodEnd: "2026-04-08",
      dailyRate: 120,
      daysWorked: 1,
      hoursWorked: 4,
      site: "Villa A"
    }),
    sourceEntry({
      employeeId: "emp-mobile",
      month: "2026-04",
      periodStart: "2026-04-08",
      periodEnd: "2026-04-08",
      dailyRate: 120,
      daysWorked: 1,
      hoursWorked: 3,
      site: "Office B"
    })
  ]);
  assert.equal(items[0].daysWorked, 1);
  assert.equal(items[0].hoursWorked, 7);
  assert.equal(items[0].gross, 120);
  assert.equal(items[0].sourceSummary.length, 2);
});

test("a fixed-pay employee is included without a time entry", () => {
  const items = buildRunItemsFromEntries(
    period("monthly", "2026-04-01", "2026-04-30"),
    [],
    undefined,
    {
      fixedEmployees: [
        {
          id: "fixed-no-time",
          fullName: "Fixed Worker",
          role: "Manager",
          defaultSite: "Office",
          paySchedule: "monthly",
          basePayType: "fixed",
          dailyRate: 0,
          hourlyRate: 0,
          overtimeRate: 0,
          fixedPay: 3000,
          payrollTaxExemptionEnabled: true,
          templateName: "Standard"
        }
      ]
    }
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].gross, 3000);
  assert.deepEqual(items[0].sourceEntryIds, []);
});
