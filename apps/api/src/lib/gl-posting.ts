/**
 * General-ledger posting engine (Batch 8, R7).
 *
 * Pure rule builders (no DB) + Prisma-backed post/reverse helpers.
 * Invariants:
 *  - every journal has >= 2 lines and balances (total debit == total credit);
 *  - every line has exactly one of debit/credit > 0, rounded to cents;
 *  - posting is idempotent via the unique sourceKey `${sourceType}:${sourceId}`;
 *  - corrections are reversal journals, never edits to posted rows.
 */
import { requireOrgId, prisma, type Prisma } from "@kleentoditee/db";
import { assertPeriodOpen } from "./fiscal-periods.js";

export const GL_TOLERANCE = 0.005;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------------------
// Control accounts (resolved by code; auto-provisioned additively if missing,
// same pattern as leave policies in Batch 5 — seed.ts upserts the same rows).
// ---------------------------------------------------------------------------

export type ControlAccountKey =
  | "accountsReceivable"
  | "accountsPayable"
  | "taxPayable"
  | "nhiPayable"
  | "ssbPayable"
  | "payrollTaxPayable"
  | "netWagesPayable"
  | "otherDeductionsPayable"
  | "undepositedFunds"
  | "wagesExpense"
  | "employerStatutoryExpense"
  | "retainedEarnings"
  | "ownerEquity"
  | "openingBalanceEquity";

export const CONTROL_ACCOUNTS: Record<
  ControlAccountKey,
  { code: string; name: string; type: "asset" | "liability" | "equity" | "revenue" | "expense"; subtype: string }
> = {
  accountsReceivable: { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "Accounts Receivable" },
  accountsPayable: { code: "2000", name: "Accounts Payable", type: "liability", subtype: "Accounts Payable" },
  taxPayable: { code: "2700", name: "Tax Payable", type: "liability", subtype: "Taxes" },
  nhiPayable: { code: "2100", name: "NHI Payable", type: "liability", subtype: "Payroll Liabilities" },
  ssbPayable: { code: "2200", name: "SSB Payable", type: "liability", subtype: "Payroll Liabilities" },
  payrollTaxPayable: { code: "2300", name: "Payroll Tax Payable", type: "liability", subtype: "Payroll Liabilities" },
  netWagesPayable: { code: "2500", name: "Net Wages Payable", type: "liability", subtype: "Payroll Liabilities" },
  otherDeductionsPayable: { code: "2600", name: "Other Payroll Deductions Payable", type: "liability", subtype: "Payroll Liabilities" },
  undepositedFunds: { code: "1150", name: "Undeposited Funds", type: "asset", subtype: "Cash and Cash Equivalents" },
  wagesExpense: { code: "6100", name: "Wages & Salaries", type: "expense", subtype: "Payroll" },
  employerStatutoryExpense: { code: "6200", name: "Employer Statutory Contributions", type: "expense", subtype: "Payroll" },
  retainedEarnings: { code: "3100", name: "Retained Earnings", type: "equity", subtype: "Equity" },
  ownerEquity: { code: "3000", name: "Owner's Equity", type: "equity", subtype: "Equity" },
  openingBalanceEquity: { code: "3200", name: "Opening Balance Equity", type: "equity", subtype: "Equity" }
};

// ---------------------------------------------------------------------------
// Pure types + validation
// ---------------------------------------------------------------------------

export type GlLineInput = { accountId: string; debit?: number; credit?: number; memo?: string };

export type GlJournalInput = {
  sourceType: string;
  sourceId: string;
  date: Date;
  memo: string;
  lines: GlLineInput[];
};

