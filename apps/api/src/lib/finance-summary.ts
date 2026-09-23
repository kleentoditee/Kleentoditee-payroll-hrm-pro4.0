/**
 * Server-side per-customer / per-supplier balance aggregates so list UIs no
 * longer need to download every invoice/bill/payment to compute summaries.
 *
 * All queries run through the org-scoped prisma proxy, so tenant isolation
 * matches the surrounding route handlers automatically.
 *
 * Semantics: "open" means operational documents with status open or partial
 * (drafts are not yet owed; paid documents have zero balance; void documents
 * are excluded).
 */

import { TransactionStatus, prisma } from "@kleentoditee/db";
import { round2 } from "./finance-transactions.js";

const OPEN_STATUSES = [TransactionStatus.open, TransactionStatus.partial] as const;

export interface CustomerSummary {
  /** Sum of open/partial invoice balances. */
  openBalance: number;
  /** Count of open/partial invoices behind that balance. */
  invoiceCount: number;
}

export interface SupplierSummary {
  /** Sum of open/partial bill balances. */
  openBalance: number;
  /** Count of open/partial bills behind that balance. */
  billCount: number;
}

export const ZERO_CUSTOMER_SUMMARY: CustomerSummary = { openBalance: 0, invoiceCount: 0 };
export const ZERO_SUPPLIER_SUMMARY: SupplierSummary = { openBalance: 0, billCount: 0 };

export async function customerSummaries(customerIds: string[]): Promise<Map<string, CustomerSummary>> {
  const map = new Map<string, CustomerSummary>();
  if (customerIds.length === 0) return map;
  const rows = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds }, status: { in: [...OPEN_STATUSES] } },
    _sum: { balance: true },
    _count: { _all: true }
  });
  for (const row of rows) {
    map.set(row.customerId, {
      openBalance: round2(Number(row._sum.balance ?? 0)),
      invoiceCount: row._count._all
    });
  }
  return map;
}

export async function supplierSummaries(supplierIds: string[]): Promise<Map<string, SupplierSummary>> {
  const map = new Map<string, SupplierSummary>();
  if (supplierIds.length === 0) return map;
  const rows = await prisma.bill.groupBy({
    by: ["supplierId"],
    where: { supplierId: { in: supplierIds }, status: { in: [...OPEN_STATUSES] } },
    _sum: { balance: true },
    _count: { _all: true }
  });
  for (const row of rows) {
    map.set(row.supplierId, {
      openBalance: round2(Number(row._sum.balance ?? 0)),
      billCount: row._count._all
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Org-wide overview summaries for the Customers / Suppliers page tiles.
// Overdue semantics match /finance/reports/summary receivables/payables:
// open/partial documents with balance > 0 and dueDate before today.
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 86_400_000;

export interface CustomerOverviewSummary {
  /** Sum of balance over all open/partial invoices. */
  totalOpenBalance: number;
  /** Count of open/partial invoices. */
  openInvoiceCount: number;
  /** Open/partial invoices with balance > 0 and dueDate in the past. */
  overdueCount: number;
  overdueBalance: number;
  /** Sum of payment amounts received in the last 30 days. */
  recentlyPaidTotal: number;
}

export interface SupplierOverviewSummary {
  /** Sum of balance over all open/partial bills. */
  totalOpenBalance: number;
  /** Count of open/partial bills. */
  openBillCount: number;
  /** Open/partial bills with balance > 0 and dueDate in the past. */
  overdueCount: number;
  overdueBalance: number;
  /** Sum of bill-payment amounts sent in the last 30 days. */
  recentlyPaidTotal: number;
}

interface RawAggregate {
  balance: number | null;
  count: number;
}

/** Pure mapping + rounding; unit-tested without a database. */
export function toCustomerOverviewSummary(raw: {
  open: RawAggregate;
  overdue: RawAggregate;
  recentlyPaid: number | null;
}): CustomerOverviewSummary {
  return {
    totalOpenBalance: round2(Number(raw.open.balance ?? 0)),
    openInvoiceCount: raw.open.count,
    overdueCount: raw.overdue.count,
    overdueBalance: round2(Number(raw.overdue.balance ?? 0)),
    recentlyPaidTotal: round2(Number(raw.recentlyPaid ?? 0))
  };
}

/** Pure mapping + rounding; unit-tested without a database. */
export function toSupplierOverviewSummary(raw: {
  open: RawAggregate;
  overdue: RawAggregate;
  recentlyPaid: number | null;
}): SupplierOverviewSummary {
  return {
    totalOpenBalance: round2(Number(raw.open.balance ?? 0)),
    openBillCount: raw.open.count,
    overdueCount: raw.overdue.count,
    overdueBalance: round2(Number(raw.overdue.balance ?? 0)),
    recentlyPaidTotal: round2(Number(raw.recentlyPaid ?? 0))
  };
}

export async function customerOverviewSummary(now = new Date()): Promise<CustomerOverviewSummary> {
  const [open, overdue, paid] = await Promise.all([
    prisma.invoice.aggregate({
      where: { status: { in: [...OPEN_STATUSES] } },
      _sum: { balance: true },
      _count: { _all: true }
    }),
    prisma.invoice.aggregate({
      where: { status: { in: [...OPEN_STATUSES] }, balance: { gt: 0 }, dueDate: { lt: now } },
      _sum: { balance: true },
      _count: { _all: true }
    }),
    prisma.payment.aggregate({
      where: { paymentDate: { gte: new Date(now.getTime() - THIRTY_DAYS_MS) } },
      _sum: { amount: true }
    })
  ]);
  return toCustomerOverviewSummary({
    open: { balance: open._sum.balance, count: open._count._all },
    overdue: { balance: overdue._sum.balance, count: overdue._count._all },
    recentlyPaid: paid._sum.amount
  });
}

export async function supplierOverviewSummary(now = new Date()): Promise<SupplierOverviewSummary> {
  const [open, overdue, paid] = await Promise.all([
    prisma.bill.aggregate({
      where: { status: { in: [...OPEN_STATUSES] } },
      _sum: { balance: true },
      _count: { _all: true }
    }),
    prisma.bill.aggregate({
      where: { status: { in: [...OPEN_STATUSES] }, balance: { gt: 0 }, dueDate: { lt: now } },
      _sum: { balance: true },
      _count: { _all: true }
    }),
    prisma.billPayment.aggregate({
      where: { paymentDate: { gte: new Date(now.getTime() - THIRTY_DAYS_MS) } },
      _sum: { amount: true }
    })
  ]);
  return toSupplierOverviewSummary({
    open: { balance: open._sum.balance, count: open._count._all },
    overdue: { balance: overdue._sum.balance, count: overdue._count._all },
    recentlyPaid: paid._sum.amount
  });
}
