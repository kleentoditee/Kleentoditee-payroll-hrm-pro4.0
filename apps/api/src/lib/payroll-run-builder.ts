import type { PayBasis, PaySchedule } from "@kleentoditee/db";
import { computeEmployeeRunLine, roundMoney } from "./payroll-calc.js";
import { BVI_STATUTORY_DEFAULTS, type StatutoryConfig } from "./statutory-config.js";
import { businessDaysBetween, computeUnpaidLeaveDeduction } from "./leave-days.js";
import { dateKey, isTimeEntryWithinPeriod } from "./payroll-utils.js";

export type RunPeriodLike = {
  schedule: PaySchedule;
  startDate: Date;
  endDate: Date;
};

/** Minimal shape of an approved time entry (with employee + template) needed to build a run line. */
export type RunSourceEntry = {
  id: string;
  month: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  site: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  flatGross: number;
  bonus: number;
  allowance: number;
  advanceDeduction: number;
  withdrawalDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  applyNhi: boolean;
  applySsb: boolean;
  applyIncomeTax: boolean;
  employeeId: string;
  employee: {
    fullName: string;
    role: string;
    defaultSite: string;
    paySchedule: PaySchedule;
    basePayType: PayBasis;
    dailyRate: number;
    hourlyRate: number;
    overtimeRate: number;
    fixedPay: number;
    payrollTaxExemptionEnabled?: boolean;
    standardDays?: number;
  };
  template: {
    name: string;
    nhiRate: number;
    ssbRate: number;
    incomeTaxRate: number;
  };
};

export type RunItemPayload = {
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  defaultSite: string;
  paySchedule: PaySchedule;
  payBasis: PayBasis;
  templateName: string;
  sourceEntryIds: string[];
  sourceSummary: Array<{
    entryId: string;
    month: string;
    periodStart: string | null;
    periodEnd: string | null;
    site: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
    gross: number;
    net: number;
  }>;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
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
  unpaidLeaveDays: number;
  unpaidLeaveDeduction: number;
};

/**
 * Pure pay-run aggregation: filters entries to the period, groups them by
 * employee, then computes each employee's run line once via
 * `computeEmployeeRunLine` (fixed salary applied once; statutory deductions
 * computed once on the aggregate gross). Free of Prisma so it can be unit
 * tested with seeded data.
 *
 * `orgConfig` supplies the SSB/NHI rates, ceilings, and employee/employer split
 * from the editable OrgSettings singleton (loaded at the service boundary). The
 * per-entry `applyNhi`/`applySsb` flags still decide whether each contribution
 * applies to a given employee.
 */