export function sourceKey(sourceType: string, sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

/** Normalize + validate journal lines. Throws on any rule violation. */
export function validateJournalLines(lines: GlLineInput[]): Array<{ accountId: string; debit: number; credit: number; memo: string }> {
  const usable = lines
    .map((l) => ({
      accountId: l.accountId,
      debit: round2(Math.max(0, Number(l.debit ?? 0))),
      credit: round2(Math.max(0, Number(l.credit ?? 0))),
      memo: l.memo ?? ""
    }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (usable.length < 2) {
    throw new Error("A journal entry needs at least two non-zero lines.");
  }
  for (const [i, l] of usable.entries()) {
    if (!l.accountId) throw new Error(`Line ${i + 1}: accountId is required.`);
    if (l.debit > 0 && l.credit > 0) throw new Error(`Line ${i + 1}: debit and credit cannot both be set.`);
  }
  const totalDebit = round2(usable.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(usable.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > GL_TOLERANCE) {
    throw new Error(`Journal out of balance: debits ${totalDebit} != credits ${totalCredit}.`);
  }
  return usable;
}

/** Swap debit/credit on every line — the reversal of a posted journal. */
export function reversalLines(lines: Array<{ accountId: string; debit: number; credit: number; memo: string }>): GlLineInput[] {
  return lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, memo: l.memo }));
}

// ---------------------------------------------------------------------------
// Pure posting-rule builders (unit-tested without a DB)
// ---------------------------------------------------------------------------

type InvoiceLike = {
  id: string;
  number: string;
  issueDate: Date;
  total: number;
  taxTotal: number;
  lines: Array<{ incomeAccountId: string; amount: number; description?: string }>;
};

export function buildInvoiceIssuedJournal(inv: InvoiceLike, arAccountId: string, taxAccountId: string): GlJournalInput {
  const byAccount = new Map<string, number>();
  for (const l of inv.lines) {
    byAccount.set(l.incomeAccountId, round2((byAccount.get(l.incomeAccountId) ?? 0) + l.amount));
  }
  const lines: GlLineInput[] = [{ accountId: arAccountId, debit: inv.total, memo: `Invoice ${inv.number}` }];
  for (const [accountId, amount] of byAccount) {
    lines.push({ accountId, credit: amount, memo: `Invoice ${inv.number}` });
  }
  if (inv.taxTotal > GL_TOLERANCE) {
    lines.push({ accountId: taxAccountId, credit: inv.taxTotal, memo: `Invoice ${inv.number} tax` });
  }
  return { sourceType: "invoice", sourceId: inv.id, date: inv.issueDate, memo: `Invoice ${inv.number} issued`, lines };
}

type BillLike = {
  id: string;
  number: string;
  billDate: Date;
  total: number;
  taxTotal: number;
  lines: Array<{ expenseAccountId: string; amount: number }>;
};

export function buildBillReceivedJournal(bill: BillLike, apAccountId: string, taxAccountId: string): GlJournalInput {
  const byAccount = new Map<string, number>();
  for (const l of bill.lines) {
    byAccount.set(l.expenseAccountId, round2((byAccount.get(l.expenseAccountId) ?? 0) + l.amount));
  }
  const lines: GlLineInput[] = [];
  for (const [accountId, amount] of byAccount) {
    lines.push({ accountId, debit: amount, memo: `Bill ${bill.number}` });
  }
  // Purchase tax is expensed with the bill (BVI has no recoverable VAT); if a
  // taxTotal is ever recorded it posts against the tax clearing account.
  if (bill.taxTotal > GL_TOLERANCE) {
    lines.push({ accountId: taxAccountId, debit: bill.taxTotal, memo: `Bill ${bill.number} tax` });
  }
  lines.push({ accountId: apAccountId, credit: bill.total, memo: `Bill ${bill.number}` });
  return { sourceType: "bill", sourceId: bill.id, date: bill.billDate, memo: `Bill ${bill.number} received`, lines };
}

type PaymentLike = { id: string; number: string; paymentDate: Date; amount: number; depositAccountId: string };

export function buildPaymentReceivedJournal(p: PaymentLike, arAccountId: string): GlJournalInput {
  return {
    sourceType: "payment",
    sourceId: p.id,
    date: p.paymentDate,
    memo: `Customer payment ${p.number}`,
    lines: [
      { accountId: p.depositAccountId, debit: p.amount, memo: `Payment ${p.number}` },
      // Unapplied portions stay a credit against AR (customer credit).
      { accountId: arAccountId, credit: p.amount, memo: `Payment ${p.number}` }
    ]
  };
}

type BillPaymentLike = { id: string; number: string; paymentDate: Date; amount: number; sourceAccountId: string };

export function buildBillPaymentJournal(bp: BillPaymentLike, apAccountId: string): GlJournalInput {
  return {
    sourceType: "bill_payment",
    sourceId: bp.id,
    date: bp.paymentDate,
    memo: `Supplier payment ${bp.number}`,
    lines: [
      { accountId: apAccountId, debit: bp.amount, memo: `Payment ${bp.number}` },
      { accountId: bp.sourceAccountId, credit: bp.amount, memo: `Payment ${bp.number}` }
    ]
  };
}

type ExpenseLike = {
  id: string;
  number: string;
  expenseDate: Date;
  total: number;
  taxTotal: number;
  paymentAccountId: string;
  lines: Array<{ expenseAccountId: string; amount: number }>;
};

export function buildExpensePostedJournal(exp: ExpenseLike, taxAccountId: string): GlJournalInput {
  const byAccount = new Map<string, number>();
  for (const l of exp.lines) {
    byAccount.set(l.expenseAccountId, round2((byAccount.get(l.expenseAccountId) ?? 0) + l.amount));
  }
  const lines: GlLineInput[] = [];
  for (const [accountId, amount] of byAccount) {
    lines.push({ accountId, debit: amount, memo: `Expense ${exp.number}` });
  }
  if (exp.taxTotal > GL_TOLERANCE) {
    lines.push({ accountId: taxAccountId, debit: exp.taxTotal, memo: `Expense ${exp.number} tax` });
  }
  lines.push({ accountId: exp.paymentAccountId, credit: exp.total, memo: `Expense ${exp.number}` });
  return { sourceType: "expense", sourceId: exp.id, date: exp.expenseDate, memo: `Expense ${exp.number} posted`, lines };
}

export type PayrollRunLike = {
  id: string;
  periodLabel: string;
  payDate: Date;
  items: Array<{
    gross: number;
    net: number;
    nhi: number;
    ssb: number;
    incomeTax: number;
    payrollTax: number;
    employerNhi: number;
    employerSsb: number;
    employerPayrollTax: number;
    manualDeductions: number;
    advanceDeduction?: number;
    withdrawalDeduction?: number;
    loanDeduction?: number;
    otherDeduction?: number;
  }>;
};

export function buildPayrollRunJournal(
  run: PayrollRunLike,
  accounts: Record<ControlAccountKey, string>
): GlJournalInput {
  const sum = (fn: (i: PayrollRunLike["items"][number]) => number) => round2(run.items.reduce((s, i) => s + fn(i), 0));
  const gross = sum((i) => i.gross);
  const net = sum((i) => i.net);
  const nhi = sum((i) => i.nhi);
  const ssb = sum((i) => i.ssb);
  const payrollTax = sum((i) => i.payrollTax);
  const employerNhi = sum((i) => i.employerNhi);
  const employerSsb = sum((i) => i.employerSsb);
  const employerPayrollTax = sum((i) => i.employerPayrollTax);
  const otherDeductions = sum(
    (i) => i.manualDeductions + (i.advanceDeduction ?? 0) + (i.withdrawalDeduction ?? 0) + (i.loanDeduction ?? 0) + (i.otherDeduction ?? 0)
  );
  const employerTotal = round2(employerNhi + employerSsb + employerPayrollTax);

  const lines: GlLineInput[] = [
    { accountId: accounts.wagesExpense, debit: gross, memo: "Gross wages" },
    { accountId: accounts.employerStatutoryExpense, debit: employerTotal, memo: "Employer NHI/SSB/payroll tax" },
    { accountId: accounts.nhiPayable, credit: round2(nhi + employerNhi), memo: "NHI payable (employee + employer)" },
    { accountId: accounts.ssbPayable, credit: round2(ssb + employerSsb), memo: "SSB payable (employee + employer)" },
    { accountId: accounts.payrollTaxPayable, credit: round2(payrollTax + employerPayrollTax), memo: "Payroll tax payable" },
    { accountId: accounts.otherDeductionsPayable, credit: otherDeductions, memo: "Other deductions payable" },
    { accountId: accounts.netWagesPayable, credit: net, memo: "Net wages payable" }
  ];
  return {
    sourceType: "payroll_run",
    sourceId: run.id,
    date: run.payDate,
    memo: `Payroll run finalized — ${run.periodLabel}`,
    lines
  };
}

/**
 * Settlement journal for marking a run PAID: cash leaves the bank and the
 * net-wages liability is cleared. Cash account is resolved by code (default
 * "1000 Cash" from the seeded chart); explicit account id wins.
 */
export function buildPayrollSettlementJournal(
  run: PayrollRunLike,
  accounts: Record<ControlAccountKey, string>,
  cashAccountId: string
): GlJournalInput {
  const net = round2(run.items.reduce((s, i) => s + i.net, 0));
  return {
    sourceType: "payroll_run_paid",
    sourceId: run.id,
    date: run.payDate,
    memo: `Payroll run paid — net wages settled (${run.periodLabel})`,
    lines: [
      { accountId: accounts.netWagesPayable, debit: net, memo: "Net wages paid" },
      { accountId: cashAccountId, credit: net, memo: "Cash paid to employees" }
    ]
  };
}

/**
 * Statutory remittance journal: the withheld + employer NHI/SSB/payroll-tax
 * liabilities are paid over to SSB / NHI / Inland Revenue, clearing the
 * liability accounts against cash.
 */
export function buildPayrollRemittanceJournal(
  run: PayrollRunLike,
  accounts: Record<ControlAccountKey, string>,
  cashAccountId: string
): GlJournalInput {
  const sum = (fn: (i: PayrollRunLike["items"][number]) => number) => round2(run.items.reduce((s, i) => s + fn(i), 0));
  const nhi = round2(sum((i) => i.nhi) + sum((i) => i.employerNhi));
  const ssb = round2(sum((i) => i.ssb) + sum((i) => i.employerSsb));
  const payrollTax = round2(sum((i) => i.payrollTax) + sum((i) => i.employerPayrollTax));
  const total = round2(nhi + ssb + payrollTax);
  return {
    sourceType: "payroll_statutory_remittance",
    sourceId: run.id,
    date: run.payDate,
    memo: `Statutory remittance — NHI/SSB/payroll tax (${run.periodLabel})`,
    lines: [
      { accountId: accounts.nhiPayable, debit: nhi, memo: "NHI remitted" },
      { accountId: accounts.ssbPayable, debit: ssb, memo: "SSB remitted" },
      { accountId: accounts.payrollTaxPayable, debit: payrollTax, memo: "Payroll tax remitted" },
      { accountId: cashAccountId, credit: total, memo: "Cash remitted to authorities" }
    ]
  };
}

/** Look up a GL account by its chart code. Throws when the code is missing. */
export async function findAccountIdByCode(db: DbClient, code: string): Promise<string> {
  const account = await db.account.findFirst({ where: { code }, select: { id: true } });
  if (!account) {
    throw new Error(`GL account with code ${code} not found. Add it to the chart of accounts first.`);
  }
  return account.id;
}

// ---------------------------------------------------------------------------
// DB-backed posting (idempotent by sourceKey)
// ---------------------------------------------------------------------------


/**
 * Deposit posting via undeposited funds (Batch 13): Dr the deposit's bank
 * account for the total; Cr Undeposited Funds for payment-linked lines (their
 * receipts already debited UF); Cr each ad-hoc line's attributed account.
 */
export function buildDepositPostedJournal(input: {
  id: string;
  number: string;
  depositDate: Date;
  bankAccountId: string;
  total: number;
  /** Resolved Undeposited Funds account id (from ensureControlAccounts). */
  undepositedFundsAccountId: string;
  /** Payment-linked line amounts (credit UF). */
  paymentAmounts: Array<{ number: string; amount: number }>;
  /** Ad-hoc lines with account attribution. */
  adhocLines: Array<{ accountId: string; amount: number; description: string }>;
}): GlJournalInput {
  const lines: GlLineInput[] = [
    { accountId: input.bankAccountId, debit: round2(input.total), memo: `Deposit ${input.number}` }
  ];
  const ufTotal = round2(input.paymentAmounts.reduce((s, p) => s + p.amount, 0));
  if (ufTotal > 0) {
    lines.push({
      accountId: input.undepositedFundsAccountId,
      credit: ufTotal,
      memo: `Undeposited funds cleared by ${input.number}`
    });
  }
  for (const l of input.adhocLines) {
    lines.push({ accountId: l.accountId, credit: round2(l.amount), memo: l.description || `Deposit ${input.number}` });
  }
  return {
    sourceType: "deposit_posted",
    sourceId: input.id,
    date: input.depositDate,
    memo: `Deposit ${input.number}`,
    lines
  };
}

/**
 * Year-end closing journal (Batch 15): zero every revenue account (Dr) and
 * expense account (Cr) with a balance, and move the net into Retained
 * Earnings. After posting, P&L account balances for the year are zero and
 * equity carries the year's result.
 */
export function buildYearEndClosingJournal(input: {
  closeId: string;
  year: number;
  closeDate: Date;
  retainedEarningsAccountId: string;
  /** Per-account signed balances (debit-positive) at the close date. */
  balances: Array<{ accountId: string; code: string; name: string; type: string; balance: number }>;
}): GlJournalInput {
  const lines: GlLineInput[] = [];
  let netToRE = 0; // credit-positive into retained earnings
  for (const b of input.balances) {
    const amount = round2(Math.abs(b.balance));
    if (amount <= 0) continue;
    if (b.type === "revenue" && b.balance < 0) {
      lines.push({ accountId: b.accountId, debit: amount, memo: `Close ${b.code} ${b.name} to retained earnings` });
      netToRE = round2(netToRE + amount);
    } else if (b.type === "expense" && b.balance > 0) {
      lines.push({ accountId: b.accountId, credit: amount, memo: `Close ${b.code} ${b.name} to retained earnings` });
      netToRE = round2(netToRE - amount);
    }
  }
  if (Math.abs(netToRE) > 0) {
    lines.push(
      netToRE > 0
        ? { accountId: input.retainedEarningsAccountId, credit: netToRE, memo: `Net income ${input.year}` }
        : { accountId: input.retainedEarningsAccountId, debit: Math.abs(netToRE), memo: `Net loss ${input.year}` }
    );
  }
  return {
    sourceType: "year_end_close",
    sourceId: input.closeId,
    date: input.closeDate,
    memo: `Year-end close ${input.year} — revenue/expense to retained earnings`,
    lines
  };
}

/**
 * Opening-balance journal for a migration batch (Batch 17): every imported
 * opening balance posts against Opening Balance Equity (3200), never into
 * notes. Asset/normal-debit balances debit the account; liability/equity/
 * revenue normal-credit balances credit it; the offsetting side is always OBE
 * so the journal balances by construction.
 *
 * `entries` are signed debit-positive amounts per account.
 */
export function buildOpeningBalanceJournal(input: {
  batchId: string;
  asOfDate: Date;
  openingBalanceEquityAccountId: string;
  entries: Array<{ accountId: string; code: string; name: string; balance: number }>;
}): GlJournalInput {
  const lines: GlLineInput[] = [];
  let obeNet = 0; // credit-positive into OBE
  for (const e of input.entries) {
    const amount = round2(Math.abs(e.balance));
    if (amount <= 0) continue;
    if (e.balance > 0) {
      lines.push({ accountId: e.accountId, debit: amount, memo: `Opening balance ${e.code} ${e.name}` });
      obeNet = round2(obeNet + amount);
    } else {
      lines.push({ accountId: e.accountId, credit: amount, memo: `Opening balance ${e.code} ${e.name}` });
      obeNet = round2(obeNet - amount);
    }
  }
  if (Math.abs(obeNet) > 0) {
    lines.push(
      obeNet > 0
        ? { accountId: input.openingBalanceEquityAccountId, credit: obeNet, memo: "Opening balance offset" }
        : { accountId: input.openingBalanceEquityAccountId, debit: Math.abs(obeNet), memo: "Opening balance offset" }
    );
  }
  return {
    sourceType: "migration_opening_balance",
    sourceId: input.batchId,
    date: input.asOfDate,
    memo: `Opening balances — migration batch ${input.batchId}`,
    lines
  };
}

// ---------------------------------------------------------------------------

type DbClient = Prisma.TransactionClient | typeof prisma;

export type PostResult = { entryId: string; sourceKey: string; created: boolean };

/** Resolve (creating if absent) every control account. Returns key -> id. */
export async function ensureControlAccounts(db: DbClient): Promise<Record<ControlAccountKey, string>> {
  const existing = await db.account.findMany({
    where: { code: { in: Object.values(CONTROL_ACCOUNTS).map((a) => a.code) } },
    select: { id: true, code: true }
  });
  const byCode = new Map(existing.map((a) => [a.code, a.id]));
  const out = {} as Record<ControlAccountKey, string>;
  for (const [key, def] of Object.entries(CONTROL_ACCOUNTS) as Array<[ControlAccountKey, (typeof CONTROL_ACCOUNTS)[ControlAccountKey]]>) {
    const hit = byCode.get(def.code);
    if (hit) {
      out[key] = hit;
      continue;
    }
    const created = await db.account.create({
      data: { orgId: requireOrgId(), code: def.code, name: def.name, type: def.type, subtype: def.subtype, description: "GL control account (auto-provisioned)" },
      select: { id: true }
    });
    out[key] = created.id;
  }
  return out;
}

/**
 * Post a journal exactly once per sourceKey. If a journal already exists for
 * the key, returns it unchanged (created=false) — safe to call on retries and
 * from status-transition endpoints that might fire twice.
 */
export async function postJournal(db: DbClient, input: GlJournalInput, createdByUserId?: string | null): Promise<PostResult> {
  const lines = validateJournalLines(input.lines);
  const key = sourceKey(input.sourceType, input.sourceId);

  // Batch 13: every posting is period-controlled (soft_closed/locked reject).
  await assertPeriodOpen(db, input.date);

  const existing = await db.journalEntry.findFirst({ where: { sourceKey: key }, select: { id: true } });
  if (existing) {
    return { entryId: existing.id, sourceKey: key, created: false };
  }
  try {
    const entry = await db.journalEntry.create({
      data: {
        orgId: requireOrgId(),
        date: input.date,
        memo: input.memo,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceKey: key,
        createdByUserId: createdByUserId ?? null,
        lines: { create: lines.map((l, i) => ({ orgId: requireOrgId(), position: i + 1, ...l })) }
      },
      select: { id: true }
    });
    return { entryId: entry.id, sourceKey: key, created: true };
  } catch (err) {
    // Unique-race fallback: another request posted first.
    const won = await db.journalEntry.findFirst({ where: { sourceKey: key }, select: { id: true } });
    if (won) return { entryId: won.id, sourceKey: key, created: false };
    throw err;
  }
}

/**
 * Undo a posted journal by posting its reversal (swapped debit/credit).
 * Idempotent: the reversal has its own `${sourceType}_reversal:${sourceId}` key.
 * Returns null when the original journal does not exist (nothing posted yet).
 */
export async function reverseJournal(
  db: DbClient,
  sourceType: string,
  sourceId: string,
  opts: { date: Date; memo: string; createdByUserId?: string | null }
): Promise<PostResult | null> {
  const original = await db.journalEntry.findFirst({
    where: { sourceKey: sourceKey(sourceType, sourceId) },
    include: { lines: true }
  });
  if (!original) return null;
  const reversalInput: GlJournalInput = {
    sourceType: `${sourceType}_reversal`,
    sourceId,
    date: opts.date,
    memo: opts.memo,
    lines: reversalLines(original.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit), memo: l.memo })))
  };
  const result = await postJournal(db, reversalInput, opts.createdByUserId);
  if (result.created) {
    await db.journalEntry.update({ where: { id: result.entryId }, data: { reversalOfId: original.id } });
  }
  return result;
}
