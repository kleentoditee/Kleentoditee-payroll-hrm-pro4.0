import { prisma, TransactionStatus } from "@kleentoditee/db";

export type LineInput = {
  position?: number;
  productId?: string | null;
  description?: string;
  quantity: number;
  unitPrice?: number;
  unitCost?: number;
  incomeAccountId?: string;
  expenseAccountId?: string;
  taxable?: boolean;
  taxAmount?: number;
};

export type ComputedLine = {
  position: number;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  incomeAccountId: string;
  taxable: boolean;
  taxAmount: number;
  amount: number;
};

export type ComputedBillLine = {
  position: number;
  productId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  expenseAccountId: string;
  taxable: boolean;
  taxAmount: number;
  amount: number;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeInvoiceLine(line: LineInput, index: number): ComputedLine {
  const quantity = Number(line.quantity ?? 0);
  const unitPrice = Number(line.unitPrice ?? 0);
  const taxAmount = round2(Number(line.taxAmount ?? 0));
  const amount = round2(quantity * unitPrice);
  if (!line.incomeAccountId) {
    throw new Error(`Line ${index + 1}: incomeAccountId is required.`);
  }
  return {
    position: line.position ?? index + 1,
    productId: line.productId ?? null,
    description: String(line.description ?? ""),
    quantity,
    unitPrice,
    incomeAccountId: line.incomeAccountId,
    taxable: Boolean(line.taxable ?? false),
    taxAmount,
    amount
  };
}

export function computeBillLine(line: LineInput, index: number): ComputedBillLine {
  const quantity = Number(line.quantity ?? 0);
  const unitCost = Number(line.unitCost ?? line.unitPrice ?? 0);
  const taxAmount = round2(Number(line.taxAmount ?? 0));
  const amount = round2(quantity * unitCost);
  if (!line.expenseAccountId) {
    throw new Error(`Line ${index + 1}: expenseAccountId is required.`);
  }
  return {
    position: line.position ?? index + 1,
    productId: line.productId ?? null,
    description: String(line.description ?? ""),
    quantity,
    unitCost,
    expenseAccountId: line.expenseAccountId,
    taxable: Boolean(line.taxable ?? false),
    taxAmount,
    amount
  };
}

export function rollupTotals(
  lines: Array<{ amount: number; taxAmount: number }>,
  amountPaid = 0
): { subtotal: number; taxTotal: number; total: number; balance: number } {
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const taxTotal = round2(lines.reduce((s, l) => s + l.taxAmount, 0));
  const total = round2(subtotal + taxTotal);
  const balance = round2(total - amountPaid);
  return { subtotal, taxTotal, total, balance };
}

export function deriveStatus(
  currentStatus: TransactionStatus,
  total: number,
  amountPaid: number
): TransactionStatus {
  if (currentStatus === TransactionStatus.draft || currentStatus === TransactionStatus.void) {
    return currentStatus;
  }
  if (amountPaid <= 0) {
    return TransactionStatus.open;
  }
  if (amountPaid + 0.005 < total) {
    return TransactionStatus.partial;
  }
  return TransactionStatus.paid;
}

async function nextNumber(prefix: string, latestNumber: string | null): Promise<string> {
  const seq = latestNumber ? Number(latestNumber.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await prisma.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true }
  });
  return nextNumber(prefix, latest?.number ?? null);
}

export async function nextBillNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BILL-${year}-`;
  const latest = await prisma.bill.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true }
  });
  return nextNumber(prefix, latest?.number ?? null);
}
