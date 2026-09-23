import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBillPaymentJournal,
  buildBillReceivedJournal,
  buildDepositPostedJournal,
  buildExpensePostedJournal,
  buildInvoiceIssuedJournal,
  buildPaymentReceivedJournal,
  buildPayrollRunJournal,
  reversalLines,
  round2,
  sourceKey,
  validateJournalLines
} from "./gl-posting.js";
import { aggregateTrialBalance, buildLedgerRows } from "./gl-reports.js";

const ACC = {
  accountsReceivable: "ar",
  accountsPayable: "ap",
  taxPayable: "tax",
  nhiPayable: "nhi",
  ssbPayable: "ssb",
  payrollTaxPayable: "ptax",
  incomeTaxPayable: "itax",
  netWagesPayable: "net",
  otherDeductionsPayable: "oth",
  undepositedFunds: "uf",
  wagesExpense: "wages",
  employerStatutoryExpense: "estat",
  retainedEarnings: "re",
  ownerEquity: "eq",
  openingBalanceEquity: "obe"
} as const;

test("validateJournalLines rejects unbalanced and single-line journals", () => {
  assert.throws(() => validateJournalLines([{ accountId: "a", debit: 100 }]), /at least two/);
  assert.throws(
    () => validateJournalLines([{ accountId: "a", debit: 100 }, { accountId: "b", credit: 99.99 }]),
    /out of balance/
  );
  assert.throws(
    () => validateJournalLines([{ accountId: "a", debit: 50, credit: 50 }, { accountId: "b", credit: 50 }]),
    /cannot both be set/
  );
  // Balanced input passes and zero lines are dropped
  const ok = validateJournalLines([
    { accountId: "a", debit: 100 },
    { accountId: "b", credit: 100 },
    { accountId: "c", debit: 0, credit: 0 }
  ]);
  assert.equal(ok.length, 2);
});

test("invoice issue posts AR debit against per-account income credits plus tax", () => {
  const j = buildInvoiceIssuedJournal(
    {
      id: "inv1",
      number: "INV-2026-0001",
      issueDate: new Date("2026-09-15T00:00:00Z"),
      total: 1150,
      taxTotal: 150,
      lines: [
        { incomeAccountId: "sales", amount: 700 },
        { incomeAccountId: "sales", amount: 300 },
        { incomeAccountId: "other", amount: 0 }
      ]
    },
    ACC.accountsReceivable,
    ACC.taxPayable
  );
  assert.equal(sourceKey(j.sourceType, j.sourceId), "invoice:inv1");
  // lines aggregated by account: sales 1000 credit, AR 1150 debit, tax 150 credit
  const v = validateJournalLines(j.lines);
  const sales = v.find((l) => l.accountId === "sales");
  assert.equal(sales?.credit, 1000);
  assert.equal(v.find((l) => l.accountId === "ar")?.debit, 1150);
  assert.equal(v.find((l) => l.accountId === "tax")?.credit, 150);
});

test("payment received debits the deposit account and credits AR", () => {
  const j = buildPaymentReceivedJournal(
    { id: "p1", number: "PMT-2026-0001", paymentDate: new Date(), amount: 400, depositAccountId: "bank" },
    ACC.accountsReceivable
  );
  const v = validateJournalLines(j.lines);
  assert.equal(v.find((l) => l.accountId === "bank")?.debit, 400);
  assert.equal(v.find((l) => l.accountId === "ar")?.credit, 400);
});

test("bill + bill payment + expense journals balance", () => {
  const bill = buildBillReceivedJournal(
    {
      id: "b1",
      number: "BILL-2026-0001",
      billDate: new Date(),
      total: 250,
      taxTotal: 0,
      lines: [{ expenseAccountId: "cogs", amount: 250 }]
    },
    ACC.accountsPayable,
    ACC.taxPayable
  );
  validateJournalLines(bill.lines);
  assert.equal(bill.lines.find((l) => l.accountId === "ap")?.credit, 250);

  const bp = buildBillPaymentJournal(
    { id: "bp1", number: "BPT-2026-0001", paymentDate: new Date(), amount: 250, sourceAccountId: "bank" },
    ACC.accountsPayable
  );
  const vbp = validateJournalLines(bp.lines);
  assert.equal(vbp.find((l) => l.accountId === "ap")?.debit, 250);
  assert.equal(vbp.find((l) => l.accountId === "bank")?.credit, 250);

  const exp = buildExpensePostedJournal(
    {
      id: "e1",
      number: "EXP-2026-0001",
      expenseDate: new Date(),
      total: 90,
      taxTotal: 0,
      paymentAccountId: "bank",
      lines: [{ expenseAccountId: "office", amount: 60 }, { expenseAccountId: "office", amount: 30 }]
    },
    ACC.taxPayable
  );
  const vexp = validateJournalLines(exp.lines);
  assert.equal(vexp.find((l) => l.accountId === "office")?.debit, 90);
  assert.equal(vexp.find((l) => l.accountId === "bank")?.credit, 90);
});

