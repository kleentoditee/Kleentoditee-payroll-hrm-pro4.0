import type { PayBasis } from "@kleentoditee/db";
import {
  BVI_STATUTORY_DEFAULTS,
  statutoryConfigFromRates,
  type StatutoryConfig,
  type StatutoryContribution
} from "./statutory-config.js";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type EmployeeRateInput = {
  basePayType: PayBasis;
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
  fixedPay: number;
};

export type EntryEarningInput = {
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  flatGross: number;
  bonus: number;
  allowance: number;
};

export type EntryDeductionFlags = {
  applyNhi: boolean;
  applySsb: boolean;
  applyIncomeTax: boolean;
};

export type EntryManualDeductions = {
  advanceDeduction: number;
  withdrawalDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
};

export type RunLineEntryInput = EntryEarningInput & EntryManualDeductions & EntryDeductionFlags;

/**
 * Earnings for ONE time line. The fixed salary is deliberately excluded here so
 * it can be applied a single time per employee per run (see
 * `computeEmployeeRunLine`); a per-line `flatGross` still overrides the base.
 */
export function computeLineEarnings(
  employee: EmployeeRateInput,
  entry: EntryEarningInput
): { base: number; variable: number; gross: number } {
  let base = 0;
  if (entry.flatGross > 0) {
    base = entry.flatGross;
  } else if (employee.basePayType === "daily") {
    // Daily basis is paid strictly per day: hoursWorked is NEVER also multiplied
    // by the hourly rate here. Doing so would double-count a shift that is
    // already covered by the day rate. Extra time for a daily worker is only
    // compensated through the explicit overtimeHours field below.
    base = entry.daysWorked * employee.dailyRate;
  } else if (employee.basePayType === "hourly") {
    base = entry.hoursWorked * employee.hourlyRate;
  }
  // basePayType "fixed" contributes no per-line base; the salary is added once.
  const otRate = employee.overtimeRate || employee.hourlyRate || 0;
  const variable = entry.overtimeHours * otRate + entry.bonus + entry.allowance;
  return { base, variable, gross: base + variable };
}

function contributionAmount(
  gross: number,
  contribution: StatutoryContribution,
  applyFlag: boolean
): { employee: number; employer: number } {
  if (!contribution.enabled || !applyFlag) {
    return { employee: 0, employer: 0 };
  }
  const insurable =
    contribution.periodCeiling > 0 ? Math.min(gross, contribution.periodCeiling) : gross;
  return {
    employee: insurable * contribution.employeeRate,
    employer: insurable * contribution.employerRate
  };
}

/**
 * Computes statutory deductions on a single per-period gross (employee level).
 * Returns the employee withholding and the separately-tracked employer cost.
 */
export function computeStatutoryDeductions(
  gross: number,
  config: StatutoryConfig,
  applies: { nhi: boolean; ssb: boolean; incomeTax: boolean }
): {
  employee: { nhi: number; ssb: number; incomeTax: number };
  employer: { nhi: number; ssb: number; incomeTax: number };
} {
  const ssb = contributionAmount(gross, config.socialSecurity, applies.ssb);
  const nhi = contributionAmount(gross, config.nationalHealthInsurance, applies.nhi);
  const incomeTax = contributionAmount(gross, config.incomeTax, applies.incomeTax);
  return {
    employee: { ssb: ssb.employee, nhi: nhi.employee, incomeTax: incomeTax.employee },
    employer: { ssb: ssb.employer, nhi: nhi.employer, incomeTax: incomeTax.employer }
  };
}

export function computeEntryPreview(
  employee: EmployeeRateInput,
  template: {
    nhiRate: number;
    ssbRate: number;
    incomeTaxRate: number;
  },
  entry: EntryEarningInput & EntryManualDeductions & EntryDeductionFlags
): {
  gross: number;
  totalDeductions: number;
  net: number;
  breakdown: { nhi: number; ssb: number; incomeTax: number; manual: number };
} {
  const earnings = computeLineEarnings(employee, entry);
  // Single-line preview: a fixed salary applies once, unless a flatGross
  // override is supplied for this line.
  const fixedBase =
    employee.basePayType === "fixed" && entry.flatGross <= 0 ? employee.fixedPay : 0;
  const gross = earnings.base + earnings.variable + fixedBase;

  const config = statutoryConfigFromRates({
    ssbRate: template.ssbRate,
    nhiRate: template.nhiRate,
    incomeTaxRate: template.incomeTaxRate
  });
  const statutory = computeStatutoryDeductions(gross, config, {
    nhi: entry.applyNhi,
    ssb: entry.applySsb,
    incomeTax: entry.applyIncomeTax
  });
  const manual =
    entry.advanceDeduction +
    entry.withdrawalDeduction +
    entry.loanDeduction +
    entry.otherDeduction;

  const nhi = statutory.employee.nhi;
  const ssb = statutory.employee.ssb;
  const incomeTax = statutory.employee.incomeTax;
  const totalDeductions = roundMoney(nhi + ssb + incomeTax + manual);
  const net = roundMoney(gross - totalDeductions);

  return {
    gross: roundMoney(gross),
    totalDeductions,
    net,
    breakdown: {
      nhi: roundMoney(nhi),
      ssb: roundMoney(ssb),
      incomeTax: roundMoney(incomeTax),
      manual: roundMoney(manual)
    }
  };
}

