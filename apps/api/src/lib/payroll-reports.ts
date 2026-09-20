import { PayRunStatus, prisma, type PaySchedule } from "@kleentoditee/db";
import { roundMoney } from "./payroll-calc.js";
import { buildPeriodLabel, dateKey } from "./payroll-utils.js";

/**
 * Payroll reporting: per-run payroll register, per-employee year summary with
 * imported opening balances (Batch 3), and reconciliation checks.
 *
 * Aggregation and reconciliation are pure functions so they can be unit tested
 * without a database; the exported `build*` functions only load rows and
 * delegate to them.
 */

/** Run statuses that count as real pay history (drafts are excluded, voids reversed). */
const POSTED_RUN_STATUSES = [PayRunStatus.finalized, PayRunStatus.exported, PayRunStatus.paid] as const;

const MONEY_TOLERANCE = 0.01;

export type RegisterSourceItem = {
  employeeName: string;
  employeeRole: string;
  defaultSite: string;
  paySchedule: string;
  payBasis: string;
  templateName: string;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
};

export type RegisterLine = RegisterSourceItem & {
  employerCost: number;
  issues: string[];
};

export type RegisterTotals = {
  employees: number;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  employerCost: number;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
};

/** Checks a frozen run line for internal consistency; returns human-readable issues. */
export function reconcileRunItem(item: RegisterSourceItem): string[] {
  const issues: string[] = [];
  const statutoryPlusManual = roundMoney(item.nhi + item.ssb + item.incomeTax + item.payrollTax + item.manualDeductions);
  if (Math.abs(statutoryPlusManual - item.totalDeductions) > MONEY_TOLERANCE) {
    issues.push(
      `totalDeductions ${item.totalDeductions} != components ${statutoryPlusManual} (nhi+ssb+incomeTax+payrollTax+manual)`
    );
  }
  const netPlusDeductions = roundMoney(item.net + item.totalDeductions);
  if (Math.abs(netPlusDeductions - item.gross) > MONEY_TOLERANCE) {
    issues.push(`gross ${item.gross} != net + totalDeductions ${netPlusDeductions}`);
  }
  if (item.net < 0) {
    issues.push(`net is negative (${item.net})`);
  }
  return issues;
}

export function buildRegisterLines(items: RegisterSourceItem[]): RegisterLine[] {
  return items.map((item) => ({
    ...item,
    employerCost: roundMoney(item.employerNhi + item.employerSsb + item.employerPayrollTax),
    issues: reconcileRunItem(item)
  }));
}

