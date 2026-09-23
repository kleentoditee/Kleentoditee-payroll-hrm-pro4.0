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