export type EmployeeRunLineResult = {
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  /** Employer statutory cost, tracked separately (not withheld from the employee). */
  employerContributions: { nhi: number; ssb: number; incomeTax: number };
  employerPayrollTax: number;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  bonus: number;
  allowance: number;
  flatGross: number;
  advanceDeduction: number;
  withdrawalDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  lines: Array<{ base: number; variable: number; gross: number; manual: number }>;
};

/**
 * Aggregates every approved time line for ONE employee into a single pay-run
 * line. The fixed salary is applied exactly once and statutory deductions are
 * computed once on the aggregate gross (never per line), which prevents the
 * double-counting that happens when an employee has multiple site lines.
 */
export function computeEmployeeRunLine(
  employee: EmployeeRateInput,
  entries: RunLineEntryInput[],
  config: StatutoryConfig = BVI_STATUTORY_DEFAULTS,
  payrollTaxContext: { yearToDateGross?: number; exemptionEnabled?: boolean } = {}
): EmployeeRunLineResult {
  let baseTotal = 0;
  let variableTotal = 0;
  let manualTotal = 0;
  const totals = {
    daysWorked: 0,
    hoursWorked: 0,
    overtimeHours: 0,
    bonus: 0,
    allowance: 0,
    flatGross: 0,
    advanceDeduction: 0,
    withdrawalDeduction: 0,
    loanDeduction: 0,
    otherDeduction: 0
  };
  // Fixed-pay employees may have no time lines. Their statutory contributions
  // still apply, while line-level flags continue to control variable workers.
  const applies = {
    nhi: employee.basePayType === "fixed" && entries.length === 0,
    ssb: employee.basePayType === "fixed" && entries.length === 0,
    incomeTax: false
  };
  const lines: EmployeeRunLineResult["lines"] = [];

  for (const entry of entries) {
    const earnings = computeLineEarnings(employee, entry);
    baseTotal += earnings.base;
    variableTotal += earnings.variable;
    const manual =
      entry.advanceDeduction +
      entry.withdrawalDeduction +
      entry.loanDeduction +
      entry.otherDeduction;
    manualTotal += manual;

    totals.daysWorked += entry.daysWorked;
    totals.hoursWorked += entry.hoursWorked;
    totals.overtimeHours += entry.overtimeHours;
    totals.bonus += entry.bonus;
    totals.allowance += entry.allowance;
    totals.flatGross += entry.flatGross;
    totals.advanceDeduction += entry.advanceDeduction;
    totals.withdrawalDeduction += entry.withdrawalDeduction;
    totals.loanDeduction += entry.loanDeduction;
    totals.otherDeduction += entry.otherDeduction;

    if (entry.applyNhi) {
      applies.nhi = true;
    }
    if (entry.applySsb) {
      applies.ssb = true;
    }
    if (entry.applyIncomeTax) {
      applies.incomeTax = true;
    }

    lines.push({
      base: roundMoney(earnings.base),
      variable: roundMoney(earnings.variable),
      gross: roundMoney(earnings.gross),
      manual: roundMoney(manual)
    });
  }

  const fixedBase = employee.basePayType === "fixed" ? employee.fixedPay : 0;
  const gross = baseTotal + variableTotal + fixedBase;
  const statutory = computeStatutoryDeductions(gross, config, applies);

  const priorGross = Math.max(0, payrollTaxContext.yearToDateGross ?? 0);
  const exemption = payrollTaxContext.exemptionEnabled === false ? 0 : config.payrollTax.annualExemption;
  const taxableBefore = Math.max(0, priorGross - exemption);
  const taxableAfter = Math.max(0, priorGross + gross - exemption);
  const taxableThisRun = config.payrollTax.enabled ? taxableAfter - taxableBefore : 0;
  const payrollTax = taxableThisRun * config.payrollTax.employeeRate;
  const employerPayrollTax = taxableThisRun * config.payrollTax.employerRate;

  const nhi = statutory.employee.nhi;
  const ssb = statutory.employee.ssb;
  const incomeTax = statutory.employee.incomeTax;
  const totalDeductions = roundMoney(nhi + ssb + incomeTax + payrollTax + manualTotal);
  const net = roundMoney(gross - totalDeductions);

  return {
    gross: roundMoney(gross),
    nhi: roundMoney(nhi),
    ssb: roundMoney(ssb),
    incomeTax: roundMoney(incomeTax),
    payrollTax: roundMoney(payrollTax),
    manualDeductions: roundMoney(manualTotal),
    totalDeductions,
    net,
    employerContributions: {
      nhi: roundMoney(statutory.employer.nhi),
      ssb: roundMoney(statutory.employer.ssb),
      incomeTax: roundMoney(statutory.employer.incomeTax)
    },
    employerPayrollTax: roundMoney(employerPayrollTax),
    daysWorked: roundMoney(totals.daysWorked),
    hoursWorked: roundMoney(totals.hoursWorked),
    overtimeHours: roundMoney(totals.overtimeHours),
    bonus: roundMoney(totals.bonus),
    allowance: roundMoney(totals.allowance),
    flatGross: roundMoney(totals.flatGross),
    advanceDeduction: roundMoney(totals.advanceDeduction),
    withdrawalDeduction: roundMoney(totals.withdrawalDeduction),
    loanDeduction: roundMoney(totals.loanDeduction),
    otherDeduction: roundMoney(totals.otherDeduction),
    lines
  };
}
