import assert from "node:assert/strict";
import test from "node:test";
import { computeEmployeeRunLine, type EmployeeRateInput, type RunLineEntryInput } from "./payroll-calc.js";
import { statutoryConfigFromOrgSettings, type StatutoryConfig } from "./statutory-config.js";
import type { PaySchedule } from "@kleentoditee/db";

/**
 * Batch 11 Gate A artifact: PARALLEL-RUN verification.
 * Every scenario below is computed twice: once by the production engine
 * (computeEmployeeRunLine) and once by the independent reference
 * implementation in this file (referenceLine), written straight from the BVI
 * statutory rules. They must agree within rounding tolerance.
 *
 * BVI rules encoded in the reference (2026, approved version srv_2026_bvi):
 * - SSB: 4% employee / 4.5% employer of insurable, annual ceiling 53,400.
 * - NHI: 3.75% / 3.75%, annual ceiling 106,800.
 * - Payroll tax: 8% employee on remuneration above the 10,000 annual
 *   exemption; employer Class 1 = 2%, Class 2 = 6%. No income tax in BVI.
 */

const RATES = {
  ssbEmployeeRate: 0.04,
  ssbEmployerRate: 0.045,
  ssbAnnualCeiling: 53400,
  ssbEnabled: true,
  nhiEmployeeRate: 0.0375,
  nhiEmployerRate: 0.0375,
  nhiAnnualCeiling: 106800,
  nhiEnabled: true,
  payrollTaxEnabled: true,
  payrollTaxEmployeeRate: 0.08,
  payrollTaxAnnualExemption: 10000,
  statutoryEffectiveYear: 2026
};

function configFor(schedule: PaySchedule, employerClass: "CLASS_1" | "CLASS_2"): StatutoryConfig {
  return statutoryConfigFromOrgSettings({ ...RATES, payrollTaxEmployerClass: employerClass }, schedule);
}

function ref2(v: number): number {
  return Math.round(v * 100) / 100;
}

function periodsPerYear(schedule: PaySchedule): number {
  return schedule === "weekly" ? 52 : schedule === "biweekly" ? 26 : 12;
}

/** Independent reference implementation — deliberately separate code path. */
function referenceLine(args: {
  gross: number;
  schedule: PaySchedule;
  employerClass: "CLASS_1" | "CLASS_2";
  priorYtdGross: number;
  applyNhi?: boolean;
  applySsb?: boolean;
}) {
  const periods = periodsPerYear(args.schedule);
  const applyNhi = args.applyNhi ?? true;
  const applySsb = args.applySsb ?? true;
  const ssbInsurable = Math.min(args.gross, RATES.ssbAnnualCeiling / periods);
  const nhiInsurable = Math.min(args.gross, RATES.nhiAnnualCeiling / periods);
  const ssb = applySsb ? ssbInsurable * RATES.ssbEmployeeRate : 0;
  const ssbEr = applySsb ? ssbInsurable * RATES.ssbEmployerRate : 0;
  const nhi = applyNhi ? nhiInsurable * RATES.nhiEmployeeRate : 0;
  const nhiEr = applyNhi ? nhiInsurable * RATES.nhiEmployerRate : 0;
  const before = Math.max(0, args.priorYtdGross - RATES.payrollTaxAnnualExemption);
  const after = Math.max(0, args.priorYtdGross + args.gross - RATES.payrollTaxAnnualExemption);
  const taxable = after - before;
  const payrollTax = taxable * RATES.payrollTaxEmployeeRate;
  const employerTax = taxable * (args.employerClass === "CLASS_1" ? 0.02 : 0.06);
  return {
    nhi: ref2(nhi),
    ssb: ref2(ssb),
    payrollTax: ref2(payrollTax),
    employerNhi: ref2(nhiEr),
    employerSsb: ref2(ssbEr),
    employerPayrollTax: ref2(employerTax),
    net: ref2(args.gross - ref2(nhi) - ref2(ssb) - ref2(payrollTax))
  };
}

