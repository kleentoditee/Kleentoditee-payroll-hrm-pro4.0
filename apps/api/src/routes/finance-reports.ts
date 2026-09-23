import { Role, TransactionStatus, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { countJournalEntries, listJournalEntries, loadAccountLedger, loadTrialBalance } from "../lib/gl-reports.js";
import { paginationMeta, parseListQuery } from "../lib/pagination.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

function dateParam(value: string | undefined, fallback: Date, endOfDay = false): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export const financeReportsRoutes = new Hono<{ Variables: AuthVariables }>().get(
  "/reports/summary",
  authRequired,
  requireRole(...CAN_VIEW),
  async (c) => {
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const from = dateParam(c.req.query("from"), defaultFrom);
    const to = dateParam(c.req.query("to"), now, true);
    if (from > to) {
      return c.json({ error: "The start date must be before the end date." }, 400);
    }

    const postedStatuses = [TransactionStatus.open, TransactionStatus.partial, TransactionStatus.paid];
    const [invoices, bills, expenses, payments, openInvoices, openBills, customerCount, supplierCount] =
      await Promise.all([
        prisma.invoice.findMany({
          where: { issueDate: { gte: from, lte: to }, status: { in: postedStatuses } },
          include: { customer: { select: { id: true, displayName: true } }, lines: true },
          orderBy: { issueDate: "asc" }
        }),
        prisma.bill.findMany({
          where: { billDate: { gte: from, lte: to }, status: { in: postedStatuses } },
          include: { supplier: { select: { id: true, displayName: true } }, lines: true },
          orderBy: { billDate: "asc" }
        }),
        prisma.expense.findMany({
          where: { expenseDate: { gte: from, lte: to }, status: { notIn: [TransactionStatus.draft, TransactionStatus.void] } },
          include: { lines: true },
          orderBy: { expenseDate: "asc" }
        }),
        prisma.payment.findMany({ where: { paymentDate: { gte: from, lte: to } } }),
        prisma.invoice.findMany({
          where: { status: { in: [TransactionStatus.open, TransactionStatus.partial] }, balance: { gt: 0 } },
          include: { customer: { select: { displayName: true } } },
          orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }]
        }),
        prisma.bill.findMany({
          where: { status: { in: [TransactionStatus.open, TransactionStatus.partial] }, balance: { gt: 0 } },
          include: { supplier: { select: { displayName: true } } },
          orderBy: [{ dueDate: "asc" }, { billDate: "asc" }]
        }),
        prisma.customer.count({ where: { active: true } }),
        prisma.supplier.count({ where: { active: true } })
      ]);

    const invoiceRevenue = invoices.reduce(
      (sum, invoice) => sum + invoice.lines.reduce((lineSum, line) => lineSum + line.amount, 0),
      0
    );
    const billExpense = bills.reduce(
      (sum, bill) => sum + bill.lines.reduce((lineSum, line) => lineSum + line.amount, 0),
      0
    );
    const directExpense = expenses.reduce(
      (sum, expense) => sum + expense.lines.reduce((lineSum, line) => lineSum + line.amount, 0),
      0
    );
    const cashReceived = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const accountsReceivable = openInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
    const accountsPayable = openBills.reduce((sum, bill) => sum + bill.balance, 0);

    const months = new Map<string, { month: string; revenue: number; expenses: number }>();
    const ensureMonth = (key: string) => {
      const current = months.get(key) ?? { month: key, revenue: 0, expenses: 0 };
      months.set(key, current);
      return current;
    };
    for (const invoice of invoices) {
      ensureMonth(monthKey(invoice.issueDate)).revenue += invoice.lines.reduce((sum, line) => sum + line.amount, 0);
    }
    for (const bill of bills) {
      ensureMonth(monthKey(bill.billDate)).expenses += bill.lines.reduce((sum, line) => sum + line.amount, 0);
    }
    for (const expense of expenses) {
      ensureMonth(monthKey(expense.expenseDate)).expenses += expense.lines.reduce((sum, line) => sum + line.amount, 0);
    }

    const customerTotals = new Map<string, { id: string; name: string; total: number }>();
    for (const invoice of invoices) {
      const current = customerTotals.get(invoice.customerId) ?? {
        id: invoice.customerId,
        name: invoice.customer.displayName,
        total: 0
      };
      current.total += invoice.total;
      customerTotals.set(invoice.customerId, current);
    }

    return c.json({
      range: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        revenue: money(invoiceRevenue),
        expenses: money(billExpense + directExpense),
        netIncome: money(invoiceRevenue - billExpense - directExpense),
        cashReceived: money(cashReceived),
        accountsReceivable: money(accountsReceivable),
        accountsPayable: money(accountsPayable),
        activeCustomers: customerCount,
        activeSuppliers: supplierCount
      },
      monthly: Array.from(months.values())
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((item) => ({ ...item, revenue: money(item.revenue), expenses: money(item.expenses), net: money(item.revenue - item.expenses) })),
      topCustomers: Array.from(customerTotals.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 10)
        .map((item) => ({ ...item, total: money(item.total) })),
      receivables: openInvoices.slice(0, 25).map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        name: invoice.customer.displayName,
        dueDate: invoice.dueDate,
        balance: money(invoice.balance),
        overdue: Boolean(invoice.dueDate && invoice.dueDate < now)
      })),
      payables: openBills.slice(0, 25).map((bill) => ({
        id: bill.id,
        number: bill.number,
        name: bill.supplier.displayName,
        dueDate: bill.dueDate,
        balance: money(bill.balance),
        overdue: Boolean(bill.dueDate && bill.dueDate < now)
      }))
    });
  }
)
  .get("/reports/trial-balance", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const asOfParam = c.req.query("asOf");
    const asOf = asOfParam ? dateParam(asOfParam, new Date(), true) : undefined;
    const trialBalance = await loadTrialBalance(asOf);
    return c.json({ trialBalance });
  })
  .get("/reports/journal", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const fromParam = c.req.query("from");
    const toParam = c.req.query("to");
    const from = fromParam ? dateParam(fromParam, new Date()) : undefined;
    const to = toParam ? dateParam(toParam, new Date(), true) : undefined;
    if (from && to && from > to) {
      return c.json({ error: "The start date must be before the end date." }, 400);
    }
    const list = parseListQuery((k) => c.req.query(k), {
      sortable: ["date", "memo", "sourceType", "status", "createdAt"],
      defaultSort: [{ date: "desc" }, { createdAt: "desc" }]
    });
    if (!list.ok) {
      return c.json({ error: list.error }, 400);
    }
    const filter = { from, to, sourceType: c.req.query("sourceType") || undefined, q: list.q || undefined };
    if (!list.paginated) {
      const entries = await listJournalEntries({ ...filter, orderBy: list.orderBy });
      return c.json({ entries });
    }
    const [total, entries] = await Promise.all([
      countJournalEntries(filter),
      listJournalEntries({ ...filter, skip: list.skip, limit: list.take, orderBy: list.orderBy })
    ]);
    // Keep `entries` (this endpoint's existing field name) and add metadata.
    return c.json({ entries, pagination: paginationMeta(list.page, list.pageSize, total) });
  })
  .get("/reports/control-reconciliation", authRequired, requireRole(...CAN_VIEW), async (c) => {
    // GL control account balances (posted + void-with-reversal journals; drafts excluded) vs operational subledgers.
    const controlCodes = ["1100", "2000", "2100", "2200", "2300", "2500"];
    const accounts = await prisma.account.findMany({
      where: { code: { in: controlCodes } },
      select: { id: true, code: true, name: true, type: true }
    });
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    const glLines = await prisma.journalLine.findMany({
      where: { entry: { status: { in: ["posted", "void"] } }, accountId: { in: accounts.map((a) => a.id) } },
      select: { accountId: true, debit: true, credit: true }
    });
    const glBalance = new Map<string, number>();
    for (const l of glLines) {
      const acc = accounts.find((a) => a.id === l.accountId)!;
      const sign = acc.type === "asset" || acc.type === "expense" ? 1 : -1;
      glBalance.set(acc.code, money((glBalance.get(acc.code) ?? 0) + (Number(l.debit) - Number(l.credit)) * sign));
    }

    // Subledgers.
    const openInvoices = await prisma.invoice.findMany({
      where: { status: { in: ["open", "partial"] } },
      select: { balance: true }
    });
    const unappliedPayments = await prisma.payment.findMany({
      where: { unapplied: { gt: 0 } },
      select: { unapplied: true }
    });
    const arSub = money(openInvoices.reduce((s, i) => s + i.balance, 0) - unappliedPayments.reduce((s, p) => s + p.unapplied, 0));

    const openBills = await prisma.bill.findMany({
      where: { status: { in: ["open", "partial"] } },
      select: { balance: true }
    });
    const unappliedBillPayments = await prisma.billPayment.findMany({
      where: { unapplied: { gt: 0 } },
      select: { unapplied: true }
    });
    const apSub = money(openBills.reduce((s, b) => s + b.balance, 0) - unappliedBillPayments.reduce((s, p) => s + p.unapplied, 0));

    // Payroll subledger: finalized/exported/paid runs not yet statutory-remitted
    // carry open NHI/SSB/payroll-tax liabilities; not-yet-paid runs carry net wages.
    const openRuns = await prisma.payRun.findMany({
      where: { status: { in: ["finalized", "exported", "paid"] } },
      select: {
        status: true,
        statutoryRemittedAt: true,
        items: {
          select: {
            net: true, nhi: true, employerNhi: true, ssb: true, employerSsb: true,
            payrollTax: true, employerPayrollTax: true
          }
        }
      }
    });
    let nhiSub = 0, ssbSub = 0, ptaxSub = 0, netSub = 0;
    for (const run of openRuns) {
      for (const item of run.items) {
        if (!run.statutoryRemittedAt) {
          nhiSub += item.nhi + item.employerNhi;
          ssbSub += item.ssb + item.employerSsb;
          ptaxSub += item.payrollTax + item.employerPayrollTax;
        }
        if (run.status !== "paid") netSub += item.net;
      }
    }

    const rows = [
      { code: "1100", name: "Accounts Receivable", subledger: arSub },
      { code: "2000", name: "Accounts Payable", subledger: apSub },
      { code: "2100", name: "NHI Payable", subledger: money(nhiSub) },
      { code: "2200", name: "SSB Payable", subledger: money(ssbSub) },
      { code: "2300", name: "Payroll Tax Payable", subledger: money(ptaxSub) },
      { code: "2500", name: "Net Wages Payable", subledger: money(netSub) }
    ].map((r) => {
      const gl = money(glBalance.get(r.code) ?? 0);
      const difference = money(gl - r.subledger);
      return {
        code: r.code,
        name: byCode.get(r.code)?.name ?? r.name,
        accountPresent: byCode.has(r.code),
        glBalance: gl,
        subledgerBalance: r.subledger,
        difference,
        status: Math.abs(difference) < 0.005 ? "ok" : "mismatch"
      };
    });
    return c.json({ rows, allOk: rows.every((r) => r.status === "ok") });
  })
  .get("/reports/ledger/:accountId", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const fromParam = c.req.query("from");
    const toParam = c.req.query("to");
    const from = fromParam ? dateParam(fromParam, new Date()) : undefined;
    const to = toParam ? dateParam(toParam, new Date(), true) : undefined;
    const ledger = await loadAccountLedger(c.req.param("accountId"), from, to);
    if (!ledger) {
      return c.json({ error: "Account not found." }, 404);
    }
    return c.json({ ledger });
  });
