import type { PaySchedule } from "@kleentoditee/db";
import { roundMoney } from "./payroll-calc.js";

export type PeriodLike = {
  schedule: PaySchedule;
  startDate: Date;
  endDate: Date;
};

export type TimeEntryPeriodLike = {
  month: string;
  periodStart: Date | null;
  periodEnd: Date | null;
};

export type CsvRunLike = {
  label: string;
  schedule: PaySchedule;
  payDate: Date | null;
  items: Array<{
    employeeName: string;
    employeeRole: string;
    defaultSite: string;
    paySchedule: PaySchedule;
    gross: number;
    nhi: number;
    ssb: number;
    incomeTax: number;
    manualDeductions: number;
    totalDeductions: number;
    net: number;
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
    bonus: number;
    allowance: number;
  }>;
};

function utcParts(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate()
  };
}

export function dateKey(date: Date): string {
  const { year, month, day } = utcParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthKey(date: Date): string {
  const { year, month } = utcParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function scheduleLabel(schedule: PaySchedule): string {
  if (schedule === "weekly") {
    return "Weekly";
  }
  if (schedule === "biweekly") {
    return "Biweekly";
  }
  return "Monthly";
}

export function buildPeriodLabel(period: PeriodLike): string {
  if (period.schedule === "monthly") {
    const { year, month } = utcParts(period.startDate);
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(Date.UTC(year, month, 1)));
  }
  return `${scheduleLabel(period.schedule)} ${dateKey(period.startDate)} to ${dateKey(period.endDate)}`;
}

export function isTimeEntryWithinPeriod(period: PeriodLike, entry: TimeEntryPeriodLike): boolean {
  if (entry.periodStart && entry.periodEnd) {
    return (
      dateKey(entry.periodStart) >= dateKey(period.startDate) &&
      dateKey(entry.periodEnd) <= dateKey(period.endDate)
    );
  }
  if (period.schedule === "monthly") {
    return entry.month === monthKey(period.startDate);
  }
  return false;
}

function csvEscape(value: string | number): string {
  const text = typeof value === "number" ? value.toFixed(2) : value;
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function createPaystubNumber(runId: string, itemId: string): string {
  return `PS-${runId.slice(-6).toUpperCase()}-${itemId.slice(-6).toUpperCase()}`;
}

export function buildPayrollCsv(run: CsvRunLike): string {
  const header = [
    "Employee",
    "Role",
    "Site",
    "Schedule",
    "Period",
    "Pay Date",
    "Gross",
    "NHI",
    "SSB",
    "Income Tax",
    "Manual Deductions",
    "Total Deductions",
    "Net",
    "Days Worked",
    "Hours Worked",
    "Overtime Hours",
    "Bonus",
    "Allowance"
  ];

  const rows = run.items.map((item) => [
    item.employeeName,
    item.employeeRole,
    item.defaultSite,
    item.paySchedule,
    run.label,
    run.payDate ? dateKey(run.payDate) : "",
    roundMoney(item.gross),
    roundMoney(item.nhi),
    roundMoney(item.ssb),
    roundMoney(item.incomeTax),
    roundMoney(item.manualDeductions),
    roundMoney(item.totalDeductions),
    roundMoney(item.net),
    roundMoney(item.daysWorked),
    roundMoney(item.hoursWorked),
    roundMoney(item.overtimeHours),
    roundMoney(item.bonus),
    roundMoney(item.allowance)
  ]);

  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}