function engineLine(args: {
  employee: EmployeeRateInput;
  entries: RunLineEntryInput[];
  schedule: PaySchedule;
  employerClass: "CLASS_1" | "CLASS_2";
  priorYtdGross: number;
}) {
  return computeEmployeeRunLine(args.employee, args.entries, configFor(args.schedule, args.employerClass), {
    yearToDateGross: args.priorYtdGross
  });
}

const FIXED = (fixedPay: number): EmployeeRateInput => ({
  basePayType: "fixed",
  dailyRate: 0,
  hourlyRate: 0,
  overtimeRate: 0,
  fixedPay
});

const NO_ENTRIES: RunLineEntryInput[] = [];

function expectClose(actual: number, expected: number, label: string) {
  assert.ok(
    Math.abs(actual - expected) <= 0.005,
    `${label}: engine ${actual} != reference ${expected}`
  );
}

function compare(args: {
  label: string;
  gross: number;
  schedule: PaySchedule;
  employerClass: "CLASS_1" | "CLASS_2";
  priorYtdGross: number;
}) {
  const engine = engineLine({
    employee: FIXED(args.gross),
    entries: NO_ENTRIES,
    schedule: args.schedule,
    employerClass: args.employerClass,
    priorYtdGross: args.priorYtdGross
  });
  const ref = referenceLine(args);
  expectClose(engine.nhi, ref.nhi, `${args.label} nhi`);
  expectClose(engine.ssb, ref.ssb, `${args.label} ssb`);
  expectClose(engine.payrollTax, ref.payrollTax, `${args.label} payrollTax`);
  expectClose(engine.incomeTax, 0, `${args.label} incomeTax must be zero in BVI`);
  expectClose(engine.employerContributions.nhi, ref.employerNhi, `${args.label} employer nhi`);
  expectClose(engine.employerContributions.ssb, ref.employerSsb, `${args.label} employer ssb`);
  expectClose(engine.employerPayrollTax, ref.employerPayrollTax, `${args.label} employer payroll tax`);
  expectClose(engine.net, ref.net, `${args.label} net`);
}

test("parallel: monthly salary under all ceilings, first run of year", () =>
  compare({ label: "monthly-1800", gross: 1800, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 0 }));

test("parallel: monthly salary crossing SSB and NHI ceilings with YTD above exemption", () =>
  compare({ label: "monthly-10000", gross: 10000, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 20000 }));

test("parallel: monthly high earner, Class 2 employer rate", () =>
  compare({ label: "monthly-12000-class2", gross: 12000, schedule: "monthly", employerClass: "CLASS_2", priorYtdGross: 50000 }));

test("parallel: weekly schedule ceiling conversion", () =>
  compare({ label: "weekly-1500", gross: 1500, schedule: "weekly", employerClass: "CLASS_1", priorYtdGross: 30000 }));

test("parallel: biweekly at SSB period ceiling boundary", () =>
  compare({ label: "biweekly-2053.85", gross: 2053.85, schedule: "biweekly", employerClass: "CLASS_1", priorYtdGross: 15000 }));

test("parallel: biweekly just over SSB period ceiling", () =>
  compare({ label: "biweekly-2500", gross: 2500, schedule: "biweekly", employerClass: "CLASS_1", priorYtdGross: 0 }));

test("parallel: payroll tax exemption crossed mid-run", () =>
  compare({ label: "exemption-crossing", gross: 2000, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 9500 }));

test("parallel: exactly at the 10,000 exemption boundary", () =>
  compare({ label: "at-exemption", gross: 5000, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 5000 }));

test("parallel: NHI annual ceiling boundary (8900 monthly)", () =>
  compare({ label: "nhi-ceiling", gross: 8900, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 80000 }));

test("parallel: weekly below exemption all year", () =>
  compare({ label: "weekly-150", gross: 150, schedule: "weekly", employerClass: "CLASS_1", priorYtdGross: 3000 }));

