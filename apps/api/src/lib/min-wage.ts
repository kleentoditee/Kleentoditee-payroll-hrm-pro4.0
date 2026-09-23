import type { PayBasis, PaySchedule } from "@kleentoditee/db";

/**
 * BVI minimum wage: US$7.25/hour effective 2025-07-01 (BVI Labour Code
 * (Minimum Wage) Order 2025). Warnings are advisory — pay rates below the
 * minimum are flagged, never silently blocked, so historical records and edge
 * arrangements (apprentices etc.) remain editable with eyes open.
 */
export const BVI_MINIMUM_WAGE_HOURLY = 7.25;
export const BVI_MINIMUM_WAGE_EFFECTIVE = "2025-07-01";
export const BVI_STANDARD_HOURS_PER_WEEK = 40;

export type MinWageEmployeeInput = {
  basePayType: PayBasis;
  hourlyRate: number;
  dailyRate: number;
  fixedPay: number;
  paySchedule: PaySchedule;
};

/** Derives an effective hourly rate for any pay basis, for comparison only. */
export function effectiveHourlyRate(emp: MinWageEmployeeInput): number | null {
  if (emp.basePayType === "hourly") {
    return emp.hourlyRate > 0 ? emp.hourlyRate : null;
  }
  if (emp.basePayType === "daily") {
    // Standard BVI workday is 8 hours (40-hour week).
    return emp.dailyRate > 0 ? emp.dailyRate / 8 : null;
  }
  // fixed salary: periods per year by schedule
  const periods = emp.paySchedule === "weekly" ? 52 : emp.paySchedule === "biweekly" ? 26 : 12;
  if (emp.fixedPay <= 0) return null;
  const yearlyHours = BVI_STANDARD_HOURS_PER_WEEK * 52;
  return (emp.fixedPay * periods) / yearlyHours;
}

/**
 * Returns a human-readable warning when the employee's effective rate is below
 * the BVI minimum wage, or null when compliant / not computable.
 */
export function minimumWageWarning(emp: MinWageEmployeeInput): string | null {
  const effective = effectiveHourlyRate(emp);
  if (effective === null) return null;
  if (effective >= BVI_MINIMUM_WAGE_HOURLY) return null;
  return (
    `Effective rate $${effective.toFixed(2)}/hr is below the BVI minimum wage ` +
    `$${BVI_MINIMUM_WAGE_HOURLY.toFixed(2)}/hr (effective ${BVI_MINIMUM_WAGE_EFFECTIVE}).`
  );
}
