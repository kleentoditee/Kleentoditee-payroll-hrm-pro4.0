// Financial statement engine (Batch 15) — pure functions over per-account
// signed balances (debit - credit) drawn from posted+void journals.
// Invariants enforced by the unit tests and the live gate:
//   A = L + E; net income agrees across P&L / equity / year-end close;
//   ending cash agrees across cash flow / balance sheet / bank register.

import { createHash } from "node:crypto";

export type StatementAccount = {
  accountId: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subtype: string;
};

/** Signed balance: debit-positive for every account type. */
export type AccountBalance = StatementAccount & { balance: number };

const r2 = (n: number) => {
  const v = Math.round(n * 100) / 100;
  return v === 0 ? 0 : v; // normalize -0
};

const CASH_SUBTYPES = new Set(["bank"]);
const CASH_EQUIVALENT_SUBTYPES = new Set(["cash and cash equivalents"]);
const WORKING_CAPITAL_ASSET_SUBTYPES = new Set(["accounts receivable"]);
const WORKING_CAPITAL_LIABILITY_SUBTYPES = new Set([
  "accounts payable",
  "payroll liabilities",
  "taxes"
]);
const RETAINED_EARNINGS_CODE = "3100";

function groupBySubtype(rows: AccountBalance[], sign: number) {
  const sections = new Map<string, { accounts: Array<{ accountId: string; code: string; name: string; amount: number }>; total: number }>();
  for (const row of rows) {
    const amount = r2(row.balance * sign);
    if (Math.abs(amount) < 0.005) continue;
    const key = row.subtype || "Other";
    const section = sections.get(key) ?? { accounts: [], total: 0 };
    section.accounts.push({ accountId: row.accountId, code: row.code, name: row.name, amount });
    section.total = r2(section.total + amount);
    sections.set(key, section);
  }
  return [...sections.entries()]
    .map(([subtype, s]) => ({ subtype, accounts: s.accounts.sort((a, b) => a.code.localeCompare(b.code)), total: s.total }))
    .sort((a, b) => a.subtype.localeCompare(b.subtype));
}

// ---------------------------------------------------------------------------
// Profit & loss over [from, to]: revenue and expense balances in the window.
// ---------------------------------------------------------------------------

export type ProfitLoss = {
  from: string;
  to: string;
  revenueSections: ReturnType<typeof groupBySubtype>;
  expenseSections: ReturnType<typeof groupBySubtype>;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
};

export function buildProfitLoss(periodBalances: AccountBalance[], from: string, to: string): ProfitLoss {
  const revenue = periodBalances.filter((b) => b.type === "revenue");
  const expenses = periodBalances.filter((b) => b.type === "expense");
  const revenueSections = groupBySubtype(revenue, -1); // credit-normal
  const expenseSections = groupBySubtype(expenses, 1); // debit-normal
  const totalRevenue = r2(revenueSections.reduce((s, x) => s + x.total, 0));
  const totalExpenses = r2(expenseSections.reduce((s, x) => s + x.total, 0));
  return {
    from,
    to,
    revenueSections,
    expenseSections,
    totalRevenue,
    totalExpenses,
    netIncome: r2(totalRevenue - totalExpenses)
  };
}

// ---------------------------------------------------------------------------
// Balance sheet at asOf. Equity = equity account balances + unclosed earnings
// (revenue - expense balances remaining in the ledger; zero for closed years).
// ---------------------------------------------------------------------------

export type BalanceSheet = {
  asOf: string;
  assetSections: ReturnType<typeof groupBySubtype>;
  liabilitySections: ReturnType<typeof groupBySubtype>;
  equityAccounts: Array<{ accountId: string; code: string; name: string; amount: number }>;
  currentEarnings: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  /** totalAssets - (totalLiabilities + totalEquity): 0 when books balance. */
  balanceCheck: number;
  cashAndEquivalents: number;
};

export function buildBalanceSheet(balancesAt: AccountBalance[], asOf: string): BalanceSheet {
  const assets = balancesAt.filter((b) => b.type === "asset");
  const liabilities = balancesAt.filter((b) => b.type === "liability");
  const equity = balancesAt.filter((b) => b.type === "equity");
  const pl = balancesAt.filter((b) => b.type === "revenue" || b.type === "expense");

  const assetSections = groupBySubtype(assets, 1);
  const liabilitySections = groupBySubtype(liabilities, -1);
  const totalAssets = r2(assetSections.reduce((s, x) => s + x.total, 0));
  const totalLiabilities = r2(liabilitySections.reduce((s, x) => s + x.total, 0));

  const equityAccounts = equity
    .map((b) => ({ accountId: b.accountId, code: b.code, name: b.name, amount: r2(-b.balance) }))
    .filter((a) => Math.abs(a.amount) >= 0.005)
    .sort((a, b) => a.code.localeCompare(b.code));
  const equityAccountTotal = r2(equityAccounts.reduce((s, a) => s + a.amount, 0));
  // Unclosed earnings: revenue (credit-normal) minus expenses still in the ledger.
  const currentEarnings = r2(-pl.reduce((s, b) => s + b.balance, 0));
  const totalEquity = r2(equityAccountTotal + currentEarnings);

  const cashAndEquivalents = r2(
    assets
      .filter((b) => CASH_SUBTYPES.has(b.subtype.toLowerCase()) || CASH_EQUIVALENT_SUBTYPES.has(b.subtype.toLowerCase()))
      .reduce((s, b) => s + b.balance, 0)
  );

  return {
    asOf,
    assetSections,
    liabilitySections,
    equityAccounts,
    currentEarnings,
    totalAssets,
    totalLiabilities,
    totalEquity,
    balanceCheck: r2(totalAssets - totalLiabilities - totalEquity),
    cashAndEquivalents
  };
}

