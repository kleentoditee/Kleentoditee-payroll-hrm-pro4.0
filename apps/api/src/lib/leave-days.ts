import { roundMoney } from "./payroll-calc.js";

/**
 * Pure leave day-counting and unpaid-leave pay math (research R8).
 * Prisma-free so the pay-run builder and unit tests can use it directly.
 * `leave.ts` adds the database-backed loaders on top of these.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Inclusive count of Monday–Friday days between two dates (UTC). 0 when inverted. */
export function businessDaysBetween(start: Date, end: Date): number {
  const first = utcDay(start);
  const last = utcDay(end);
  if (last < first) {
    return 0;
  }
  let count = 0;
  for (let day = first; day <= last; day += 1) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      count += 1;
    }
  }
  return count;
}

/** Business days shared by a request range and a period range. */
export function businessDaysOverlap(reqStart: Date, reqEnd: Date, periodStart: Date, periodEnd: Date): number {
  const start = reqStart > periodStart ? reqStart : periodStart;
  const end = reqEnd < periodEnd ? reqEnd : periodEnd;
  return businessDaysBetween(start, end);
}

/**
 * Pro-rated fixed-pay reduction for unpaid-leave days. Denominator is the
 * employee's configured standard working days per period (falls back to the
 * period's business days). Capped at the fixed pay so gross never goes
 * negative; only fixed-basis employees are affected — daily/hourly staff
 * simply have no time entries on unpaid-leave days.
 */
export function computeUnpaidLeaveDeduction(input: {
  basePayType: string;
  fixedPay: number;
  standardDays: number;
  periodBusinessDays: number;
  unpaidLeaveDays: number;
}): number {
  if (input.basePayType !== "fixed" || input.fixedPay <= 0 || input.unpaidLeaveDays <= 0) {
    return 0;
  }
  const denominator = input.standardDays > 0 ? input.standardDays : input.periodBusinessDays;
  if (denominator <= 0) {
    return 0;
  }
  return roundMoney(Math.min(input.fixedPay, (input.fixedPay * input.unpaidLeaveDays) / denominator));
}
