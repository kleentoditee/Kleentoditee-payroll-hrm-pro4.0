import assert from "node:assert/strict";
import test from "node:test";
import {
  accrualSpecs,
  balanceFromEvents,
  bviHolidays,
  cappedAccrual,
  carryoverAmount,
  easterSunday,
  holidayKeySet,
  nthWeekday,
  toBasisUnits,
  workdayCount,
  workingWeekdays
} from "./leave-v2.js";
import { buildBankPayoutCsv as buildBankCsv } from "./bulk-payroll.js";

const d = (s: string) => new Date(s + "T00:00:00Z");

test("workingWeekdays defaults to Mon-Fri and honors the schedule pattern", () => {
  assert.deepEqual([...workingWeekdays(null)].sort(), [1, 2, 3, 4, 5]);
  const fourDay = workingWeekdays([
    { day: "mon", hours: 8 }, { day: "tue", hours: 8 }, { day: "wed", hours: 8 }, { day: "thu", hours: 8 }
  ]);
  assert.deepEqual([...fourDay].sort(), [1, 2, 3, 4]);
  // zero-hours entries are not working days
  assert.deepEqual([...workingWeekdays([{ day: "sat", hours: 0 }, { day: "sun", hours: 4 }])], [0]);
});

test("workdayCount is schedule-aware and skips public holidays", () => {
  // Mon 2026-09-21 .. Fri 2026-09-25 = 5 weekdays
  assert.equal(workdayCount(d("2026-09-21"), d("2026-09-25")), 5);
  // with a holiday mid-week
  const holidays = holidayKeySet([d("2026-09-23")]);
  assert.equal(workdayCount(d("2026-09-21"), d("2026-09-25"), { holidays }), 4);
  // holidays not excluded when the policy says so
  assert.equal(workdayCount(d("2026-09-21"), d("2026-09-25"), { holidays, excludeHolidays: false }), 5);
  // weekend-only schedule
  const weekend = [{ day: "sat", hours: 6 }, { day: "sun", hours: 6 }];
  assert.equal(workdayCount(d("2026-09-21"), d("2026-09-27"), { pattern: weekend }), 2);
  // inverted range
  assert.equal(workdayCount(d("2026-09-25"), d("2026-09-21")), 0);
});

test("toBasisUnits converts days to hours for hours-basis policies", () => {
  assert.equal(toBasisUnits(3, { basis: "days" }), 3);
  assert.equal(toBasisUnits(3, { basis: "hours" }), 24);
  assert.equal(toBasisUnits(2.5, { basis: "hours" }, 7.5), 18.75);
});

test("accrualSpecs: monthly accrual only for completed months from assignment start", () => {
  const policy = { annualAllowanceDays: 0, accrualPerMonth: 1.25 };
  const asOf = d("2026-04-15");
  // assigned Jan 10: completes Jan, Feb, Mar by mid-April
  const specs = accrualSpecs(policy, d("2026-01-10"), 2026, asOf);
  assert.deepEqual(specs, [
    { month: 1, amount: 1.25 },
    { month: 2, amount: 1.25 },
    { month: 3, amount: 1.25 }
  ]);
  // assigned in March: only March completes
  assert.deepEqual(accrualSpecs(policy, d("2026-03-05"), 2026, asOf), [{ month: 3, amount: 1.25 }]);
});

test("accrualSpecs: up-front allowance posts once at year/assignment start", () => {
  const policy = { annualAllowanceDays: 15, accrualPerMonth: 0 };
  assert.deepEqual(accrualSpecs(policy, d("2025-06-01"), 2026, d("2026-02-01")), [{ month: 0, amount: 15 }]);
  // untracked policy (no allowance, no accrual) posts nothing
  assert.deepEqual(accrualSpecs({ annualAllowanceDays: 0, accrualPerMonth: 0 }, d("2025-06-01"), 2026, d("2026-02-01")), []);
});

test("carryoverAmount caps and floors", () => {
  assert.equal(carryoverAmount(8, 5), 5);
  assert.equal(carryoverAmount(3, 5), 3);
  assert.equal(carryoverAmount(-2, 5), 0);
  assert.equal(carryoverAmount(8, 0), 0); // cap 0 = no carryover
});

test("balanceFromEvents replays the ledger and respects asOf", () => {
  const events = [
    { amount: 15, eventDate: d("2026-01-01") },
    { amount: -3, eventDate: d("2026-03-10") },
    { amount: -2, eventDate: d("2026-08-01") }
  ];
  assert.equal(balanceFromEvents(events), 10);
  assert.equal(balanceFromEvents(events, d("2026-06-30")), 12);
  assert.equal(balanceFromEvents([]), 0);
});

test("cappedAccrual stops at maxBalance", () => {
  assert.equal(cappedAccrual(13, 1.25, 14), 1);
  assert.equal(cappedAccrual(14, 1.25, 14), 0);
  assert.equal(cappedAccrual(10, 1.25, 0), 1.25); // uncapped
});

test("easterSunday matches known dates", () => {
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(easterSunday(2025).toISOString().slice(0, 10), "2025-04-20");
  assert.equal(easterSunday(2027).toISOString().slice(0, 10), "2027-03-28");
});

test("nthWeekday finds the nth weekday of a month", () => {
  // first Monday of March 2026 = Mar 2
  assert.equal(nthWeekday(2026, 2, 1, 1).toISOString().slice(0, 10), "2026-03-02");
  // second Friday of June 2026 = Jun 12
  assert.equal(nthWeekday(2026, 5, 5, 2).toISOString().slice(0, 10), "2026-06-12");
});

test("bviHolidays returns 13 dated holidays with Easter-derived days", () => {
  const holidays = bviHolidays(2026);
  assert.equal(holidays.length, 13);
  const names = holidays.map((h) => h.name);
  assert.ok(names.includes("Good Friday") && names.includes("Emancipation Monday") && names.includes("Christmas Day"));
  const gf = holidays.find((h) => h.name === "Good Friday");
  assert.equal(gf?.date.toISOString().slice(0, 10), "2026-04-03");
});

test("buildBankPayoutCsv emits header, escaped rows, and an exact total line", () => {
  const csv = buildBankCsv([
    { bankName: "First Bank, BVI", accountNumber: "123456", transitNumber: "001", employeeName: 'Alice "Ace" Ann', amount: 1200.5, reference: "PAYROLL SEP" },
    { bankName: "Banco Popular", accountNumber: "654321", transitNumber: "", employeeName: "Bob B", amount: 300, reference: "PAYROLL SEP" }
  ], "September run");
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "Bank,Account Number,Transit,Employee,Amount,Reference");
  assert.ok(lines[1].startsWith('"First Bank, BVI",123456'));
  assert.ok(lines[1].includes('"Alice ""Ace"" Ann"'));
  assert.ok(lines[2].startsWith("Banco Popular,654321"));
  const total = lines[3];
  assert.ok(total.includes("1500.50"), total);
  assert.ok(total.includes("2 payment(s)"));
});