// ---------------------------------------------------------------------------
// Cash flow (indirect) over [from, to] from opening/closing balances.
// Cash = subtype "Bank" accounts only (Undeposited Funds is working capital).
// ---------------------------------------------------------------------------

export type CashFlowLine = { accountId: string; code: string; name: string; change: number };
export type CashFlowSection = { label: string; lines: CashFlowLine[]; total: number };

export type CashFlow = {
  from: string;
  to: string;
  operating: CashFlowSection;
  investing: CashFlowSection;
  financing: CashFlowSection;
  netChangeInCash: number;
  openingCash: number;
  closingCash: number;
  /** closingCash - openingCash - netChangeInCash: 0 when classification is complete. */
  completenessCheck: number;
};

const isCash = (b: StatementAccount) => CASH_SUBTYPES.has(b.subtype.toLowerCase());
const isCashEquivalent = (b: StatementAccount) => CASH_EQUIVALENT_SUBTYPES.has(b.subtype.toLowerCase());

export function buildCashFlow(opening: AccountBalance[], closing: AccountBalance[], from: string, to: string, netIncome: number): CashFlow {
  const openingById = new Map(opening.map((b) => [b.accountId, b.balance]));
  const closingById = new Map(closing.map((b) => [b.accountId, b.balance]));
  const ids = new Set([...openingById.keys(), ...closingById.keys()]);

  const operatingLines: CashFlowLine[] = [];
  const investingLines: CashFlowLine[] = [];
  const financingLines: CashFlowLine[] = [];

  for (const id of ids) {
    const meta = closing.find((b) => b.accountId === id) ?? opening.find((b) => b.accountId === id);
    if (!meta) continue;
    const delta = r2((closingById.get(id) ?? 0) - (openingById.get(id) ?? 0));
    if (Math.abs(delta) < 0.005) continue;
    const line = { accountId: id, code: meta.code, name: meta.name, change: 0 };
    if (meta.type === "asset") {
      if (isCash(meta)) continue; // the thing being explained
      if (isCashEquivalent(meta) || WORKING_CAPITAL_ASSET_SUBTYPES.has(meta.subtype.toLowerCase())) {
        operatingLines.push({ ...line, change: r2(-delta) }); // asset increase = cash outflow
      } else {
        investingLines.push({ ...line, change: r2(-delta) });
      }
    } else if (meta.type === "liability") {
      // Liability balances are debit-positive signed, so a credit increase
      // shows as a negative delta — negate to express the cash inflow.
      if (WORKING_CAPITAL_LIABILITY_SUBTYPES.has(meta.subtype.toLowerCase())) {
        operatingLines.push({ ...line, change: r2(-delta) });
      } else {
        financingLines.push({ ...line, change: r2(-delta) });
      }
    } else if (meta.type === "equity") {
      // Retained earnings movement comes from the close (already inside NI);
      // other equity accounts are owner contributions (+) / draws (-).
      if (meta.code === RETAINED_EARNINGS_CODE) continue;
      financingLines.push({ ...line, change: r2(-delta) });
    }
    // revenue/expense deltas are already captured in netIncome
  }

  const sort = (lines: CashFlowLine[]) => lines.sort((a, b) => a.code.localeCompare(b.code));
  const sum = (lines: CashFlowLine[]) => r2(lines.reduce((s, l) => s + l.change, 0));
  const operating: CashFlowSection = {
    label: "Operating activities",
    lines: [{ accountId: "", code: "", name: "Net income", change: netIncome }, ...sort(operatingLines)],
    total: 0
  };
  operating.total = r2(netIncome + sum(operatingLines));
  const investing: CashFlowSection = { label: "Investing activities", lines: sort(investingLines), total: sum(investingLines) };
  const financing: CashFlowSection = { label: "Financing activities", lines: sort(financingLines), total: sum(financingLines) };

  const netChangeInCash = r2(operating.total + investing.total + financing.total);
  const openingCash = r2(opening.filter((b) => isCash(b)).reduce((s, b) => s + b.balance, 0));
  const closingCash = r2(closing.filter((b) => isCash(b)).reduce((s, b) => s + b.balance, 0));

  return {
    from,
    to,
    operating,
    investing,
    financing,
    netChangeInCash,
    openingCash,
    closingCash,
    completenessCheck: r2(closingCash - openingCash - netChangeInCash)
  };
}

