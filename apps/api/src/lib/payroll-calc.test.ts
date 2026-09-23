import assert from "node:assert/strict";
import test from "node:test";
import type { PayBasis } from "@kleentoditee/db";
import {
  computeEmployeeRunLine,
  computeEntryPreview,
  computeLineEarnings,
  computeStatutoryDeductions,
  roundMoney,
  type RunLineEntryInput
} from "./payroll-calc.js";
import { BVI_STATUTORY_DEFAULTS, statutoryConfigFromRates } from "./statutory-config.js";

function employee(overrides: Partial<{
  basePayType: PayBasis;
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
  fixedPay: number;
}> = {}) {
  return {
    basePayType: "daily" as PayBasis,
    dailyRate: 100,
    hourlyRate: 20,
    overtimeRate: 30,
    fixedPay: 0,
    ...overrides
  };
}

function entry(overrides: Partial<RunLineEntryInput> = {}): RunLineEntryInput {
  return {
    daysWorked: 0,
    hoursWorked: 0,
    overtimeHours: 0,
    flatGross: 0,
    bonus: 0,
    allowance: 0,
    advanceDeduction: 0,
    withdrawalDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0,
    applyNhi: false,
    applySsb: false,
    applyIncomeTax: false,
    ...overrides
  };
}

test("roundMoney rounds to two decimals", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(2.345), 2.35);
});

test("computeLineEarnings pays daily basis per day and never stacks hours as base (issue #7)", () => {
  const result = computeLineEarnings(employee({ basePayType: "daily" }), {
    daysWorked: 5,
    hoursWorked: 4,
    overtimeHours: 0,
    flatGross: 0,
    bonus: 0,
    allowance: 0
  });
  // 5 days * 100 = 500. The 4 hoursWorked do NOT add 4 * 20 on top.
  assert.equal(result.base, 5 * 100);
  assert.equal(result.gross, 500);
});

test("computeLineEarnings excludes the fixed salary from per-line base", () => {
  const result = computeLineEarnings(employee({ basePayType: "fixed", fixedPay: 3000 }), {
    daysWorked: 10,
    hoursWorked: 5,
    overtimeHours: 0,
    flatGross: 0,
    bonus: 50,
    allowance: 25
  });
  assert.equal(result.base, 0);
  assert.equal(result.variable, 75);
});

test("computeLineEarnings honours flatGross as an override", () => {
  const result = computeLineEarnings(employee({ basePayType: "hourly" }), {
    daysWorked: 0,
    hoursWorked: 40,
    overtimeHours: 0,
    flatGross: 999,
    bonus: 0,
    allowance: 0
  });
  assert.equal(result.base, 999);
});

test("computeStatutoryDeductions splits employee/employer and respects the ceiling", () => {
  const config = {
    ...BVI_STATUTORY_DEFAULTS,
    socialSecurity: { employeeRate: 0.04, employerRate: 0.06, periodCeiling: 1500, enabled: true }
  };
  const result = computeStatutoryDeductions(2000, config, { nhi: false, ssb: true, incomeTax: false });
  assert.equal(result.employee.ssb, 1500 * 0.04);
  assert.equal(result.employer.ssb, 1500 * 0.06);
});

test("computeStatutoryDeductions keeps BVI income tax disabled (no PAYE)", () => {
  const config = statutoryConfigFromRates({ ssbRate: 0.05, nhiRate: 0.03, incomeTaxRate: 0.25 });
  const result = computeStatutoryDeductions(1000, config, { nhi: true, ssb: true, incomeTax: true });
  assert.equal(result.employee.incomeTax, 0);
  assert.equal(result.employee.ssb, 50);
  assert.equal(result.employee.nhi, 30);
});

test("computeEntryPreview computes a single line with statutory withholding", () => {
  const preview = computeEntryPreview(
    employee({ basePayType: "daily", dailyRate: 100 }),
    { nhiRate: 0.03, ssbRate: 0.05, incomeTaxRate: 0 },
    entry({ daysWorked: 10, applyNhi: true, applySsb: true })
  );
  assert.equal(preview.gross, 1000);
  assert.equal(preview.breakdown.nhi, 30);
  assert.equal(preview.breakdown.ssb, 50);
  assert.equal(preview.totalDeductions, 80);
  assert.equal(preview.net, 920);
});

