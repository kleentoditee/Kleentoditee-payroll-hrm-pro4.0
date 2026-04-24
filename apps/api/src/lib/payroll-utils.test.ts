import assert from "node:assert/strict";
import test from "node:test";
import type { PaySchedule } from "@kleentoditee/db";
import { buildPayrollCsv, buildPeriodLabel, isTimeEntryWithinPeriod } from "./payroll-utils.js";

function period(schedule: PaySchedule, startDate: string, endDate: string) {
  return {
    schedule,
    startDate: new Date(`${startDate}T00:00:00.000Z`),
    endDate: new Date(`${endDate}T00:00:00.000Z`)
  };
}

test("buildPeriodLabel formats monthly periods from the month name", () => {
  assert.equal(
    buildPeriodLabel(period("monthly", "2026-04-01", "2026-04-30")),
    "April 2026"
  );
});

test("buildPeriodLabel formats weekly periods with the date range", () => {
  assert.equal(
    buildPeriodLabel(period("weekly", "2026-04-06", "2026-04-12")),
    "Weekly 2026-04-06 to 2026-04-12"
  );
});

test("isTimeEntryWithinPeriod uses exact dates when they exist", () => {
  assert.equal(
    isTimeEntryWithinPeriod(period("biweekly", "2026-04-01", "2026-04-14"), {
      month: "2026-04",
      periodStart: new Date("2026-04-01T00:00:00.000Z"),
      periodEnd: new Date("2026-04-14T00:00:00.000Z")
    }),
    true
  );
  assert.equal(
    isTimeEntryWithinPeriod(period("biweekly", "2026-04-01", "2026-04-14"), {
      month: "2026-04",
      periodStart: new Date("2026-04-08T00:00:00.000Z"),
      periodEnd: new Date("2026-04-21T00:00:00.000Z")
    }),
    false
  );
});

test("isTimeEntryWithinPeriod falls back to month matching for monthly entries without dates", () => {
  assert.equal(
    isTimeEntryWithinPeriod(period("monthly", "2026-04-01", "2026-04-30"), {
      month: "2026-04",
      periodStart: null,
      periodEnd: null
    }),
    true
  );
  assert.equal(
    isTimeEntryWithinPeriod(period("monthly", "2026-04-01", "2026-04-30"), {
      month: "2026-05",
      periodStart: null,
      periodEnd: null
    }),
    false
  );
});

test("buildPayrollCsv emits a header row and employee totals", () => {
  const csv = buildPayrollCsv({
    label: "April 2026",
    schedule: "monthly",
    payDate: new Date("2026-04-30T00:00:00.000Z"),
    items: [
      {
        employeeName: "Alex Payroll",
        employeeRole: "Cleaner",
        defaultSite: "Ambergris",
        paySchedule: "monthly",
        gross: 1200,
        nhi: 45,
        ssb: 48,
        incomeTax: 20,
        manualDeductions: 15,
        totalDeductions: 128,
        net: 1072,
        daysWorked: 20,
        hoursWorked: 0,
        overtimeHours: 2,
        bonus: 50,
        allowance: 25
      }
    ]
  });

  assert.match(csv, /^Employee,Role,Site,Schedule,Period,Pay Date,Gross,/);
  assert.match(csv, /Alex Payroll,Cleaner,Ambergris,monthly,April 2026,2026-04-30,1200\.00/);
});
