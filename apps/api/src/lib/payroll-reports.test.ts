import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateYearSummary,
  buildRegisterCsv,
  buildRegisterLines,
  reconcileRunItem,
  summarizeRegisterLines,
  type RegisterSourceItem
} from "./payroll-reports.js";

function item(overrides: Partial<RegisterSourceItem> = {}): RegisterSourceItem {
  return {
    employeeName: "Maria Monthly",
    employeeRole: "Cleaner",
    defaultSite: "Site A",
    paySchedule: "monthly",
    payBasis: "fixed",
    templateName: "Standard",
    gross: 2000,
    nhi: 75,
    ssb: 80,
    incomeTax: 0,
    payrollTax: 80,
    manualDeductions: 100,
    totalDeductions: 335,
    net: 1665,
    employerNhi: 75,
    employerSsb: 90,
    employerPayrollTax: 0,
    daysWorked: 22,
    hoursWorked: 0,
    overtimeHours: 0,
    ...overrides
  };
}

test("reconcileRunItem passes a consistent frozen line", () => {
  assert.deepEqual(reconcileRunItem(item()), []);
});

test("reconcileRunItem flags deduction, net, and negative-net inconsistencies", () => {
  assert.ok(reconcileRunItem(item({ totalDeductions: 300 }))[0].includes("totalDeductions"));
  assert.ok(reconcileRunItem(item({ net: 1600 }))[0].includes("gross"));
  assert.ok(reconcileRunItem(item({ net: -5, totalDeductions: 2005 })).some((i) => i.includes("negative")));
});

test("register lines compute employer cost and totals reconcile", () => {
  const lines = buildRegisterLines([
    item(),
    item({ employeeName: "Kemario Watson", gross: 1500, nhi: 56.25, ssb: 60, payrollTax: 40, manualDeductions: 0, totalDeductions: 156.25, net: 1343.75, employerNhi: 56.25, employerSsb: 67.5, daysWorked: 15 })
  ]);
  assert.equal(lines[0].employerCost, 165); // 75 + 90 + 0
  const totals = summarizeRegisterLines(lines);
  assert.equal(totals.employees, 2);
  assert.equal(totals.gross, 3500);
  assert.equal(totals.net, 3008.75);
  assert.equal(totals.totalDeductions, 491.25);
  // Register invariant: gross = net + deductions.
  assert.equal(totals.gross, Math.round((totals.net + totals.totalDeductions) * 100) / 100);
  assert.equal(totals.daysWorked, 37);
});

test("buildRegisterCsv renders header block, escaped names, and totals", () => {
  const lines = buildRegisterLines([item({ employeeName: 'Watson, "Junior"' })]);
  const totals = summarizeRegisterLines(lines);
  const csv = buildRegisterCsv(
    {
      label: "",
      schedule: "monthly",
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
      payDate: null
    },
    "finalized",
    lines,
    totals
  );
  assert.ok(csv.startsWith("Payroll register,"));
  assert.ok(csv.includes("Period,2026-04-01,to,2026-04-30"));
  assert.ok(csv.includes('"Watson, ""Junior"""'));
  assert.ok(csv.includes("Totals (1 employees)"));
  assert.ok(csv.includes("2000.00"));
  assert.ok(csv.endsWith("\r\n"));
});

test("aggregateYearSummary merges opening balances with posted run lines", () => {
  const { rows, totals } = aggregateYearSummary(
    [
      { id: "emp-1", fullName: "Maria Monthly", email: "m@x.com", paySchedule: "monthly", active: true },
      { id: "emp-2", fullName: "Kemario Watson", email: "k@x.com", paySchedule: "monthly", active: true }
    ],
    [{ employeeId: "emp-1", gross: 9000, source: "csv-import" }],
    [
      { ...item(), employeeId: "emp-1" },
      { ...item({ employeeName: "Kemario Watson", gross: 1500, totalDeductions: 156.25, net: 1343.75, payrollTax: 40, nhi: 56.25, ssb: 60 }), employeeId: "emp-2" }
    ]
  );
  assert.equal(rows.length, 2);
  const maria = rows.find((row) => row.employeeId === "emp-1");
  assert.ok(maria);
  assert.equal(maria.openingGross, 9000);
  assert.equal(maria.runsGross, 2000);
  assert.equal(maria.gross, 11000); // opening + posted runs = YTD gross
  assert.equal(maria.runCount, 1);
  const kemario = rows.find((row) => row.employeeId === "emp-2");
  assert.ok(kemario);
  assert.equal(kemario.openingGross, 0);
  assert.equal(kemario.gross, 1500);
  assert.equal(totals.employees, 2);
  assert.equal(totals.gross, 12500);
  assert.equal(totals.openingGross, 9000);
  assert.equal(totals.runsGross, 3500);
});

test("aggregateYearSummary keeps run lines for employees missing from the directory", () => {
  const { rows } = aggregateYearSummary([], [], [{ ...item(), employeeId: "emp-gone" }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].employeeName, "Maria Monthly");
  assert.equal(rows[0].active, false);
  assert.equal(rows[0].gross, 2000);
});

test("aggregateYearSummary counts only employees with activity in totals", () => {
  const { totals } = aggregateYearSummary(
    [
      { id: "emp-1", fullName: "Active One", email: "", paySchedule: "monthly", active: true },
      { id: "emp-2", fullName: "Idle Two", email: "", paySchedule: "monthly", active: true }
    ],
    [],
    [{ ...item(), employeeId: "emp-1" }]
  );
  assert.equal(totals.employees, 1);
  assert.equal(totals.runCount, 1);
});