// ---------------------------------------------------------------------------
// Statement of changes in equity over [from, to].
// ---------------------------------------------------------------------------

export type ChangesInEquity = {
  from: string;
  to: string;
  openingEquity: number;
  netIncome: number;
  ownerContributions: number;
  ownerDraws: number;
  closingEquity: number;
  /** closingEquity - (openingEquity + NI + contributions - draws): 0 expected. */
  consistencyCheck: number;
};

export function buildChangesInEquity(opening: AccountBalance[], closing: AccountBalance[], from: string, to: string, netIncome: number): ChangesInEquity {
  const equityAt = (rows: AccountBalance[]) => {
    const accounts = rows.filter((b) => b.type === "equity");
    const pl = rows.filter((b) => b.type === "revenue" || b.type === "expense");
    return r2(-accounts.reduce((s, b) => s + b.balance, 0) - pl.reduce((s, b) => s + b.balance, 0));
  };
  const openingEquity = equityAt(opening);
  const closingEquity = equityAt(closing);

  const openingById = new Map(opening.map((b) => [b.accountId, b.balance]));
  const closingById = new Map(closing.map((b) => [b.accountId, b.balance]));
  const ids = new Set([...openingById.keys(), ...closingById.keys()]);
  let ownerContributions = 0;
  let ownerDraws = 0;
  for (const id of ids) {
    const meta = closing.find((b) => b.accountId === id) ?? opening.find((b) => b.accountId === id);
    if (!meta || meta.type !== "equity" || meta.code === RETAINED_EARNINGS_CODE) continue;
    const deltaCredit = r2(-((closingById.get(id) ?? 0) - (openingById.get(id) ?? 0)));
    if (deltaCredit > 0) ownerContributions = r2(ownerContributions + deltaCredit);
    if (deltaCredit < 0) ownerDraws = r2(ownerDraws - deltaCredit);
  }

  return {
    from,
    to,
    openingEquity,
    netIncome,
    ownerContributions,
    ownerDraws,
    closingEquity,
    consistencyCheck: r2(closingEquity - (openingEquity + netIncome + ownerContributions - ownerDraws))
  };
}

// ---------------------------------------------------------------------------
// AR/AP aging buckets.
// ---------------------------------------------------------------------------

export type AgingItem = { id: string; number: string; name: string; dueDate: string; balance: number };
export type AgingBuckets = { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number };
export type AgingRow = AgingItem & { daysOverdue: number };
export type AgingReport = { asOf: string; rows: AgingRow[]; buckets: AgingBuckets; total: number };

export function buildAging(items: AgingItem[], asOf: string): AgingReport {
  const asOfMs = Date.parse(`${asOf}T00:00:00.000Z`);
  const buckets: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
  const rows: AgingRow[] = [];
  for (const item of items) {
    if (Math.abs(item.balance) < 0.005) continue;
    const days = Math.floor((asOfMs - Date.parse(`${item.dueDate}T00:00:00.000Z`)) / 86_400_000);
    const balance = r2(item.balance);
    rows.push({ ...item, balance, daysOverdue: Math.max(0, days) });
    if (days <= 0) buckets.current = r2(buckets.current + balance);
    else if (days <= 30) buckets.days1to30 = r2(buckets.days1to30 + balance);
    else if (days <= 60) buckets.days31to60 = r2(buckets.days31to60 + balance);
    else if (days <= 90) buckets.days61to90 = r2(buckets.days61to90 + balance);
    else buckets.over90 = r2(buckets.over90 + balance);
  }
  rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
  const total = r2(rows.reduce((s, r) => s + r.balance, 0));
  return { asOf, rows, buckets, total };
}

// ---------------------------------------------------------------------------
// Snapshot integrity.
// ---------------------------------------------------------------------------

/** Stable stringify: object keys sorted recursively so the hash is canonical. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function statementHash(payload: unknown): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

// ---------------------------------------------------------------------------
// CSV export of a locked snapshot payload (statement-shaped rows).
// ---------------------------------------------------------------------------

export function statementToCsv(title: string, lines: Array<{ label: string; amount: number | string; depth?: number }>): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [[title], ["Line", "Amount"]];
  for (const l of lines) {
    const label = `${"  ".repeat(l.depth ?? 0)}${l.label}`;
    rows.push([label, typeof l.amount === "number" ? l.amount.toFixed(2) : l.amount]);
  }
  return rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\r\n") + "\r\n";
}
