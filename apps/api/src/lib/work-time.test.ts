import assert from "node:assert/strict";
import test from "node:test";
import { calculatedShiftHours } from "./work-time.js";

test("work time subtracts an unpaid break", () => {
  assert.equal(calculatedShiftHours("08:00", "16:00", 30), 7.5);
});

test("work time supports a shift that ends after midnight", () => {
  assert.equal(calculatedShiftHours("22:00", "02:00", 15), 3.75);
});

test("work time rejects invalid times and breaks longer than the shift", () => {
  assert.equal(calculatedShiftHours("8:00", "16:00", 0), null);
  assert.equal(calculatedShiftHours("08:00", "09:00", 90), null);
  assert.equal(calculatedShiftHours("08:00", "16:00", -1), null);
});