export function summarizeRegisterLines(lines: RegisterLine[]): RegisterTotals {
  const totals: RegisterTotals = {
    employees: lines.length,
    gross: 0,
    nhi: 0,
    ssb: 0,
    incomeTax: 0,
    payrollTax: 0,
    manualDeductions: 0,
    totalDeductions: 0,
    net: 0,
    employerNhi: 0,
    employerSsb: 0,
    employerPayrollTax: 0,
    employerCost: 0,
    daysWorked: 0,
    hoursWorked: 0,
    overtimeHours: 0
  };
  for (const line of lines) {
    totals.gross += line.gross;
    totals.nhi += line.nhi;
    totals.ssb += line.ssb;
    totals.incomeTax += line.incomeTax;
    totals.payrollTax += line.payrollTax;
    totals.manualDeductions += line.manualDeductions;
    totals.totalDeductions += line.totalDeductions;
    totals.net += line.net;
    totals.employerNhi += line.employerNhi;
    totals.employerSsb += line.employerSsb;
    totals.employerPayrollTax += line.employerPayrollTax;
    totals.employerCost += line.employerCost;
    totals.daysWorked += line.daysWorked;
    totals.hoursWorked += line.hoursWorked;
    totals.overtimeHours += line.overtimeHours;
  }
  for (const key of Object.keys(totals) as Array<keyof RegisterTotals>) {
    if (key !== "employees") {
      totals[key] = roundMoney(totals[key]);
    }
  }
  return totals;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const REGISTER_CSV_HEADERS = [
  "Employee",
  "Role",
  "Site",
  "Schedule",
  "Basis",
  "Template",
  "Days",
  "Hours",
  "OT hours",
  "Gross",
  "NHI",
  "SSB",
  "Income tax",
  "Payroll tax",
  "Manual deductions",
  "Total deductions",
  "Net",
  "Employer NHI",
  "Employer SSB",
  "Employer payroll tax",
  "Employer cost"
] as const;

function registerCsvRow(values: Array<string | number>): string {
  return values.map(csvCell).join(",");
}

/** Renders the register as CSV with a period header block and a totals row. */
export function buildRegisterCsv(
  period: { label: string; schedule: PaySchedule; startDate: Date; endDate: Date; payDate: Date | null },
  runStatus: string,
  lines: RegisterLine[],
  totals: RegisterTotals
): string {
  const rows: string[] = [
    `Payroll register,${csvCell(period.label || buildPeriodLabel(period))}`,
    `Schedule,${period.schedule}`,
    `Period,${dateKey(period.startDate)},to,${dateKey(period.endDate)}`,
    `Pay date,${period.payDate ? dateKey(period.payDate) : ""}`,
    `Run status,${runStatus}`,
    "",
    registerCsvRow([...REGISTER_CSV_HEADERS])
  ];
  for (const line of lines) {
    rows.push(
      registerCsvRow([
        line.employeeName,
        line.employeeRole,
        line.defaultSite,
        line.paySchedule,
        line.payBasis,
        line.templateName,
        line.daysWorked,
        line.hoursWorked,
        line.overtimeHours,
        line.gross.toFixed(2),
        line.nhi.toFixed(2),
        line.ssb.toFixed(2),
        line.incomeTax.toFixed(2),
        line.payrollTax.toFixed(2),
        line.manualDeductions.toFixed(2),
        line.totalDeductions.toFixed(2),
        line.net.toFixed(2),
        line.employerNhi.toFixed(2),
        line.employerSsb.toFixed(2),
        line.employerPayrollTax.toFixed(2),
        line.employerCost.toFixed(2)
      ])
    );
  }
  rows.push(
    registerCsvRow([
      `Totals (${totals.employees} employees)`,
      "",
      "",
      "",
      "",
      "",
      totals.daysWorked,
      totals.hoursWorked,
      totals.overtimeHours,
      totals.gross.toFixed(2),
      totals.nhi.toFixed(2),
      totals.ssb.toFixed(2),
      totals.incomeTax.toFixed(2),
      totals.payrollTax.toFixed(2),
      totals.manualDeductions.toFixed(2),
      totals.totalDeductions.toFixed(2),
      totals.net.toFixed(2),
      totals.employerNhi.toFixed(2),
      totals.employerSsb.toFixed(2),
      totals.employerPayrollTax.toFixed(2),
      totals.employerCost.toFixed(2)
    ])
  );
  return rows.join("\r\n") + "\r\n";
}

export async function buildPayrollRegister(runId: string) {
  const run = await prisma.payRun.findUnique({
    where: { id: runId },
    include: { period: true, items: { orderBy: { employeeName: "asc" } } }
  });
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status === PayRunStatus.void) {
    throw new Error("Void runs have no register; use the corrected run instead.");
  }
  const lines = buildRegisterLines(run.items);
  const totals = summarizeRegisterLines(lines);
  const checks = lines.flatMap((line) => line.issues.map((issue) => `${line.employeeName}: ${issue}`));
  return {
    run: { id: run.id, status: run.status, finalizedAt: run.finalizedAt, paidAt: run.paidAt, exportedAt: run.exportedAt },
    period: {
      ...run.period,
      label: run.period.label || buildPeriodLabel(run.period)
    },
    lines,
    totals,
    checks,
    draft: run.status === PayRunStatus.draft
  };
}

// --- Year summary -----------------------------------------------------------

export type YearSummaryEmployeeInput = {
  id: string;
  fullName: string;
  email: string;
  paySchedule: string;
  active: boolean;
};

export type YearSummaryRow = {
  employeeId: string;
  employeeName: string;
  paySchedule: string;
  active: boolean;
  openingGross: number;
  openingSource: string | null;
  runsGross: number;
  runCount: number;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  employerCost: number;
};

export type YearSummaryTotals = Omit<YearSummaryRow, "employeeId" | "employeeName" | "paySchedule" | "active" | "openingSource"> & {
  employees: number;
};

