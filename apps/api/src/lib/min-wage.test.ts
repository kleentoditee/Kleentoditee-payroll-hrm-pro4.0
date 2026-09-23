import assert from "node:assert/strict";
import test from "node:test";
import {
  BVI_MINIMUM_WAGE_HOURLY,
  effectiveHourlyRate,
  minimumWageWarning
} from "./min-wage.js";

test("hourly employee below minimum wage is flagged", () => {
  const warning = minimumWageWarning({
    basePayType: "hourly",
    hourlyRate: 6,
    dailyRate: 0,
    fixedPay: 0,
    paySchedule: "biweekly"
  });
  assert.ok(warning?.includes("below the BVI minimum wage"));
  assert.ok(warning?.includes("$6.00/hr"));
});

test("hourly employee at or above minimum wage is clean", () => {
  assert.equal(
    minimumWageWarning({ basePayType: "hourly", hourlyRate: BVI_MINIMUM_WAGE_HOURLY, dailyRate: 0, fixedPay: 0, paySchedule: "monthly" }),
    null
  );
  assert.equal(
    minimumWageWarning({ basePayType: "hourly", hourlyRate: 12.5, dailyRate: 0, fixedPay: 0, paySchedule: "monthly" }),
    null
  );
});

test("daily rate converts at 8 hours per day", () => {
  assert.equal(
    effectiveHourlyRate({ basePayType: "daily", hourlyRate: 0, dailyRate: 58, fixedPay: 0, paySchedule: "weekly" }),
    7.25
  );
  assert.ok(
    minimumWageWarning({ basePayType: "daily", hourlyRate: 0, dailyRate: 50, fixedPay: 0, paySchedule: "weekly" }) !== null
  );
});

test("fixed monthly salary converts across schedules", () => {
  // $1,256.67/month * 12 / (40*52) = $7.25/hr exactly at the boundary
  const atBoundary = effectiveHourlyRate({ basePayType: "fixed", hourlyRate: 0, dailyRate: 0, fixedPay: 1256.67, paySchedule: "monthly" });
  assert.ok(Math.abs((atBoundary ?? 0) - 7.25) < 0.01);
  assert.ok(
    minimumWageWarning({ basePayType: "fixed", hourlyRate: 0, dailyRate: 0, fixedPay: 1000, paySchedule: "monthly" }) !== null
  );
  assert.equal(
    minimumWageWarning({ basePayType: "fixed", hourlyRate: 0, dailyRate: 0, fixedPay: 1800, paySchedule: "monthly" }),
    null
  );
});

test("zero rates are not computable, never flagged", () => {
  assert.equal(
    minimumWageWarning({ basePayType: "hourly", hourlyRate: 0, dailyRate: 0, fixedPay: 0, paySchedule: "monthly" }),
    null
  );
});
