import assert from "node:assert/strict";
import test from "node:test";
import {
  currentContract,
  parseEmploymentType,
  patternHoursPerWeek,
  slugCode,
  sortReminders,
  validateSchedulePattern,
  type Reminder
} from "./hr-structure.js";

test("slugCode uppercases, hyphenates, and caps at 12 chars", () => {
  assert.equal(slugCode("Sales Team"), "SALES-TEAM");
  assert.equal(slugCode("  night shift  "), "NIGHT-SHIFT");
  assert.equal(slugCode("A very long department name indeed"), "A-VERY-LONG");
  assert.equal(slugCode("!!!"), "MISC");
});

test("validateSchedulePattern accepts a valid Mon-Fri pattern", () => {
  const pattern = validateSchedulePattern([
    { day: "MON", hours: 8 },
    { day: "tue", hours: 8 },
    { day: "wed", hours: 8 },
    { day: "thu", hours: 8 },
    { day: "fri", hours: 8 }
  ]);
  assert.equal(pattern.length, 5);
  assert.equal(pattern[0]?.day, "mon");
  assert.equal(patternHoursPerWeek(pattern), 40);
});

test("validateSchedulePattern rejects duplicate days", () => {
  assert.throws(
    () => validateSchedulePattern([{ day: "mon", hours: 4 }, { day: "Mon", hours: 4 }]),
    /appears twice/
  );
});

test("validateSchedulePattern rejects bad days and out-of-range hours", () => {
  assert.throws(() => validateSchedulePattern([{ day: "funday", hours: 4 }]), /Invalid schedule day/);
  assert.throws(() => validateSchedulePattern([{ day: "mon", hours: 25 }]), /between 0 and 24/);
  assert.throws(() => validateSchedulePattern([{ day: "mon", hours: -1 }]), /between 0 and 24/);
  assert.throws(() => validateSchedulePattern("mon 8h"), /array/);
});

test("currentContract picks the latest contract effective on the date", () => {
  const old = { effectiveFrom: new Date("2024-01-01"), effectiveTo: new Date("2025-01-01") };
  const current = { effectiveFrom: new Date("2025-01-01"), effectiveTo: null };
  const future = { effectiveFrom: new Date("2027-01-01"), effectiveTo: null };
  const asOf = new Date("2026-09-21");
  assert.equal(currentContract([old, current, future], asOf), current);
  assert.equal(currentContract([future], asOf), null);
  assert.equal(currentContract([], asOf), null);
});

test("currentContract returns the contract effective exactly on its start date", () => {
  const c = { effectiveFrom: new Date("2026-09-21T00:00:00Z"), effectiveTo: null };
  assert.equal(currentContract([c], new Date("2026-09-21T00:00:00Z")), c);
});

test("sortReminders orders by date ascending (most urgent first)", () => {
  const base = { kind: "contract_end" as const, employeeId: "e1", employeeName: "Ann", label: "x" };
  const reminders: Reminder[] = [
    { ...base, date: new Date("2026-12-01"), daysUntil: 71 },
    { ...base, date: new Date("2026-09-25"), daysUntil: 4 },
    { ...base, date: new Date("2026-10-15"), daysUntil: 24 }
  ];
  const sorted = sortReminders(reminders);
  assert.equal(sorted[0]?.daysUntil, 4);
  assert.equal(sorted[1]?.daysUntil, 24);
  assert.equal(sorted[2]?.daysUntil, 71);
  // input array is not mutated
  assert.equal(reminders[0]?.daysUntil, 71);
});

test("parseEmploymentType accepts known values and falls back to full_time", () => {
  assert.equal(parseEmploymentType("part_time"), "part_time");
  assert.equal(parseEmploymentType("casual"), "casual");
  assert.equal(parseEmploymentType("fixed_term"), "fixed_term");
  assert.equal(parseEmploymentType("nonsense"), "full_time");
  assert.equal(parseEmploymentType(undefined), "full_time");
  assert.equal(parseEmploymentType(null), "full_time");
});
