/**
 * GL reporting (Batch 8, R7): trial balance + account ledger + journal listing.
 * Posted journal lines are the single source of truth; aggregation is pure.
 */
import { prisma } from "@kleentoditee/db";
import type { Prisma } from "@kleentoditee/db";
import { round2 } from "./gl-posting.js";

export type AccountRef = { id: string; code: string; name: string; type: string; subtype: string; active: boolean };
export type LineAmount = { accountId: string; debit: number; credit: number };

const DEBIT_NORMAL = new Set(["asset", "expense"]);

export function normalBalanceSign(accountType: string): 1 | -1 {
  return DEBIT_NORMAL.has(accountType) ? 1 : -1;
}

export type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  totalDebit: number;
  totalCredit: number;
  /** Signed in the account's normal direction (positive = normal balance). */
  balance: number;
};

export type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
};

/** Pure aggregation: posted lines + account list -> trial balance. */
export function aggregateTrialBalance(lines: LineAmount[], accounts: AccountRef[]): TrialBalance {
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const cur = byAccount.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit);
    cur.credit += Number(l.credit);
    byAccount.set(l.accountId, cur);
  }
  const rows: TrialBalanceRow[] = accounts
    .filter((a) => byAccount.has(a.id))
    .map((a) => {
      const sums = byAccount.get(a.id)!;
      const totalDebit = round2(sums.debit);
      const totalCredit = round2(sums.credit);
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        totalDebit,
        totalCredit,
        balance: round2((totalDebit - totalCredit) * normalBalanceSign(a.type))
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  const totalDebit = round2(rows.reduce((s, r) => s + r.totalDebit, 0));
  const totalCredit = round2(rows.reduce((s, r) => s + r.totalCredit, 0));
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
}

export type LedgerRow = {
  entryId: string;
  date: string;
  memo: string;
  sourceType: string;
  sourceId: string;
  lineMemo: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

/** Pure: chronological ledger lines -> rows with running normal-direction balance. */
export function buildLedgerRows(
  lines: Array<{ entryId: string; date: Date; memo: string; sourceType: string; sourceId: string; lineMemo: string; debit: number; credit: number }>,
  accountType: string,
  openingBalance = 0
): LedgerRow[] {
  const sign = normalBalanceSign(accountType);
  let running = round2(openingBalance);
  return lines.map((l) => {
    running = round2(running + (Number(l.debit) - Number(l.credit)) * sign);
    return {
      entryId: l.entryId,
      date: l.date.toISOString(),
      memo: l.memo,
      sourceType: l.sourceType,
      sourceId: l.sourceId,
      lineMemo: l.lineMemo,
      debit: round2(Number(l.debit)),
      credit: round2(Number(l.credit)),
      runningBalance: running
    };
  });
}

// ---------------------------------------------------------------------------
// DB loaders
// ---------------------------------------------------------------------------

// Reports count posted + void entries: a voided entry is always paired with a
// posted reversal entry, so including both nets to zero and keeps the full
// audit trail visible. Draft/approved manual journals are excluded.
const COUNTED = { in: ["posted" as const, "void" as const] };

export async function loadTrialBalance(asOf?: Date): Promise<TrialBalance & { asOf: string }> {
  const [lines, accounts] = await Promise.all([
    prisma.journalLine.findMany({
      where: { entry: { status: COUNTED, ...(asOf ? { date: { lte: asOf } } : {}) } },
      select: { accountId: true, debit: true, credit: true }
    }),
    prisma.account.findMany({ orderBy: { code: "asc" } })
  ]);
  const tb = aggregateTrialBalance(
    lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit), credit: Number(l.credit) })),
    accounts.map((a) => ({ id: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, active: a.active }))
  );
  return { ...tb, asOf: (asOf ?? new Date()).toISOString() };
}

export async function loadAccountLedger(accountId: string, from?: Date, to?: Date) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return null;

  // Opening balance = everything posted before `from`.
  let opening = 0;
  if (from) {
    const prior = await prisma.journalLine.findMany({
      where: { accountId, entry: { status: COUNTED, date: { lt: from } } },
      select: { debit: true, credit: true }
    });
    opening = round2(
      prior.reduce((s, l) => s + (Number(l.debit) - Number(l.credit)) * normalBalanceSign(account.type), 0)
    );
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      entry: { status: COUNTED, date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
    },
    orderBy: [{ entry: { date: "asc" } }, { position: "asc" }],
    select: {
      debit: true,
      credit: true,
      memo: true,
      position: true,
      entry: { select: { id: true, date: true, memo: true, sourceType: true, sourceId: true } }
    }
  });
  const rows = buildLedgerRows(
    lines.map((l) => ({
      entryId: l.entry.id,
      date: l.entry.date,
      memo: l.entry.memo,
      sourceType: l.entry.sourceType,
      sourceId: l.entry.sourceId,
      lineMemo: l.memo,
      debit: Number(l.debit),
      credit: Number(l.credit)
    })),
    account.type,
    opening
  );
  return {
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    openingBalance: opening,
    closingBalance: rows.length > 0 ? rows[rows.length - 1].runningBalance : opening,
    rows
  };
}

export async function listJournalEntries(opts: { from?: Date; to?: Date; sourceType?: string; limit?: number }) {
  const entries = await prisma.journalEntry.findMany({
    where: {
      ...(opts.from || opts.to ? { date: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } } : {}),
      ...(opts.sourceType ? { sourceType: opts.sourceType } : {})
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: opts.limit ?? 200,
    include: { lines: { orderBy: { position: "asc" }, include: { account: { select: { code: true, name: true } } } } }
  });
  return entries.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    memo: e.memo,
    sourceType: e.sourceType,
    sourceId: e.sourceId,
    status: e.status,
    reversalOfId: e.reversalOfId,
    totalDebit: round2(e.lines.reduce((s, l) => s + Number(l.debit), 0)),
    lines: e.lines.map((l) => ({
      accountCode: l.account.code,
      accountName: l.account.name,
      debit: Number(l.debit),
      credit: Number(l.credit),
      memo: l.memo
    }))
  }));
}

/**
 * Per-account signed balances (debit-positive) over an optional date window,
 * counting posted + void entries (Batch 15 statement engine input).
 */
export async function loadAccountBalances(
  from?: Date,
  to?: Date,
  opts?: { excludeSourceTypes?: string[]; client?: Prisma.TransactionClient }
) {
  const client = opts?.client ?? prisma;
  const [lines, accounts] = await Promise.all([
    client.journalLine.findMany({
      where: {
        entry: {
          status: COUNTED,
          ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
          ...(opts?.excludeSourceTypes?.length ? { sourceType: { notIn: opts.excludeSourceTypes } } : {})
        }
      },
      select: { accountId: true, debit: true, credit: true }
    }),
    client.account.findMany({ select: { id: true, code: true, name: true, type: true, subtype: true } })
  ]);
  const byAccount = new Map<string, number>();
  for (const l of lines) {
    byAccount.set(l.accountId, round2((byAccount.get(l.accountId) ?? 0) + Number(l.debit) - Number(l.credit)));
  }
  return accounts.map((a) => ({
    accountId: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    subtype: a.subtype,
    balance: round2(byAccount.get(a.id) ?? 0)
  }));
}
