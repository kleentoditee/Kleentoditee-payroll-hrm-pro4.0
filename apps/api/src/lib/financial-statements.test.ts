import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAging,
  buildBalanceSheet,
  buildCashFlow,
  buildChangesInEquity,
  buildProfitLoss,
  canonicalJson,
  statementHash,
  statementToCsv,
  type AccountBalance
} from "./financial-statements.js";

const ACC = {
  cash: { accountId: "a1000", code: "1000", name: "Cash", type: "asset", subtype: "Bank" },
  ar: { accountId: "a1100", code: "1100", name: "Accounts Receivable", type: "asset", subtype: "Accounts Receivable" },
  uf: { accountId: "a1150", code: "1150", name: "Undeposited Funds", type: "asset", subtype: "Cash and Cash Equivalents" },
  ap: { accountId: "a2000", code: "2000", name: "Accounts Payable", type: "liability", subtype: "Accounts Payable" },
  nhi: { accountId: "a2100", code: "2100", name: "NHI Payable", type: "liability", subtype: "Payroll Liabilities" },
  owner: { accountId: "a3000", code: "3000", name: "Owner's Equity", type: "equity", subtype: "Equity" },
  re: { accountId: "a3100", code: "3100", name: "Retained Earnings", type: "equity", subtype: "Equity" },
  sales: { accountId: "a4000", code: "4000", name: "Sales Revenue", type: "revenue", subtype: "Sales" },
  office: { accountId: "a6000", code: "6000", name: "Office Expenses", type: "expense", subtype: "Operating Expenses" },
  wages: { accountId: "a6100", code: "6100", name: "Wages & Salaries", type: "expense", subtype: "Payroll" }
} as const;

const bal = (meta: (typeof ACC)[keyof typeof ACC], balance: number): AccountBalance => ({ ...meta, balance });

// 2026 activity: owner contribution 10,000; credit sales 5,000; cash sales 2,000;
// AR collected 3,000; bill 1,200 (700 paid); wages 4,000 with NHI 150 owed.
const OPEN: AccountBalance[] = [];
const CLOSE: AccountBalance[] = [
  bal(ACC.cash, 10450),
  bal(ACC.ar, 2000),
  bal(ACC.ap, -500),
  bal(ACC.nhi, -150),
  bal(ACC.owner, -10000),
  bal(ACC.sales, -7000),
  bal(ACC.office, 1200),
  bal(ACC.wages, 4000)
];

test("P&L: revenue 7,000 - expenses 5,200 = net income 1,800", () => {
  const pl = buildProfitLoss(CLOSE, "2026-01-01", "2026-12-31");
  assert.equal(pl.totalRevenue, 7000);
  assert.equal(pl.totalExpenses, 5200);
  assert.equal(pl.netIncome, 1800);
  assert.equal(pl.revenueSections[0].subtype, "Sales");
  assert.equal(pl.expenseSections.length, 2);
});

test("balance sheet: A = L + E and current earnings equal P&L net income", () => {
  const pl = buildProfitLoss(CLOSE, "2026-01-01", "2026-12-31");
  const bs = buildBalanceSheet(CLOSE, "2026-12-31");
  assert.equal(bs.totalAssets, 12450);
  assert.equal(bs.totalLiabilities, 650);
  assert.equal(bs.currentEarnings, pl.netIncome);
  assert.equal(bs.totalEquity, 11800);
  assert.equal(bs.balanceCheck, 0); // A = L + E
  assert.equal(bs.cashAndEquivalents, 10450);
});

test("cash flow: net change equals actual cash movement (completeness check 0)", () => {
  const pl = buildProfitLoss(CLOSE, "2026-01-01", "2026-12-31");
  const cf = buildCashFlow(OPEN, CLOSE, "2026-01-01", "2026-12-31", pl.netIncome);
  // operating: 1800 NI - 2000 AR increase + 500 AP increase + 150 NHI increase = 450
  assert.equal(cf.operating.total, 450);
  assert.equal(cf.investing.total, 0);
  assert.equal(cf.financing.total, 10000); // owner contribution
  assert.equal(cf.netChangeInCash, 10450);
  assert.equal(cf.openingCash, 0);
  assert.equal(cf.closingCash, 10450);
  assert.equal(cf.completenessCheck, 0);
});

test("changes in equity: opening + NI + contributions = closing", () => {
  const pl = buildProfitLoss(CLOSE, "2026-01-01", "2026-12-31");
  const eq = buildChangesInEquity(OPEN, CLOSE, "2026-01-01", "2026-12-31", pl.netIncome);
  assert.equal(eq.openingEquity, 0);
  assert.equal(eq.ownerContributions, 10000);
  assert.equal(eq.ownerDraws, 0);
  assert.equal(eq.closingEquity, 11800);
  assert.equal(eq.consistencyCheck, 0);
});

test("year-end close moves net income into retained earnings and zeroes P&L", () => {
  // Closing journal: Dr Sales 7000 / Cr Office 1200 / Cr Wages 4000 / Cr RE 1800
  const AFTER_CLOSE: AccountBalance[] = [
    bal(ACC.cash, 10450),
    bal(ACC.ar, 2000),
    bal(ACC.ap, -500),
    bal(ACC.nhi, -150),
    bal(ACC.owner, -10000),
    bal(ACC.re, -1800),
    bal(ACC.sales, 0),
    bal(ACC.office, 0),
    bal(ACC.wages, 0)
  ];
  const bs = buildBalanceSheet(AFTER_CLOSE, "2027-01-01");
  assert.equal(bs.currentEarnings, 0); // P&L accounts fully closed
  assert.equal(bs.totalEquity, 11800); // equity preserved through the close
  assert.equal(bs.balanceCheck, 0);
  const re = bs.equityAccounts.find((a) => a.code === "3100");
  assert.equal(re?.amount, 1800); // net income now lives in retained earnings
});

test("aging buckets by days overdue and skip zero balances", () => {
  const report = buildAging(
    [
      { id: "1", number: "INV-1", name: "A", dueDate: "2026-12-31", balance: 100 }, // not yet due
      { id: "2", number: "INV-2", name: "B", dueDate: "2026-11-20", balance: 200 }, // 41 days
      { id: "3", number: "INV-3", name: "C", dueDate: "2026-06-01", balance: 300 }, // >90 days
      { id: "4", number: "INV-4", name: "D", dueDate: "2026-01-01", balance: 0 }
    ],
    "2026-12-31"
  );
  assert.equal(report.buckets.current, 100);
  assert.equal(report.buckets.days31to60, 200);
  assert.equal(report.buckets.over90, 300);
  assert.equal(report.total, 600);
  assert.equal(report.rows.length, 3);
});

test("statement hash is canonical and tamper-evident", () => {
  const a = { x: 1, nested: { b: 2, a: [3] } };
  const b = { nested: { a: [3], b: 2 }, x: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(statementHash(a), statementHash(b));
  assert.notEqual(statementHash(a), statementHash({ ...a, x: 2 }));
});

test("statementToCsv quotes cells and formats amounts", () => {
  const csv = statementToCsv("Profit & Loss", [
    { label: "Revenue", amount: 7000, depth: 0 },
    { label: 'Sales, "Services"', amount: 7000, depth: 1 },
    { label: "Net income", amount: 1800 }
  ]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Profit & Loss");
  assert.ok(csv.includes('"  Sales, ""Services""",7000.00'));
  assert.ok(csv.endsWith("\r\n"));
});
