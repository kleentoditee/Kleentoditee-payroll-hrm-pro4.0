import assert from "node:assert/strict";
import { test } from "node:test";
import {
  toCustomerOverviewSummary,
  toSupplierOverviewSummary
} from "./finance-summary.js";

test("customer overview summary maps and rounds aggregates", () => {
  const out = toCustomerOverviewSummary({
    open: { balance: 1250.005, count: 7 },
    overdue: { balance: 300.1 + 100.2, count: 2 }, // 400.29999... float trap
    recentlyPaid: 999.999
  });
  assert.equal(out.totalOpenBalance, 1250.01);
  assert.equal(out.openInvoiceCount, 7);
  assert.equal(out.overdueCount, 2);
  assert.equal(out.overdueBalance, 400.3);
  assert.equal(out.recentlyPaidTotal, 1000);
});

test("customer overview summary coerces null aggregates to zero", () => {
  const out = toCustomerOverviewSummary({
    open: { balance: null, count: 0 },
    overdue: { balance: null, count: 0 },
    recentlyPaid: null
  });
  assert.deepEqual(out, {
    totalOpenBalance: 0,
    openInvoiceCount: 0,
    overdueCount: 0,
    overdueBalance: 0,
    recentlyPaidTotal: 0
  });
});

test("supplier overview summary maps and rounds aggregates", () => {
  const out = toSupplierOverviewSummary({
    open: { balance: 500.125, count: 3 },
    overdue: { balance: 200, count: 1 },
    recentlyPaid: 42
  });
  assert.deepEqual(out, {
    totalOpenBalance: 500.13,
    openBillCount: 3,
    overdueCount: 1,
    overdueBalance: 200,
    recentlyPaidTotal: 42
  });
});

test("supplier overview summary coerces null aggregates to zero", () => {
  const out = toSupplierOverviewSummary({
    open: { balance: null, count: 0 },
    overdue: { balance: null, count: 0 },
    recentlyPaid: null
  });
  assert.deepEqual(out, {
    totalOpenBalance: 0,
    openBillCount: 0,
    overdueCount: 0,
    overdueBalance: 0,
    recentlyPaidTotal: 0
  });
});
