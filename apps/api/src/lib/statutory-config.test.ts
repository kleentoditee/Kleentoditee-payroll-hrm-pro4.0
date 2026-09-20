import assert from "node:assert/strict";
import test from "node:test";
import { annualCeilingForSchedule, employerPayrollTaxRate } from "./statutory-config.js";

test("annual statutory ceilings convert for each pay schedule", () => {
  assert.equal(annualCeilingForSchedule(53400, "monthly"), 4450);
  assert.equal(annualCeilingForSchedule(53400, "biweekly"), 53400 / 26);
  assert.equal(annualCeilingForSchedule(53400, "weekly"), 53400 / 52);
});

test("BVI payroll tax employer class determines employer rate", () => {
  assert.equal(employerPayrollTaxRate("NOT_SET"), 0);
  assert.equal(employerPayrollTaxRate("CLASS_1"), 0.02);
  assert.equal(employerPayrollTaxRate("CLASS_2"), 0.06);
});