test("payroll run journal balances and splits employee vs employer statutory", () => {
  // One employee: gross 1350, nhi 50.63, ssb 54, employerNhi 50.63, employerSsb 60.75,
  // net 1245.37 — mirrors the Batch 5 verified run line.
  const j = buildPayrollRunJournal(
    {
      id: "run1",
      periodLabel: "September 2026",
      payDate: new Date("2026-09-30T00:00:00Z"),
      items: [
        {
          gross: 1350,
          net: 1245.37,
          nhi: 50.63,
          ssb: 54,
          incomeTax: 0,
          payrollTax: 0,
          employerNhi: 50.63,
          employerSsb: 60.75,
          employerPayrollTax: 0,
          manualDeductions: 0
        }
      ]
    },
    ACC
  );
  const v = validateJournalLines(j.lines);
  const byId = (id: string) => v.find((l) => l.accountId === id);
  assert.equal(byId("wages")?.debit, 1350);
  assert.equal(byId("estat")?.debit, round2(50.63 + 60.75));
  assert.equal(byId("nhi")?.credit, round2(50.63 + 50.63));
  assert.equal(byId("ssb")?.credit, round2(54 + 60.75));
  assert.equal(byId("net")?.credit, 1245.37);
  // zero-amount lines (income tax, payroll tax, other deductions) are dropped
  assert.equal(byId("itax"), undefined);
  // balanced: 1350 + 111.38 = 101.26 + 114.75 + 1245.37
  const dr = round2(v.reduce((s, l) => s + l.debit, 0));
  const cr = round2(v.reduce((s, l) => s + l.credit, 0));
  assert.equal(dr, cr);
});

test("deposit posting debits bank, clears undeposited funds, credits ad-hoc accounts", () => {
  const j = buildDepositPostedJournal({
    id: "dep1",
    number: "DEP-2026-0001",
    depositDate: new Date("2026-09-18T00:00:00Z"),
    bankAccountId: "bank",
    total: 950,
    undepositedFundsAccountId: ACC.undepositedFunds,
    paymentAmounts: [
      { number: "PMT-2026-0001", amount: 400 },
      { number: "PMT-2026-0002", amount: 300 }
    ],
    adhocLines: [
      { accountId: "sales", amount: 200, description: "Walk-in sale" },
      { accountId: "sales", amount: 50, description: "Tip" }
    ]
  });
  assert.equal(j.sourceType, "deposit_posted");
  assert.equal(sourceKey(j.sourceType, j.sourceId), "deposit_posted:dep1");
  const v = validateJournalLines(j.lines);
  assert.equal(v.find((l) => l.accountId === "bank")?.debit, 950);
  assert.equal(v.find((l) => l.accountId === "uf")?.credit, 700);
  // ad-hoc lines stay per-line; the two sales credits sum to 250
  const salesCredits = v.filter((l) => l.accountId === "sales");
  assert.equal(salesCredits.length, 2);
  assert.equal(round2(salesCredits.reduce((s, l) => s + l.credit, 0)), 250);
  const dr = round2(v.reduce((s, l) => s + l.debit, 0));
  const cr = round2(v.reduce((s, l) => s + l.credit, 0));
  assert.equal(dr, cr);
});

test("ad-hoc-only deposit skips undeposited funds entirely", () => {
  const j = buildDepositPostedJournal({
    id: "dep2",
    number: "DEP-2026-0002",
    depositDate: new Date(),
    bankAccountId: "bank",
    total: 120,
    undepositedFundsAccountId: ACC.undepositedFunds,
    paymentAmounts: [],
    adhocLines: [{ accountId: "other", amount: 120, description: "Owner contribution" }]
  });
  const v = validateJournalLines(j.lines);
  assert.equal(v.find((l) => l.accountId === "uf"), undefined);
  assert.equal(v.find((l) => l.accountId === "bank")?.debit, 120);
  assert.equal(v.find((l) => l.accountId === "other")?.credit, 120);
});

test("reversalLines swaps debit and credit exactly", () => {
  const rev = reversalLines([
    { accountId: "a", debit: 100, credit: 0, memo: "x" },
    { accountId: "b", debit: 0, credit: 100, memo: "y" }
  ]);
  assert.deepEqual(rev, [
    { accountId: "a", debit: 0, credit: 100, memo: "x" },
    { accountId: "b", debit: 100, credit: 0, memo: "y" }
  ]);
  validateJournalLines(rev);
});

test("trial balance aggregates by account with normal-direction balances", () => {
  const accounts = [
    { id: "bank", code: "1000", name: "Cash", type: "asset", subtype: "Bank", active: true },
    { id: "ar", code: "1100", name: "AR", type: "asset", subtype: "", active: true },
    { id: "sales", code: "4000", name: "Sales", type: "revenue", subtype: "", active: true }
  ];
  const lines = [
    { accountId: "ar", debit: 100, credit: 0 },
    { accountId: "sales", debit: 0, credit: 100 },
    { accountId: "bank", debit: 100, credit: 0 },
    { accountId: "ar", debit: 0, credit: 100 }
  ];
  const tb = aggregateTrialBalance(lines, accounts);
  assert.equal(tb.balanced, true);
  assert.equal(tb.totalDebit, 200);
  assert.equal(tb.totalCredit, 200);
  const byId = Object.fromEntries(tb.rows.map((r) => [r.accountId, r]));
  assert.equal(byId.ar.balance, 0); // issued then collected
  assert.equal(byId.bank.balance, 100); // debit-normal
  assert.equal(byId.sales.balance, 100); // credit-normal reported positive
});

test("ledger rows carry a running balance in the normal direction", () => {
  const rows = buildLedgerRows(
    [
      { entryId: "e1", date: new Date("2026-09-01"), memo: "invoice", sourceType: "invoice", sourceId: "1", lineMemo: "", debit: 500, credit: 0 },
      { entryId: "e2", date: new Date("2026-09-05"), memo: "payment", sourceType: "payment", sourceId: "2", lineMemo: "", debit: 0, credit: 200 }
    ],
    "asset"
  );
  assert.equal(rows[0].runningBalance, 500);
  assert.equal(rows[1].runningBalance, 300);
});