test("parallel: hourly employee with overtime and bonus", () => {
  const employee: EmployeeRateInput = { basePayType: "hourly", hourlyRate: 10, dailyRate: 0, overtimeRate: 15, fixedPay: 0 };
  const entries: RunLineEntryInput[] = [
    {
      daysWorked: 0, hoursWorked: 80, overtimeHours: 6, flatGross: 0, bonus: 100, allowance: 0,
      advanceDeduction: 0, withdrawalDeduction: 0, loanDeduction: 0, otherDeduction: 0,
      applyNhi: true, applySsb: true, applyIncomeTax: false
    }
  ];
  const engine = computeEmployeeRunLine(employee, entries, configFor("biweekly", "CLASS_1"), { yearToDateGross: 20000 });
  const gross = 80 * 10 + 6 * 15 + 100; // 990
  expectClose(engine.gross, gross, "hourly gross");
  const ref = referenceLine({ gross, schedule: "biweekly", employerClass: "CLASS_1", priorYtdGross: 20000 });
  expectClose(engine.nhi, ref.nhi, "hourly nhi");
  expectClose(engine.ssb, ref.ssb, "hourly ssb");
  expectClose(engine.payrollTax, ref.payrollTax, "hourly payroll tax");
  expectClose(engine.net, ref.net, "hourly net");
});

test("parallel: daily employee, two site lines aggregate once", () => {
  const employee: EmployeeRateInput = { basePayType: "daily", dailyRate: 75, hourlyRate: 0, overtimeRate: 0, fixedPay: 0 };
  const entries: RunLineEntryInput[] = [
    {
      daysWorked: 5, hoursWorked: 0, overtimeHours: 0, flatGross: 0, bonus: 0, allowance: 0,
      advanceDeduction: 0, withdrawalDeduction: 0, loanDeduction: 0, otherDeduction: 0,
      applyNhi: true, applySsb: true, applyIncomeTax: false
    },
    {
      daysWorked: 4, hoursWorked: 0, overtimeHours: 0, flatGross: 0, bonus: 25, allowance: 0,
      advanceDeduction: 0, withdrawalDeduction: 0, loanDeduction: 0, otherDeduction: 0,
      applyNhi: true, applySsb: true, applyIncomeTax: false
    }
  ];
  const engine = computeEmployeeRunLine(employee, entries, configFor("weekly", "CLASS_1"), { yearToDateGross: 0 });
  const gross = 9 * 75 + 25; // 700
  expectClose(engine.gross, gross, "daily gross");
  const ref = referenceLine({ gross, schedule: "weekly", employerClass: "CLASS_1", priorYtdGross: 0 });
  expectClose(engine.totalDeductions, ref2(ref.nhi + ref.ssb + ref.payrollTax), "daily deductions");
  expectClose(engine.net, ref.net, "daily net");
});

test("parallel: manual deductions reduce net but never statutory bases", () => {
  const engine = computeEmployeeRunLine(
    FIXED(1800),
    [
      {
        daysWorked: 0, hoursWorked: 0, overtimeHours: 0, flatGross: 0, bonus: 0, allowance: 0,
        advanceDeduction: 50, withdrawalDeduction: 0, loanDeduction: 25, otherDeduction: 0,
        applyNhi: true, applySsb: true, applyIncomeTax: false
      }
    ],
    configFor("monthly", "CLASS_1"),
    { yearToDateGross: 0 }
  );
  const ref = referenceLine({ gross: 1800, schedule: "monthly", employerClass: "CLASS_1", priorYtdGross: 0 });
  expectClose(engine.nhi, ref.nhi, "manual nhi unchanged");
  expectClose(engine.ssb, ref.ssb, "manual ssb unchanged");
  expectClose(engine.net, ref2(ref.net - 75), "manual net reduced");
});

// Unpaid-leave pro-rata deduction is covered by leave.test.ts / payroll-service.test.ts
// against the run builder; this file guards the statutory engine itself.