export function buildRunItemsFromEntries(
  period: RunPeriodLike,
  entries: RunSourceEntry[],
  orgConfig: StatutoryConfig = BVI_STATUTORY_DEFAULTS,
  options: {
    fixedEmployees?: Array<RunSourceEntry["employee"] & { id: string; templateName: string }>;
    yearToDateGrossByEmployee?: Map<string, number>;
    unpaidLeaveDaysByEmployee?: Map<string, number>;
  } = {}
): RunItemPayload[] {
  const matchingEntries = entries.filter((entry) =>
    isTimeEntryWithinPeriod(period, {
      month: entry.month,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd
    })
  );

  const grouped = new Map<
    string,
    {
      employee: RunSourceEntry["employee"];
      templateNames: Set<string>;
      entries: RunSourceEntry[];
    }
  >();
  for (const entry of matchingEntries) {
    const current = grouped.get(entry.employeeId) ?? {
      templateNames: new Set<string>(),
      employee: entry.employee,
      entries: []
    };
    current.templateNames.add(entry.template.name);
    current.entries.push(entry);
    grouped.set(entry.employeeId, current);
  }

  for (const employee of options.fixedEmployees ?? []) {
    if (!grouped.has(employee.id)) {
      grouped.set(employee.id, {
        employee,
        templateNames: new Set([employee.templateName]),
        entries: []
      });
    }
  }

  const periodBusinessDays = businessDaysBetween(period.startDate, period.endDate);
  const items: RunItemPayload[] = [];
  for (const [employeeId, group] of grouped) {
    const employee = group.employee;
    const paidDailyDates = new Set<string>();
    // Approved unpaid-leave days pro-rate fixed-basis salaries; the reduction
    // lowers gross (so statutory follows) and is reported on the run line.
    const unpaidLeaveDays = options.unpaidLeaveDaysByEmployee?.get(employeeId) ?? 0;
    const unpaidLeaveDeduction = computeUnpaidLeaveDeduction({
      basePayType: employee.basePayType,
      fixedPay: employee.fixedPay,
      standardDays: employee.standardDays ?? 0,
      periodBusinessDays,
      unpaidLeaveDays
    });
    const effectiveFixedPay = employee.fixedPay - unpaidLeaveDeduction;
    // SSB/NHI rates, ceilings, and the employee/employer split come from the
    // org-wide statutory config; mixed templates per employee within a run are
    // flagged as "Multiple templates". The per-entry apply flags below still
    // decide whether each contribution applies.
    const calc = computeEmployeeRunLine(
      {
        basePayType: employee.basePayType,
        dailyRate: employee.dailyRate,
        hourlyRate: employee.hourlyRate,
        overtimeRate: employee.overtimeRate,
        fixedPay: effectiveFixedPay
      },
      group.entries.map((entry) => {
        let daysWorked = entry.daysWorked;
        if (
          employee.basePayType === "daily" &&
          entry.periodStart &&
          entry.periodEnd &&
          dateKey(entry.periodStart) === dateKey(entry.periodEnd)
        ) {
          const workDate = dateKey(entry.periodStart);
          daysWorked = paidDailyDates.has(workDate) ? 0 : entry.daysWorked;
          if (entry.daysWorked > 0) paidDailyDates.add(workDate);
        }
        return {
        daysWorked,
        hoursWorked: entry.hoursWorked,
        overtimeHours: entry.overtimeHours,
        flatGross: entry.flatGross,
        bonus: entry.bonus,
        allowance: entry.allowance,
        advanceDeduction: entry.advanceDeduction,
        withdrawalDeduction: entry.withdrawalDeduction,
        loanDeduction: entry.loanDeduction,
        otherDeduction: entry.otherDeduction,
        applyNhi: entry.applyNhi,
        applySsb: entry.applySsb,
        applyIncomeTax: entry.applyIncomeTax
      };
      }),
      orgConfig,
      {
        yearToDateGross: options.yearToDateGrossByEmployee?.get(employeeId) ?? 0,
        exemptionEnabled: employee.payrollTaxExemptionEnabled !== false
      }
    );

    const sourceSummary = group.entries.map((entry, index) => {
      const line = calc.lines[index];
      return {
        entryId: entry.id,
        month: entry.month,
        periodStart: entry.periodStart ? dateKey(entry.periodStart) : null,
        periodEnd: entry.periodEnd ? dateKey(entry.periodEnd) : null,
        site: entry.site,
        startTime: entry.startTime ?? "",
        endTime: entry.endTime ?? "",
        breakMinutes: entry.breakMinutes ?? 0,
        daysWorked: roundMoney(entry.daysWorked),
        hoursWorked: roundMoney(entry.hoursWorked),
        overtimeHours: roundMoney(entry.overtimeHours),
        gross: line.gross,
        net: roundMoney(line.gross - line.manual)
      };
    });

    items.push({
      employeeId,
      employeeName: employee.fullName,
      employeeRole: employee.role,
      defaultSite: employee.defaultSite,
      paySchedule: employee.paySchedule,
      payBasis: employee.basePayType,
      templateName:
        group.templateNames.size === 1 ? [...group.templateNames][0] : "Multiple templates",
      sourceEntryIds: group.entries.map((entry) => entry.id),
      sourceSummary,
      gross: calc.gross,
      nhi: calc.nhi,
      ssb: calc.ssb,
      incomeTax: calc.incomeTax,
      payrollTax: calc.payrollTax,
      employerNhi: calc.employerContributions.nhi,
      employerSsb: calc.employerContributions.ssb,
      employerPayrollTax: calc.employerPayrollTax,
      manualDeductions: calc.manualDeductions,
      totalDeductions: calc.totalDeductions,
      net: calc.net,
      daysWorked: calc.daysWorked,
      hoursWorked: calc.hoursWorked,
      overtimeHours: calc.overtimeHours,
      bonus: calc.bonus,
      allowance: calc.allowance,
      flatGross: calc.flatGross,
      advanceDeduction: calc.advanceDeduction,
      withdrawalDeduction: calc.withdrawalDeduction,
      loanDeduction: calc.loanDeduction,
      otherDeduction: calc.otherDeduction,
      unpaidLeaveDays,
      unpaidLeaveDeduction
    });
  }

  return items.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}