/** Pure aggregation: opening balances + posted run lines → per-employee YTD rows. */
export function aggregateYearSummary(
  employees: YearSummaryEmployeeInput[],
  openingBalances: Array<{ employeeId: string; gross: number; source: string }>,
  items: Array<RegisterSourceItem & { employeeId: string }>
): { rows: YearSummaryRow[]; totals: YearSummaryTotals } {
  const openingByEmployee = new Map(openingBalances.map((row) => [row.employeeId, row]));
  const rows: YearSummaryRow[] = [];

  const employeeIds = new Set(employees.map((employee) => employee.id));
  const orphanItems = items.filter((item) => !employeeIds.has(item.employeeId));
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  for (const item of orphanItems) {
    if (!employeesById.has(item.employeeId)) {
      employeesById.set(item.employeeId, {
        id: item.employeeId,
        fullName: item.employeeName,
        email: "",
        paySchedule: item.paySchedule,
        active: false
      });
    }
  }

  for (const employee of employeesById.values()) {
    const opening = openingByEmployee.get(employee.id);
    const employeeItems = items.filter((item) => item.employeeId === employee.id);
    const lines = buildRegisterLines(employeeItems);
    const itemTotals = summarizeRegisterLines(lines);
    rows.push({
      employeeId: employee.id,
      employeeName: employee.fullName,
      paySchedule: employee.paySchedule,
      active: employee.active,
      openingGross: opening?.gross ?? 0,
      openingSource: opening?.source ?? null,
      runsGross: itemTotals.gross,
      runCount: employeeItems.length,
      gross: roundMoney((opening?.gross ?? 0) + itemTotals.gross),
      nhi: itemTotals.nhi,
      ssb: itemTotals.ssb,
      incomeTax: itemTotals.incomeTax,
      payrollTax: itemTotals.payrollTax,
      manualDeductions: itemTotals.manualDeductions,
      totalDeductions: itemTotals.totalDeductions,
      net: itemTotals.net,
      employerNhi: itemTotals.employerNhi,
      employerSsb: itemTotals.employerSsb,
      employerPayrollTax: itemTotals.employerPayrollTax,
      employerCost: itemTotals.employerCost
    });
  }
  rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const totals: YearSummaryTotals = {
    employees: rows.filter((row) => row.gross > 0 || row.runCount > 0).length,
    openingGross: 0,
    runsGross: 0,
    runCount: 0,
    gross: 0,
    nhi: 0,
    ssb: 0,
    incomeTax: 0,
    payrollTax: 0,
    manualDeductions: 0,
    totalDeductions: 0,
    net: 0,
    employerNhi: 0,
    employerSsb: 0,
    employerPayrollTax: 0,
    employerCost: 0
  };
  for (const row of rows) {
    totals.openingGross += row.openingGross;
    totals.runsGross += row.runsGross;
    totals.runCount += row.runCount;
    totals.gross += row.gross;
    totals.nhi += row.nhi;
    totals.ssb += row.ssb;
    totals.incomeTax += row.incomeTax;
    totals.payrollTax += row.payrollTax;
    totals.manualDeductions += row.manualDeductions;
    totals.totalDeductions += row.totalDeductions;
    totals.net += row.net;
    totals.employerNhi += row.employerNhi;
    totals.employerSsb += row.employerSsb;
    totals.employerPayrollTax += row.employerPayrollTax;
    totals.employerCost += row.employerCost;
  }
  for (const key of Object.keys(totals) as Array<keyof YearSummaryTotals>) {
    if (key !== "employees" && key !== "runCount") {
      totals[key] = roundMoney(totals[key]);
    }
  }
  return { rows, totals };
}

export async function buildPayrollYearSummary(year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [employees, openingBalances, postedRuns, draftRunCount, voidRunCount] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, fullName: true, email: true, paySchedule: true, active: true }
    }),
    prisma.payrollYtdOpeningBalance.findMany({
      where: { year },
      select: { employeeId: true, gross: true, source: true }
    }),
    prisma.payRun.findMany({
      where: {
        status: { in: [...POSTED_RUN_STATUSES] },
        period: { startDate: { gte: yearStart, lt: yearEnd } }
      },
      include: { period: true, items: true }
    }),
    prisma.payRun.count({
      where: { status: PayRunStatus.draft, period: { startDate: { gte: yearStart, lt: yearEnd } } }
    }),
    prisma.payRun.count({
      where: { status: PayRunStatus.void, period: { startDate: { gte: yearStart, lt: yearEnd } } }
    })
  ]);

  const items = postedRuns.flatMap((run) => run.items);
  const { rows, totals } = aggregateYearSummary(employees, openingBalances, items);

  const checks: string[] = [];
  for (const line of buildRegisterLines(items)) {
    for (const issue of line.issues) {
      checks.push(`${line.employeeName}: ${issue}`);
    }
  }
  // YTD continuity: opening + posted runs must equal the reported YTD gross.
  for (const row of rows) {
    if (Math.abs(roundMoney(row.openingGross + row.runsGross) - row.gross) > MONEY_TOLERANCE) {
      checks.push(`${row.employeeName}: opening ${row.openingGross} + runs ${row.runsGross} != YTD gross ${row.gross}`);
    }
  }
  const warnings: string[] = [];
  if (draftRunCount > 0) {
    warnings.push(`${draftRunCount} draft run(s) in ${year} are excluded until finalized.`);
  }
  if (voidRunCount > 0) {
    warnings.push(`${voidRunCount} void run(s) in ${year} are excluded (reversed).`);
  }

  const runs = postedRuns
    .map((run) => ({
      id: run.id,
      status: run.status,
      periodLabel: run.period.label || buildPeriodLabel(run.period),
      schedule: run.period.schedule,
      startDate: run.period.startDate,
      endDate: run.period.endDate,
      itemCount: run.items.length,
      gross: roundMoney(run.items.reduce((sum, item) => sum + item.gross, 0)),
      net: roundMoney(run.items.reduce((sum, item) => sum + item.net, 0))
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return { year, rows, totals, runs, checks, warnings };
}