test("computeEmployeeRunLine applies a fixed salary only once across multiple lines (issue #2)", () => {
  const result = computeEmployeeRunLine(employee({ basePayType: "fixed", fixedPay: 2000 }), [
    entry({ bonus: 100 }),
    entry({ bonus: 50 }),
    entry({ allowance: 25 })
  ]);
  // 2000 salary once + 100 + 50 + 25 of variable pay = 2175 (NOT 6000+).
  assert.equal(result.gross, 2175);
});

test("computeEmployeeRunLine aggregates daily lines per day without stacking hours (issue #7)", () => {
  const result = computeEmployeeRunLine(employee({ basePayType: "daily", dailyRate: 100, hourlyRate: 20 }), [
    entry({ daysWorked: 5 }),
    entry({ daysWorked: 3, hoursWorked: 4 })
  ]);
  // (5 + 3) days * 100 = 800. hoursWorked is informational and never added.
  assert.equal(result.gross, 5 * 100 + 3 * 100);
  assert.equal(result.daysWorked, 8);
  assert.equal(result.hoursWorked, 4);
});

test("computeEmployeeRunLine computes statutory once on aggregate gross, not per line", () => {
  // Ceiling below the aggregate gross proves the deduction is computed once.
  const config = {
    ...BVI_STATUTORY_DEFAULTS,
    socialSecurity: { employeeRate: 0.05, employerRate: 0, periodCeiling: 1500, enabled: true }
  };
  const result = computeEmployeeRunLine(
    employee({ basePayType: "daily", dailyRate: 100 }),
    [entry({ daysWorked: 10, applySsb: true }), entry({ daysWorked: 10, applySsb: true })],
    config
  );
  assert.equal(result.gross, 2000);
  // Once on capped 1500 = 75. Per-line would be 0.05*1000 + 0.05*1000 = 100.
  assert.equal(result.ssb, 75);
});

test("computeEmployeeRunLine deducts statutory once and manual summed, never per line (issue #14)", () => {
  // Two lines, each below the ceiling individually but together above it.
  // Statutory must be computed once on the capped aggregate gross while manual
  // deductions are summed; neither may be applied per line and double-counted.
  const config = {
    ...BVI_STATUTORY_DEFAULTS,
    socialSecurity: { employeeRate: 0.05, employerRate: 0.07, periodCeiling: 1500, enabled: true }
  };
  const result = computeEmployeeRunLine(
    employee({ basePayType: "daily", dailyRate: 100 }),
    [
      entry({ daysWorked: 10, applySsb: true, advanceDeduction: 40 }),
      entry({ daysWorked: 10, applySsb: true, loanDeduction: 60 })
    ],
    config
  );
  assert.equal(result.gross, 2000);
  // SSB once on capped 1500: employee 75, employer 105. Per-line would be 100/140.
  assert.equal(result.ssb, 75);
  assert.equal(result.employerContributions.ssb, 105);
  // Manual deductions summed once across lines.
  assert.equal(result.manualDeductions, 100);
  assert.equal(result.totalDeductions, 175);
  assert.equal(result.net, 2000 - 175);
});

test("computeEmployeeRunLine sums manual deductions across lines", () => {
  const result = computeEmployeeRunLine(employee({ basePayType: "daily", dailyRate: 100 }), [
    entry({ daysWorked: 5, advanceDeduction: 50 }),
    entry({ daysWorked: 5, loanDeduction: 25, otherDeduction: 10 })
  ]);
  assert.equal(result.manualDeductions, 85);
  assert.equal(result.net, 1000 - 85);
});

test("payroll tax applies only to current gross above the remaining annual exemption", () => {
  const config = {
    ...BVI_STATUTORY_DEFAULTS,
    socialSecurity: { ...BVI_STATUTORY_DEFAULTS.socialSecurity, enabled: false },
    nationalHealthInsurance: { ...BVI_STATUTORY_DEFAULTS.nationalHealthInsurance, enabled: false },
    payrollTax: {
      ...BVI_STATUTORY_DEFAULTS.payrollTax,
      employerClass: "CLASS_1" as const,
      employerRate: 0.02
    }
  };
  const result = computeEmployeeRunLine(
    employee({ basePayType: "fixed", fixedPay: 2000 }),
    [],
    config,
    { yearToDateGross: 9000, exemptionEnabled: true }
  );
  assert.equal(result.payrollTax, 80);
  assert.equal(result.employerPayrollTax, 20);
  assert.equal(result.net, 1920);
});
