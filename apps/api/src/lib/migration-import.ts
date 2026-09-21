/**
 * Migration-safe accounting import (Batch 17).
 *
 * Replaces the legacy quickbooks-import commit path for full migrations:
 *  - every upload is hashed, stored in private document storage, and
 *    inventoried into AccountingImportBatch/File/Row before anything commits;
 *  - validation is strict: unknown referenced entities are INVALID, never
 *    silently find-or-created;
 *  - commit is ONE database transaction: destination documents, GL journals
 *    (via the Batch 8 posting engine), payment applications, opening-balance
 *    journals, lineage (ExternalSourceRef) and row outcomes all land or none
 *    do — a failed import leaves zero partial data;
 *  - idempotent: ExternalSourceRef makes a repeated import skip every row it
 *    already committed, and postJournal is idempotent by sourceKey;
 *  - reversible: reversal posts counter-journals and removes the imported
 *    documents, guarded against cross-batch references;
 *  - opening balances become real opening AR/AP documents and an Opening
 *    Balance Equity journal — never notes on a record.
 */
import crypto from "node:crypto";
import {
  AccountType,
  PaymentMethod,
  ProductKind,
  TransactionStatus,
  prisma,
  requireOrgId,
  type Prisma
} from "@kleentoditee/db";
import {
  cleanRowsForImport,
  normalizeCurrency,
  normalizeDate,
  normalizeMappings,
  parseCsv,
  parseExcel,
  suggestMappings,
  validateMappedRows,
  QUICKBOOKS_IMPORT_TYPES,
  type CsvRow,
  type QuickBooksImportType
} from "./quickbooks-accounting-import.js";
import {
  buildBillReceivedJournal,
  buildDepositPostedJournal,
  buildExpensePostedJournal,
  buildInvoiceIssuedJournal,
  buildOpeningBalanceJournal,
  buildPaymentReceivedJournal,
  ensureControlAccounts,
  postJournal,
  reverseJournal,
  round2
} from "./gl-posting.js";
import { deriveStatus } from "./finance-transactions.js";
import { documentStorage } from "./document-storage.js";

export const MIGRATION_IMPORT_TYPES = [...QUICKBOOKS_IMPORT_TYPES, "opening_balances"] as const;
export type MigrationImportType = (typeof MIGRATION_IMPORT_TYPES)[number];

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Commit order matters: master data before documents that reference it. */
const TYPE_ORDER: MigrationImportType[] = [
  "accounts",
  "products",
  "customers",
  "vendors",
  "invoices",
  "bills",
  "expenses",
  "payments",
  "deposits",
  "opening_balances"
];

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export type SniffResult = { kind: "csv" | "xlsx"; warnings: string[] };

/**
 * Content-sniff an upload by magic bytes (never trust the extension):
 *  - XLSX is a ZIP (PK\x03\x04); macro-enabled payloads (vbaProject.bin) are
 *    rejected outright;
 *  - everything else must parse as text CSV;
 *  - .xlsm / .xlsb / executables are refused by extension and by content.
 */
export function sniffUpload(fileName: string, buffer: Buffer): SniffResult {
  const lower = fileName.toLowerCase();
  if (!buffer.length) throw new Error("Upload is empty.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("File exceeds the 50 MB migration upload limit.");
  if (/\.(xlsm|xlsb|exe|bat|cmd|ps1|js|msi|dll)$/.test(lower)) {
    throw new Error(`File type not accepted for migration: ${fileName}`);
  }
  const isZip = buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  if (isZip) {
    if (buffer.includes(Buffer.from("vbaProject.bin"))) {
      throw new Error("Macro-enabled workbook (vbaProject.bin) is not accepted. Save as .xlsx without macros.");
    }
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".zip")) {
      throw new Error("ZIP/XLSX content must use a .xlsx (or .zip) file name.");
    }
    return { kind: "xlsx", warnings: [] };
  }
  if (lower.endsWith(".xlsx")) {
    throw new Error("File is named .xlsx but the content is not a valid Excel workbook.");
  }
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new Error("File is not valid UTF-8 text. Export as CSV (UTF-8) or .xlsx.");
  }
  return { kind: "csv", warnings: [] };
}

const normKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

/**
 * Stable idempotency key for a mapped row. When the source system provides a
 * real id we use it; otherwise we derive a content key that is stable across
 * re-imports of the same export.
 */
export function deriveSourceRef(sourceSystem: string, importType: MigrationImportType, row: CsvRow): string {
  const explicit = row.sourceId || row.id || row.qbId || "";
  const prefix = `${sourceSystem}:${importType}`;
  if (explicit.trim()) return `${prefix}:${explicit.trim()}`;
  switch (importType) {
    case "customers":
      return `${prefix}:${normKey(row.displayName)}`;
    case "vendors":
      return `${prefix}:${normKey(row.displayName)}`;
    case "accounts":
      return `${prefix}:${normKey(row.name)}:${normKey(row.type)}`;
    case "products":
      return `${prefix}:${normKey(row.sku || row.name)}`;
    case "invoices":
      return `${prefix}:${normKey(row.number)}`;
    case "bills":
      return `${prefix}:${normKey(row.number || `${row.supplierName}|${row.billDate}|${row.total}`)}`;
    case "expenses":
      return `${prefix}:${normKey(row.payeeName)}:${normKey(row.expenseDate)}:${normKey(row.amount)}:${normKey(row.reference)}`;
    case "payments":
      return `${prefix}:${normKey(row.customerName)}:${normKey(row.paymentDate)}:${normKey(row.amount)}:${normKey(row.reference)}`;
    case "deposits":
      return `${prefix}:${normKey(row.accountName)}:${normKey(row.depositDate)}:${normKey(row.amount)}`;
    case "opening_balances":
      return `${prefix}:${normKey(row.accountName)}`;
  }
}

/** Group mapped invoice rows by invoice number (multi-line preservation). */
export function groupInvoiceRows(rows: CsvRow[]): Array<{ number: string; rows: CsvRow[] }> {
  const byNumber = new Map<string, CsvRow[]>();
  for (const row of rows) {
    const number = String(row.number ?? "").trim();
    const list = byNumber.get(number) ?? [];
    list.push(row);
    byNumber.set(number, list);
  }
  return [...byNumber.entries()].map(([number, groupRows]) => ({ number, rows: groupRows }));
}

/**
 * Lines for one invoice group. When a `lineAmount` column is mapped, every
 * row is a line and the invoice total is the line sum; otherwise the group
 * collapses to one summary line at the first row's total (legacy behavior).
 */
export function invoiceLinesFromGroup(rows: CsvRow[]): {
  lines: Array<{ description: string; amount: number }>;
  total: number;
  usedLineAmounts: boolean;
} {
  const first = rows[0]!;
  const hasLineAmounts = rows.length > 1 && rows.some((r) => String(r.lineAmount ?? "").trim() !== "");
  if (!hasLineAmounts) {
    return {
      lines: [{ description: first.lineItemName || "Imported invoice", amount: normalizeCurrency(first.total) }],
      total: normalizeCurrency(first.total),
      usedLineAmounts: false
    };
  }
  const lines = rows.map((r, i) => ({
    description: r.lineItemName || `Line ${i + 1}`,
    amount: normalizeCurrency(r.lineAmount)
  }));
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, total, usedLineAmounts: true };
}

/**
 * Signed (debit-positive) opening balance for a GL account: asset/expense
 * accounts are debit-normal, liability/equity/revenue credit-normal.
 */
export function signedOpeningBalance(accountType: string, amount: number): number {
  const t = accountType.toLowerCase();
  const debitNormal = t === "asset" || t === "expense";
  return debitNormal ? round2(Math.abs(amount)) : round2(-Math.abs(amount));
}

const escapeCsv = (value: unknown) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Downloadable validation-error report (CSV). */
export function buildErrorReportCsv(
  rows: Array<{ fileName: string; rowIndex: number; errorMessage: string; payloadJson: unknown }>
): string {
  const header = "file,row,error,payload";
  const body = rows.map((r) =>
    [r.fileName, String(r.rowIndex), r.errorMessage, JSON.stringify(r.payloadJson ?? {})].map(escapeCsv).join(",")
  );
  return [header, ...body].join("\n") + "\n";
}

/** Canonical mapping template (CSV header row) for an import type. */
export function mappingTemplateCsv(importType: MigrationImportType): string {
  const fields: Record<MigrationImportType, string[]> = {
    customers: ["displayName", "companyName", "email", "phone", "billingAddress", "shippingAddress", "openingBalance"],
    vendors: ["displayName", "companyName", "email", "phone", "mailingAddress", "openingBalance"],
    accounts: ["name", "type", "subtype", "code", "openingBalance"],
    products: ["name", "sku", "kind", "description", "salesPrice", "incomeAccountName"],
    invoices: ["number", "customerName", "issueDate", "dueDate", "lineItemName", "lineAmount", "total", "balance", "status"],
    bills: ["number", "supplierName", "billDate", "dueDate", "total", "balance", "status"],
    expenses: ["expenseDate", "payeeName", "paymentAccountName", "categoryName", "amount", "memo"],
    payments: ["paymentDate", "customerName", "method", "reference", "amount", "invoiceNumber", "depositAccountName"],
    deposits: ["depositDate", "accountName", "receivedFrom", "memo", "amount", "offsetAccountName"],
    opening_balances: ["accountName", "balance"]
  };
  return fields[importType].join(",") + "\n";
}

// ---------------------------------------------------------------------------
// Batch lifecycle
// ---------------------------------------------------------------------------

async function getBatchOrThrow(batchId: string) {
  const batch = await prisma.accountingImportBatch.findFirst({ where: { id: batchId }, include: { files: true } });
  if (!batch) throw new Error("Import batch not found.");
  return batch;
}

export async function createMigrationBatch(input: { sourceSystem: string; label?: string; asOfDate?: Date }, actorUserId?: string) {
  const orgId = requireOrgId();
  return prisma.accountingImportBatch.create({
    data: {
      orgId,
      sourceSystem: input.sourceSystem.trim() || "excel_generic",
      label: input.label?.trim() ?? "",
      mappingJson: input.asOfDate ? ({ asOfDate: input.asOfDate.toISOString().slice(0, 10) } as Prisma.InputJsonValue) : undefined,
      createdByUserId: actorUserId ?? null
    }
  });
}

const OPENING_BALANCE_ALIASES: Record<string, string[]> = {
  accountName: ["Account", "Account Name", "Name"],
  balance: ["Balance", "Opening Balance", "Amount"]
};

function mapOpeningBalanceRows(headers: string[], rows: CsvRow[]): { mapped: CsvRow[]; mappings: Record<string, string> } {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const mappings: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(OPENING_BALANCE_ALIASES)) {
    const hit = headers.find((h) => aliases.map(norm).includes(norm(h)));
    if (hit) mappings[hit] = field;
  }
  const mapped = rows.map((row) => {
    const out: CsvRow = {};
    for (const [header, field] of Object.entries(mappings)) out[field] = String(row[header] ?? "").trim();
    return out;
  });
  return { mapped, mappings };
}

/** Parse + hash + store + inventory an uploaded file into batch rows. */
export async function inventoryFile(
  batchId: string,
  input: { fileName: string; importType: MigrationImportType; buffer: Buffer; mappings?: Record<string, string> },
  actorUserId?: string
) {
  const orgId = requireOrgId();
  const batch = await getBatchOrThrow(batchId);
  if (!["uploaded", "inventoried", "mapped", "rejected"].includes(batch.status)) {
    throw new Error(`Cannot add files while batch is ${batch.status}.`);
  }
  const sniff = sniffUpload(input.fileName, input.buffer);
  const parsed = sniff.kind === "xlsx" ? await parseExcel(input.buffer) : parseCsv(input.buffer.toString("utf8"));
  if (!parsed.rows.length) throw new Error("No data rows found in the file.");

  let mappings: Record<string, string>;
  let mappedRows: CsvRow[];
  let rowErrors: Array<{ rowNumber: number; message: string }>;
  if (input.importType === "opening_balances") {
    const ob = mapOpeningBalanceRows(parsed.headers, parsed.rows);
    mappings = ob.mappings;
    mappedRows = ob.mapped.filter((r) => Object.values(r).some((v) => v.trim()));
    rowErrors = mappedRows.flatMap((r, i) => {
      const errs: Array<{ rowNumber: number; message: string }> = [];
      if (!r.accountName?.trim()) errs.push({ rowNumber: i + 2, message: "Account name is required." });
      if (!String(r.balance ?? "").trim()) errs.push({ rowNumber: i + 2, message: "Balance is required." });
      return errs;
    });
  } else {
    const suggested = input.mappings ?? suggestMappings(input.importType, parsed.headers, parsed.rows);
    mappings = normalizeMappings(input.importType, parsed.headers, parsed.rows, suggested).mappings;
    const cleaned = cleanRowsForImport(input.importType, parsed.rows, mappings);
    mappedRows = cleaned.mappedRows;
    rowErrors = validateMappedRows(input.importType, mappedRows, mappings);
  }

  const errorByRow = new Map<number, string[]>();
  for (const e of rowErrors) {
    errorByRow.set(e.rowNumber, [...(errorByRow.get(e.rowNumber) ?? []), e.message]);
  }

  const key = `${orgId}/migration/${batchId}/${Date.now()}-${input.fileName.replace(/[^\w.()-]+/g, "_")}`;
  await documentStorage.putObject({
    key,
    body: input.buffer,
    contentType: sniff.kind === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv"
  });

  const file = await prisma.accountingImportFile.create({
    data: {
      orgId,
      batchId,
      fileName: input.fileName,
      importType: input.importType,
      sha256: sha256Hex(input.buffer),
      sizeBytes: input.buffer.length,
      storageKey: key,
      rowCount: mappedRows.length,
      validCount: mappedRows.length - errorByRow.size,
      invalidCount: errorByRow.size,
      rows: {
        create: mappedRows.map((row, i) => {
          const rowIndex = i + 2; // header is row 1 in the source file
          const errs = errorByRow.get(rowIndex) ?? [];
          return {
            orgId,
            rowIndex,
            payloadJson: row as Prisma.InputJsonValue,
            sourceRef: deriveSourceRef(batch.sourceSystem, input.importType, row),
            status: errs.length ? "invalid" : "valid",
            errorMessage: errs.join(" ")
          };
        })
      }
    }
  });
  await prisma.accountingImportBatch.update({
    where: { id: batchId },
    data: {
      status: "inventoried",
      mappingJson: {
        ...((batch.mappingJson as Record<string, unknown> | null) ?? {}),
        [file.id]: mappings
      } as Prisma.InputJsonValue
    }
  });
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: actorUserId ?? null,
      action: "migration.file_inventoried",
      entityType: "AccountingImportBatch",
      entityId: batchId,
      metadata: { fileId: file.id, fileName: input.fileName, importType: input.importType, rows: mappedRows.length } as Prisma.InputJsonValue
    }
  });
  return prisma.accountingImportFile.findFirst({ where: { id: file.id }, include: { rows: { orderBy: { rowIndex: "asc" } } } });
}

// ---------------------------------------------------------------------------
// Strict validation: unknown referenced entities are invalid, never created.
// ---------------------------------------------------------------------------

export async function validateBatch(batchId: string) {
  const batch = await getBatchOrThrow(batchId);
  if (!["inventoried", "mapped", "validated", "rejected"].includes(batch.status)) {
    throw new Error(`Cannot validate a batch in status ${batch.status}.`);
  }
  const files = await prisma.accountingImportFile.findMany({
    where: { batchId },
    include: { rows: { orderBy: { rowIndex: "asc" } } }
  });

  // Org-side lookup sets (org-scoped by the tenant middleware).
  const [orgCustomers, orgSuppliers, orgAccounts, orgProducts, orgInvoices] = await Promise.all([
    prisma.customer.findMany({ select: { displayName: true } }),
    prisma.supplier.findMany({ select: { displayName: true } }),
    prisma.account.findMany({ select: { name: true, code: true, type: true } }),
    prisma.product.findMany({ select: { name: true, sku: true } }),
    prisma.invoice.findMany({ select: { number: true } })
  ]);
  const customerNames = new Set(orgCustomers.map((c) => normKey(c.displayName)));
  const supplierNames = new Set(orgSuppliers.map((s) => normKey(s.displayName)));
  const accountNames = new Map(orgAccounts.map((a) => [normKey(a.name), a]));
  const productKeys = new Set(orgProducts.flatMap((p) => [normKey(p.name), normKey(p.sku)]));
  const invoiceNumbers = new Set(orgInvoices.map((i) => normKey(i.number)));

  // Batch-local names from structurally valid rows.
  const rowsOf = (type: MigrationImportType) =>
    files.filter((f) => f.importType === type).flatMap((f) => f.rows).filter((r) => r.status !== "invalid");
  for (const r of rowsOf("customers")) customerNames.add(normKey((r.payloadJson as CsvRow).displayName));
  for (const r of rowsOf("vendors")) supplierNames.add(normKey((r.payloadJson as CsvRow).displayName));
  for (const r of rowsOf("accounts")) {
    const p = r.payloadJson as CsvRow;
    accountNames.set(normKey(p.name), { name: p.name, code: p.code ?? "", type: "asset" });
  }
  for (const r of rowsOf("products")) {
    const p = r.payloadJson as CsvRow;
    productKeys.add(normKey(p.name));
    if (p.sku) productKeys.add(normKey(p.sku));
  }
  const batchInvoiceNumbers = new Set(rowsOf("invoices").map((r) => normKey((r.payloadJson as CsvRow).number)));

  // Lineage: rows already committed by an earlier import of the same source
  // are duplicates to skip, not errors.
  const sourceRefs = files.flatMap((f) => f.rows.map((r) => r.sourceRef).filter(Boolean));
  const existingRefs = await prisma.externalSourceRef.findMany({
    where: { sourceSystem: batch.sourceSystem, sourceId: { in: sourceRefs } },
    select: { sourceId: true }
  });
  const knownSourceRefs = new Set(existingRefs.map((r) => r.sourceId));

  const invalidate = async (rowId: string, message: string) => {
    await prisma.accountingImportRow.update({ where: { id: rowId }, data: { status: "invalid", errorMessage: message } });
  };

  const requireAccount = async (rowId: string, name: string | undefined, fallback: string, fieldLabel: string) => {
    const key = normKey(name || fallback);
    if (!accountNames.has(key)) {
      await invalidate(rowId, `${fieldLabel} account "${name || fallback}" not found in the chart of accounts. Import accounts first.`);
      return null;
    }
    return key;
  };

  for (const file of files) {
    const type = file.importType as MigrationImportType;
    for (const row of file.rows) {
      if (row.status === "invalid") continue;
      const p = row.payloadJson as CsvRow;
      // Rows already committed by a previous identical import stay valid — the
      // commit step marks them skipped_duplicate instead of erroring.
      if (knownSourceRefs.has(row.sourceRef)) continue;
      switch (type) {
        case "customers":
        case "vendors": {
          const set = type === "customers" ? customerNames : supplierNames;
          // In-batch duplicates of the same display name collapse at commit.
          if (!set.has(normKey(p.displayName))) await invalidate(row.id, "Name is required.");
          break;
        }
        case "accounts": {
          if (!p.type?.trim()) await invalidate(row.id, "Account type is required.");
          break;
        }
        case "products": {
          await requireAccount(row.id, p.incomeAccountName, "Sales", "Income");
          break;
        }
        case "invoices": {
          if (!customerNames.has(normKey(p.customerName))) {
            await invalidate(row.id, `Customer "${p.customerName}" not found. Import customers first.`);
            break;
          }
          if (invoiceNumbers.has(normKey(p.number))) {
            await invalidate(row.id, `Invoice number "${p.number}" already exists in your books.`);
            break;
          }
          await requireAccount(row.id, undefined, "Sales", "Income");
          break;
        }
        case "bills": {
          if (!supplierNames.has(normKey(p.supplierName))) {
            await invalidate(row.id, `Vendor "${p.supplierName}" not found. Import vendors first.`);
            break;
          }
          await requireAccount(row.id, undefined, "Cost of Goods Sold", "Expense");
          break;
        }
        case "expenses": {
          const ok = await requireAccount(row.id, p.paymentAccountName, "Checking", "Payment");
          if (ok) await requireAccount(row.id, p.categoryName, "General Expenses", "Category");
          break;
        }
        case "payments": {
          if (!customerNames.has(normKey(p.customerName))) {
            await invalidate(row.id, `Customer "${p.customerName}" not found. Import customers first.`);
            break;
          }
          const ok = await requireAccount(row.id, p.depositAccountName, "Undeposited Funds", "Deposit");
          if (!ok) break;
          if (String(p.invoiceNumber ?? "").trim()) {
            const num = normKey(p.invoiceNumber);
            if (!invoiceNumbers.has(num) && !batchInvoiceNumbers.has(num)) {
              await invalidate(row.id, `Invoice "${p.invoiceNumber}" not found for payment application. Import invoices first.`);
            }
          }
          break;
        }
        case "deposits": {
          const ok = await requireAccount(row.id, p.accountName, "", "Bank");
          if (!ok) break;
          if (!String(p.offsetAccountName ?? "").trim()) {
            await invalidate(row.id, "Offset account is required so the deposit can post to the GL.");
          } else {
            await requireAccount(row.id, p.offsetAccountName, "", "Offset");
          }
          break;
        }
        case "opening_balances": {
          await requireAccount(row.id, p.accountName, "", "Opening balance");
          break;
        }
      }
    }
    const counts = await prisma.accountingImportRow.groupBy({
      by: ["status"],
      where: { fileId: file.id },
      _count: { _all: true }
    });
    const valid = counts.find((c) => c.status === "valid")?._count._all ?? 0;
    const invalid = counts.find((c) => c.status === "invalid")?._count._all ?? 0;
    await prisma.accountingImportFile.update({ where: { id: file.id }, data: { validCount: valid, invalidCount: invalid } });
  }

  const anyInvalid = await prisma.accountingImportRow.count({ where: { file: { batchId }, status: "invalid" } });
  const status = anyInvalid > 0 ? "rejected" : "validated";
  await prisma.accountingImportBatch.update({
    where: { id: batchId },
    data: { status, errorSummary: anyInvalid > 0 ? `${anyInvalid} row(s) failed validation.` : "" }
  });
  return { status, invalidRows: anyInvalid };
}

export async function approveBatch(batchId: string, actorUserId?: string) {
  const batch = await getBatchOrThrow(batchId);
  if (batch.status !== "validated") throw new Error(`Only a validated batch can be approved (current: ${batch.status}).`);
  return prisma.accountingImportBatch.update({
    where: { id: batchId },
    data: { status: "approved", approvedByUserId: actorUserId ?? null, approvedAt: new Date() }
  });
}

// ---------------------------------------------------------------------------
// Atomic commit
// ---------------------------------------------------------------------------

async function nextNumberInTx(tx: Tx, model: "invoice" | "bill" | "payment" | "expense" | "deposit", prefix: string): Promise<string> {
  const delegate = tx[model] as unknown as {
    findFirst: (args: unknown) => Promise<{ number: string } | null>;
  };
  const latest = await delegate.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true }
  });
  const seq = latest?.number ? Number(latest.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(Number.isFinite(seq) ? seq : 1).padStart(4, "0")}`;
}

async function findRef(tx: Tx, sourceSystem: string, sourceType: string, sourceId: string) {
  return tx.externalSourceRef.findFirst({
    where: { sourceSystem, sourceType, sourceId },
    select: { id: true, destinationType: true, destinationId: true }
  });
}

async function createRef(
  tx: Tx,
  batchId: string,
  sourceSystem: string,
  sourceType: string,
  sourceId: string,
  destinationType: string,
  destinationId: string
) {
  await tx.externalSourceRef.create({
    data: { orgId: requireOrgId(), batchId, sourceSystem, sourceType, sourceId, destinationType, destinationId }
  });
}

type RowLite = { id: string; rowIndex: number; sourceRef: string; payloadJson: unknown };

async function markRow(tx: Tx, row: RowLite, status: string, destinationType = "", destinationId = "") {
  await tx.accountingImportRow.update({ where: { id: row.id }, data: { status, destinationType, destinationId } });
}

function uniqueSlug(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "X";
}

export async function commitBatch(batchId: string, actorUserId?: string) {
  const orgId = requireOrgId();
  const batch = await getBatchOrThrow(batchId);
  if (batch.status !== "approved") throw new Error(`Only an approved batch can be committed (current: ${batch.status}).`);
  await prisma.accountingImportBatch.update({ where: { id: batchId }, data: { status: "importing" } });

  const asOf = (() => {
    const raw = (batch.mappingJson as Record<string, unknown> | null)?.asOfDate;
    return normalizeDate(raw) ?? new Date();
  })();

  try {
    const summary = await prisma.$transaction(async (tx) => {
      const accounts = await ensureControlAccounts(tx);
      const year = new Date().getFullYear();
      const stats: Record<string, { committed: number; skipped: number }> = {};
      const bump = (type: string, key: "committed" | "skipped") => {
        stats[type] = stats[type] ?? { committed: 0, skipped: 0 };
        stats[type][key] += 1;
      };

      const files = await tx.accountingImportFile.findMany({
        where: { batchId },
        include: { rows: { where: { status: "valid" }, orderBy: { rowIndex: "asc" } } }
      });
      const orderedFiles = [...files].sort(
        (a, b) => TYPE_ORDER.indexOf(a.importType as MigrationImportType) - TYPE_ORDER.indexOf(b.importType as MigrationImportType)
      );

      const accountByName = async (name: string) =>
        tx.account.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, code: true, name: true, type: true } });
      const customerByName = async (name: string) =>
        tx.customer.findFirst({ where: { displayName: { equals: name, mode: "insensitive" } }, select: { id: true, displayName: true } });
      const supplierByName = async (name: string) =>
        tx.supplier.findFirst({ where: { displayName: { equals: name, mode: "insensitive" } }, select: { id: true, displayName: true } });

      const openingEntries: Array<{ accountId: string; code: string; name: string; balance: number }> = [];
      const arApCodes = new Set(["1100", "2000"]);

      for (const file of orderedFiles) {
        const type = file.importType as MigrationImportType;
        let fileCommitted = 0;

        for (const row of file.rows) {
          const p = row.payloadJson as CsvRow;
          const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
          if (existing) {
            await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
            bump(type, "skipped");
            continue;
          }

          switch (type) {
            case "accounts": {
              const accountType = parseAccountTypeLoose(p.type);
              if (!accountType) throw new Error(`Row ${row.rowIndex}: unrecognized account type "${p.type}".`);
              const found = await accountByName(p.name);
              let accountId = found?.id ?? "";
              if (!found) {
                const code = p.code?.trim() || (await nextAccountCodeInTx(tx, accountType));
                const clash = await tx.account.findFirst({ where: { code }, select: { id: true } });
                const created = await tx.account.create({
                  data: {
                    orgId,
                    code: clash ? await nextAccountCodeInTx(tx, accountType) : code,
                    name: p.name,
                    type: accountType,
                    subtype: p.subtype ?? ""
                  },
                  select: { id: true }
                });
                accountId = created.id;
              }
              await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Account", accountId);
              await markRow(tx, row, "committed", "Account", accountId);
              bump(type, "committed");
              fileCommitted += 1;
              const ob = normalizeCurrency(p.openingBalance);
              if (Math.abs(ob) > 0) {
                const acc = await tx.account.findUniqueOrThrow({ where: { id: accountId }, select: { code: true, name: true, type: true } });
                if (!arApCodes.has(acc.code)) {
                  openingEntries.push({ accountId, code: acc.code, name: acc.name, balance: signedOpeningBalance(acc.type, ob) });
                }
              }
              break;
            }
            case "customers": {
              const found = await customerByName(p.displayName);
              let customerId = found?.id ?? "";
              if (!found) {
                const created = await tx.customer.create({
                  data: {
                    orgId,
                    displayName: p.displayName,
                    companyName: p.companyName ?? "",
                    email: p.email ?? "",
                    phone: p.phone ?? "",
                    billingAddress: p.billingAddress ?? ""
                  },
                  select: { id: true }
                });
                customerId = created.id;
              }
              await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Customer", customerId);
              await markRow(tx, row, "committed", "Customer", customerId);
              bump(type, "committed");
              fileCommitted += 1;
              const ob = normalizeCurrency(p.openingBalance);
              if (ob > 0) {
                // Opening AR as a real invoice posted Dr AR / Cr Opening Balance Equity.
                const number = await openingDocNumber(tx, "invoice", `OB-AR-${uniqueSlug(p.displayName)}`);
                const invoice = await tx.invoice.create({
                  data: {
                    orgId,
                    number,
                    customerId,
                    issueDate: asOf,
                    status: TransactionStatus.open,
                    memo: `Opening balance — ${batch.sourceSystem} migration`,
                    subtotal: ob,
                    total: ob,
                    balance: ob,
                    lines: {
                      create: [{
                        orgId,
                        position: 1,
                        description: "Opening balance (migration)",
                        quantity: 1,
                        unitPrice: ob,
                        amount: ob,
                        incomeAccountId: accounts.openingBalanceEquity
                      }]
                    }
                  },
                  include: { lines: true }
                });
                await postJournal(tx, buildInvoiceIssuedJournal(invoice, accounts.accountsReceivable, accounts.taxPayable), actorUserId);
                await createRef(tx, batchId, batch.sourceSystem, "customer_opening", row.sourceRef, "Invoice", invoice.id);
              }
              break;
            }
            case "vendors": {
              const found = await supplierByName(p.displayName);
              let supplierId = found?.id ?? "";
              if (!found) {
                const created = await tx.supplier.create({
                  data: {
                    orgId,
                    displayName: p.displayName,
                    companyName: p.companyName ?? "",
                    email: p.email ?? "",
                    phone: p.phone ?? "",
                    mailingAddress: p.mailingAddress ?? ""
                  },
                  select: { id: true }
                });
                supplierId = created.id;
              }
              await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Supplier", supplierId);
              await markRow(tx, row, "committed", "Supplier", supplierId);
              bump(type, "committed");
              fileCommitted += 1;
              const ob = normalizeCurrency(p.openingBalance);
              if (ob > 0) {
                // Opening AP as a real bill posted Dr Opening Balance Equity / Cr AP.
                const number = await openingDocNumber(tx, "bill", `OB-AP-${uniqueSlug(p.displayName)}`);
                const bill = await tx.bill.create({
                  data: {
                    orgId,
                    number,
                    supplierId,
                    billDate: asOf,
                    status: TransactionStatus.open,
                    memo: `Opening balance — ${batch.sourceSystem} migration`,
                    subtotal: ob,
                    total: ob,
                    balance: ob,
                    lines: {
                      create: [{
                        orgId,
                        position: 1,
                        description: "Opening balance (migration)",
                        quantity: 1,
                        unitCost: ob,
                        amount: ob,
                        expenseAccountId: accounts.openingBalanceEquity
                      }]
                    }
                  },
                  include: { lines: true }
                });
                await postJournal(tx, buildBillReceivedJournal(bill, accounts.accountsPayable, accounts.taxPayable), actorUserId);
                await createRef(tx, batchId, batch.sourceSystem, "vendor_opening", row.sourceRef, "Bill", bill.id);
              }
              break;
            }
            case "products": {
              const sku = p.sku?.trim() || uniqueSlug(p.name);
              const found = await tx.product.findFirst({
                where: { OR: [{ sku }, { name: { equals: p.name, mode: "insensitive" } }] },
                select: { id: true }
              });
              let productId = found?.id ?? "";
              if (!found) {
                const income = (await accountByName(p.incomeAccountName || "Sales"))!;
                const created = await tx.product.create({
                  data: {
                    orgId,
                    sku,
                    name: p.name,
                    kind: parseProductKindLoose(p.kind),
                    description: p.description ?? "",
                    salesPrice: normalizeCurrency(p.salesPrice),
                    incomeAccountId: income.id
                  },
                  select: { id: true }
                });
                productId = created.id;
              }
              await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Product", productId);
              await markRow(tx, row, "committed", "Product", productId);
              bump(type, "committed");
              fileCommitted += 1;
              break;
            }
            default:
              break; // document types are handled per-file below
          }
        }

        // Document types operate on the file's whole row set (invoice grouping).
        if (type === "invoices") {
          const pendingRows = file.rows.filter((r) => true);
          const groups = groupInvoiceRows(pendingRows.map((r) => ({ ...((r.payloadJson as CsvRow) ?? {}), __rowId: r.id, __sourceRef: r.sourceRef })));
          for (const group of groups) {
            const firstRow = pendingRows.find((r) => r.id === (group.rows[0] as CsvRow).__rowId)!;
            const sourceRef = firstRow.sourceRef;
            const existing = await findRef(tx, batch.sourceSystem, type, sourceRef);
            if (existing) {
              for (const gr of group.rows) {
                const rowRec = pendingRows.find((r) => r.id === (gr as CsvRow).__rowId)!;
                await markRow(tx, rowRec, "skipped_duplicate", existing.destinationType, existing.destinationId);
                bump(type, "skipped");
              }
              continue;
            }
            const first = group.rows[0] as CsvRow;
            const customer = (await customerByName(first.customerName))!;
            const { lines, total } = invoiceLinesFromGroup(group.rows as CsvRow[]);
            const income = (await accountByName("Sales"))!;
            const issueDate = normalizeDate(first.issueDate) ?? asOf;
            const balance = first.balance ? normalizeCurrency(first.balance) : total;
            const amountPaid = round2(Math.max(0, total - balance));
            const invoice = await tx.invoice.create({
              data: {
                orgId,
                number: group.number || (await nextNumberInTx(tx, "invoice", `INV-${year}-`)),
                customerId: customer.id,
                issueDate,
                dueDate: normalizeDate(first.dueDate),
                status: TransactionStatus.open,
                memo: `${batch.sourceSystem} migration import`,
                subtotal: total,
                total,
                amountPaid,
                balance: round2(total - amountPaid),
                lines: {
                  create: lines.map((l, i) => ({
                    orgId,
                    position: i + 1,
                    description: l.description,
                    quantity: 1,
                    unitPrice: l.amount,
                    amount: l.amount,
                    incomeAccountId: income.id
                  }))
                }
              },
              include: { lines: true }
            });
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: deriveStatus(TransactionStatus.open, total, amountPaid) }
            });
            await postJournal(tx, buildInvoiceIssuedJournal(invoice, accounts.accountsReceivable, accounts.taxPayable), actorUserId);
            await createRef(tx, batchId, batch.sourceSystem, type, sourceRef, "Invoice", invoice.id);
            for (const gr of group.rows) {
              const rowRec = pendingRows.find((r) => r.id === (gr as CsvRow).__rowId)!;
              await markRow(tx, rowRec, "committed", "Invoice", invoice.id);
              bump(type, "committed");
            }
            fileCommitted += 1;
          }
        }

        if (type === "bills") {
          for (const row of file.rows) {
            const p = row.payloadJson as CsvRow;
            const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
            if (existing) {
              await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
              bump(type, "skipped");
              continue;
            }
            const supplier = (await supplierByName(p.supplierName))!;
            const expenseAccount = (await accountByName("Cost of Goods Sold"))!;
            const total = normalizeCurrency(p.total);
            const balance = p.balance ? normalizeCurrency(p.balance) : total;
            const amountPaid = round2(Math.max(0, total - balance));
            const bill = await tx.bill.create({
              data: {
                orgId,
                number: p.number?.trim() || (await nextNumberInTx(tx, "bill", `BILL-${year}-`)),
                supplierId: supplier.id,
                billDate: normalizeDate(p.billDate) ?? asOf,
                dueDate: normalizeDate(p.dueDate),
                status: TransactionStatus.open,
                memo: `${batch.sourceSystem} migration import`,
                subtotal: total,
                total,
                amountPaid,
                balance: round2(total - amountPaid),
                lines: {
                  create: [{
                    orgId,
                    position: 1,
                    description: "Imported bill",
                    quantity: 1,
                    unitCost: total,
                    amount: total,
                    expenseAccountId: expenseAccount.id
                  }]
                }
              },
              include: { lines: true }
            });
            await tx.bill.update({ where: { id: bill.id }, data: { status: deriveStatus(TransactionStatus.open, total, amountPaid) } });
            await postJournal(tx, buildBillReceivedJournal(bill, accounts.accountsPayable, accounts.taxPayable), actorUserId);
            await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Bill", bill.id);
            await markRow(tx, row, "committed", "Bill", bill.id);
            bump(type, "committed");
            fileCommitted += 1;
          }
        }

        if (type === "expenses") {
          for (const row of file.rows) {
            const p = row.payloadJson as CsvRow;
            const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
            if (existing) {
              await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
              bump(type, "skipped");
              continue;
            }
            const paymentAccount = (await accountByName(p.paymentAccountName || "Checking"))!;
            const category = (await accountByName(p.categoryName || "General Expenses"))!;
            const amount = normalizeCurrency(p.amount);
            const supplier = p.payeeName ? await supplierByName(p.payeeName) : null;
            const expense = await tx.expense.create({
              data: {
                orgId,
                number: await nextNumberInTx(tx, "expense", `EXP-${year}-`),
                expenseDate: normalizeDate(p.expenseDate) ?? asOf,
                method: parsePaymentMethodLoose(p.method),
                memo: p.memo ?? "",
                supplierId: supplier?.id ?? null,
                payeeName: p.payeeName ?? "",
                paymentAccountId: paymentAccount.id,
                subtotal: amount,
                total: amount,
                status: TransactionStatus.open,
                postedAt: new Date(),
                lines: {
                  create: [{
                    orgId,
                    position: 1,
                    description: p.memo || "Imported expense",
                    quantity: 1,
                    unitCost: amount,
                    amount,
                    expenseAccountId: category.id
                  }]
                }
              },
              include: { lines: true }
            });
            await postJournal(tx, buildExpensePostedJournal(expense, accounts.taxPayable), actorUserId);
            await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Expense", expense.id);
            await markRow(tx, row, "committed", "Expense", expense.id);
            bump(type, "committed");
            fileCommitted += 1;
          }
        }

        if (type === "payments") {
          for (const row of file.rows) {
            const p = row.payloadJson as CsvRow;
            const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
            if (existing) {
              await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
              bump(type, "skipped");
              continue;
            }
            const customer = (await customerByName(p.customerName))!;
            const depositAccount = (await accountByName(p.depositAccountName || "Undeposited Funds"))!;
            const amount = normalizeCurrency(p.amount);
            // Preserve the payment application when the row names an invoice.
            let application: { invoiceId: string; amount: number } | null = null;
            const invoiceNumber = String(p.invoiceNumber ?? "").trim();
            if (invoiceNumber) {
              const invoice = await tx.invoice.findFirst({
                where: { number: { equals: invoiceNumber, mode: "insensitive" } },
                select: { id: true, total: true, amountPaid: true, balance: true, status: true }
              });
              if (invoice && invoice.balance > 0) {
                application = { invoiceId: invoice.id, amount: round2(Math.min(amount, invoice.balance)) };
              }
            }
            const payment = await tx.payment.create({
              data: {
                orgId,
                number: p.reference?.trim() || (await nextNumberInTx(tx, "payment", `PMT-${year}-`)),
                customerId: customer.id,
                paymentDate: normalizeDate(p.paymentDate) ?? asOf,
                method: parsePaymentMethodLoose(p.method),
                reference: p.reference ?? "",
                amount,
                applied: application?.amount ?? 0,
                unapplied: round2(amount - (application?.amount ?? 0)),
                depositAccountId: depositAccount.id,
                applications: application
                  ? { create: [{ orgId, invoiceId: application.invoiceId, amount: application.amount }] }
                  : undefined
              }
            });
            if (application) {
              const inv = await tx.invoice.findUniqueOrThrow({ where: { id: application.invoiceId } });
              const nextPaid = round2(inv.amountPaid + application.amount);
              await tx.invoice.update({
                where: { id: inv.id },
                data: {
                  amountPaid: nextPaid,
                  balance: round2(inv.total - nextPaid),
                  status: deriveStatus(inv.status, inv.total, nextPaid)
                }
              });
            }
            await postJournal(tx, buildPaymentReceivedJournal(payment, accounts.accountsReceivable), actorUserId);
            await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Payment", payment.id);
            await markRow(tx, row, "committed", "Payment", payment.id);
            bump(type, "committed");
            fileCommitted += 1;
          }
        }

        if (type === "deposits") {
          for (const row of file.rows) {
            const p = row.payloadJson as CsvRow;
            const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
            if (existing) {
              await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
              bump(type, "skipped");
              continue;
            }
            const bankAccount = (await accountByName(p.accountName))!;
            const offsetAccount = (await accountByName(p.offsetAccountName))!;
            const total = normalizeCurrency(p.amount);
            const deposit = await tx.deposit.create({
              data: {
                orgId,
                number: await nextNumberInTx(tx, "deposit", `DEP-${year}-`),
                depositDate: normalizeDate(p.depositDate) ?? asOf,
                memo: [p.receivedFrom, p.memo].filter(Boolean).join(" - "),
                bankAccountId: bankAccount.id,
                total,
                status: TransactionStatus.open,
                postedAt: new Date(),
                lines: {
                  create: [{
                    orgId,
                    position: 1,
                    description: p.receivedFrom || p.memo || "Imported deposit",
                    amount: total,
                    accountId: offsetAccount.id
                  }]
                }
              },
              include: { lines: true }
            });
            await postJournal(
              tx,
              buildDepositPostedJournal({
                id: deposit.id,
                number: deposit.number,
                depositDate: deposit.depositDate,
                bankAccountId: deposit.bankAccountId,
                total: deposit.total,
                undepositedFundsAccountId: accounts.undepositedFunds,
                paymentAmounts: [],
                adhocLines: [{ accountId: offsetAccount.id, amount: total, description: deposit.memo || `Deposit ${deposit.number}` }]
              }),
              actorUserId
            );
            await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Deposit", deposit.id);
            await markRow(tx, row, "committed", "Deposit", deposit.id);
            bump(type, "committed");
            fileCommitted += 1;
          }
        }

        if (type === "opening_balances") {
          for (const row of file.rows) {
            const p = row.payloadJson as CsvRow;
            const existing = await findRef(tx, batch.sourceSystem, type, row.sourceRef);
            if (existing) {
              await markRow(tx, row, "skipped_duplicate", existing.destinationType, existing.destinationId);
              bump(type, "skipped");
              continue;
            }
            const account = (await accountByName(p.accountName))!;
            if (arApCodes.has(account.code)) {
              await markRow(tx, row, "skipped_duplicate", "Account", account.id);
              bump(type, "skipped");
              continue; // AR/AP opening balances come from customer/vendor docs
            }
            const balance = signedOpeningBalance(account.type, normalizeCurrency(p.balance));
            if (balance !== 0) openingEntries.push({ accountId: account.id, code: account.code, name: account.name, balance });
            await createRef(tx, batchId, batch.sourceSystem, type, row.sourceRef, "Account", account.id);
            await markRow(tx, row, "committed", "Account", account.id);
            bump(type, "committed");
            fileCommitted += 1;
          }
        }

        await tx.accountingImportFile.update({ where: { id: file.id }, data: { committedCount: fileCommitted } });
      }

      // One opening-balance journal per batch, offset to Opening Balance Equity.
      let openingJournalId = "";
      if (openingEntries.length) {
        const posted = await postJournal(
          tx,
          buildOpeningBalanceJournal({ batchId, asOfDate: asOf, openingBalanceEquityAccountId: accounts.openingBalanceEquity, entries: openingEntries }),
          actorUserId
        );
        openingJournalId = posted.entryId;
      }

      // Reconciliation evidence (inside the same transaction).
      const reconciliationRows: Array<{ checkType: string; scope: string; expected: number; actual: number }> = [];
      for (const file of orderedFiles) {
        const valid = file.rows.length;
        const committed = (stats[file.importType]?.committed ?? 0) + (stats[file.importType]?.skipped ?? 0);
        reconciliationRows.push({
          checkType: "count",
          scope: `${file.importType}:${file.fileName}`,
          expected: valid,
          actual: committed
        });
      }
      const journals = await tx.journalEntry.findMany({
        where: { memo: { contains: "migration" }, createdAt: { gte: batch.createdAt } },
        include: { lines: true }
      });
      const debits = round2(journals.flatMap((j) => j.lines).reduce((s, l) => s + Number(l.debit), 0));
      const credits = round2(journals.flatMap((j) => j.lines).reduce((s, l) => s + Number(l.credit), 0));
      reconciliationRows.push({ checkType: "trial_balance", scope: "batch journals", expected: debits, actual: credits });
      for (const rec of reconciliationRows) {
        await tx.migrationReconciliation.create({
          data: {
            orgId,
            batchId,
            checkType: rec.checkType,
            scope: rec.scope,
            expected: rec.expected,
            actual: rec.actual,
            status: Math.abs(rec.expected - rec.actual) <= 0.005 ? "matched" : "discrepancy"
          }
        });
      }

      await tx.accountingImportBatch.update({
        where: { id: batchId },
        data: { status: "reconciled", committedAt: new Date(), committedByUserId: actorUserId ?? null }
      });
      await tx.auditLog.create({
        data: {
          orgId,
          actorUserId: actorUserId ?? null,
          action: "migration.committed",
          entityType: "AccountingImportBatch",
          entityId: batchId,
          metadata: { stats, openingJournalId } as Prisma.InputJsonValue
        }
      });
      return { stats, openingJournalId };
    }, { timeout: 120000, maxWait: 30000 });

    return { status: "reconciled" as const, ...summary };
  } catch (err) {
    // The transaction rolled back: zero partial data. Record the failure.
    await prisma.accountingImportBatch.update({
      where: { id: batchId },
      data: { status: "failed", errorSummary: err instanceof Error ? err.message : "Commit failed." }
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Loose parsers (mirrors of the legacy importer's private parsers)
// ---------------------------------------------------------------------------

function parseAccountTypeLoose(value: string | undefined): AccountType | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("bank") || v.includes("asset") || v.includes("receivable")) return AccountType.asset;
  if (v.includes("liability") || v.includes("payable") || v.includes("credit card")) return AccountType.liability;
  if (v.includes("equity")) return AccountType.equity;
  if (v.includes("income") || v.includes("revenue") || v.includes("sales")) return AccountType.revenue;
  if (v.includes("expense") || v.includes("cost")) return AccountType.expense;
  return null;
}

function parseProductKindLoose(value: string | undefined): ProductKind {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("bundle")) return ProductKind.bundle;
  if (v.includes("product") || v.includes("inventory")) return ProductKind.product;
  return ProductKind.service;
}

function parsePaymentMethodLoose(value: string | undefined): PaymentMethod {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("check") || v.includes("cheque")) return PaymentMethod.check;
  if (v.includes("card") || v.includes("credit")) return PaymentMethod.card;
  if (v.includes("ach") || v.includes("bank")) return PaymentMethod.ach;
  if (v.includes("cash")) return PaymentMethod.cash;
  return PaymentMethod.other;
}

async function nextAccountCodeInTx(tx: Tx, type: AccountType): Promise<string> {
  const base = { asset: 1000, liability: 2000, equity: 3000, revenue: 4000, expense: 5000 }[type];
  const latest = await tx.account.findFirst({
    where: { code: { startsWith: String(base).slice(0, 1) } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const next = latest ? Number(latest.code.replace(/\D/g, "")) + 1 : base;
  return String(Number.isFinite(next) ? next : base);
}

/** Unique opening-document number: OB-AR-ACME, OB-AR-ACME-2, ... */
async function openingDocNumber(tx: Tx, model: "invoice" | "bill", base: string): Promise<string> {
  const delegate = tx[model] as unknown as { findFirst: (args: unknown) => Promise<{ id: string } | null> };
  let candidate = base;
  for (let i = 2; i < 100; i += 1) {
    const clash = await delegate.findFirst({ where: { number: candidate }, select: { id: true } });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
  throw new Error(`Could not allocate an opening document number for ${base}.`);
}

// ---------------------------------------------------------------------------
// Reversal + acceptance
// ---------------------------------------------------------------------------

const DOC_SOURCE_TYPES: Record<string, string> = {
  Invoice: "invoice",
  Bill: "bill",
  Payment: "payment",
  Expense: "expense",
  Deposit: "deposit_posted"
};

/**
 * Undo a committed batch: reverse every journal it posted, remove the
 * documents it created (guarded against references from outside the batch),
 * clear lineage, and return rows to their pre-commit state. Master data that
 * is still unreferenced is removed; referenced master data is kept and noted.
 */
export async function reverseBatch(batchId: string, actorUserId: string | undefined, reason: string) {
  const orgId = requireOrgId();
  const batch = await getBatchOrThrow(batchId);
  if (!["reconciled", "accepted"].includes(batch.status)) {
    throw new Error(`Only a reconciled or accepted batch can be reversed (current: ${batch.status}).`);
  }

  const kept: string[] = [];
  await prisma.$transaction(async (tx) => {
    const refs = await tx.externalSourceRef.findMany({ where: { batchId } });
    const byType = <T extends string>(t: T) => refs.filter((r) => r.destinationType === t).map((r) => r.destinationId);

    // Guards: no cross-batch entanglement.
    const invoiceIds = byType("Invoice");
    if (invoiceIds.length) {
      const externalApps = await tx.paymentApplication.count({
        where: { invoiceId: { in: invoiceIds }, payment: { id: { notIn: byType("Payment") } } }
      });
      if (externalApps > 0) throw new Error("Cannot reverse: imported invoices have payments applied outside this batch. Reverse those payments first.");
    }
    const paymentIds = byType("Payment");
    if (paymentIds.length) {
      const depositLinks = await tx.depositLine.count({ where: { paymentId: { in: paymentIds } } });
      if (depositLinks > 0) throw new Error("Cannot reverse: imported payments are linked to deposit lines. Void those deposits first.");
    }

    // Reverse journals for every imported document + the opening journal.
    for (const [destType, sourceType] of Object.entries(DOC_SOURCE_TYPES)) {
      for (const destId of byType(destType)) {
        await reverseJournal(tx, sourceType, destId, {
          date: new Date(),
          memo: `Migration reversal — batch ${batchId}`,
          createdByUserId: actorUserId
        });
      }
    }
    await reverseJournal(tx, "migration_opening_balance", batchId, {
      date: new Date(),
      memo: `Migration reversal — batch ${batchId}`,
      createdByUserId: actorUserId
    });

    // Delete transactional documents (line/application rows cascade).
    if (paymentIds.length) await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    if (byType("Deposit").length) await tx.deposit.deleteMany({ where: { id: { in: byType("Deposit") } } });
    if (byType("Expense").length) await tx.expense.deleteMany({ where: { id: { in: byType("Expense") } } });
    if (byType("Bill").length) await tx.bill.deleteMany({ where: { id: { in: byType("Bill") } } });
    if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });

    // Master data: delete only when nothing references it.
    for (const id of byType("Product")) {
      const used = await tx.invoiceLine.count({ where: { productId: id } }) + (await tx.billLine.count({ where: { productId: id } }));
      if (used === 0) await tx.product.delete({ where: { id } });
      else kept.push(`Product ${id}`);
    }
    for (const id of byType("Customer")) {
      const used = await tx.invoice.count({ where: { customerId: id } }) + (await tx.payment.count({ where: { customerId: id } }));
      if (used === 0) await tx.customer.delete({ where: { id } });
      else kept.push(`Customer ${id}`);
    }
    for (const id of byType("Supplier")) {
      const used = await tx.bill.count({ where: { supplierId: id } });
      if (used === 0) await tx.supplier.delete({ where: { id } });
      else kept.push(`Supplier ${id}`);
    }
    for (const id of byType("Account")) {
      const used =
        (await tx.invoiceLine.count({ where: { incomeAccountId: id } })) +
        (await tx.billLine.count({ where: { expenseAccountId: id } })) +
        (await tx.journalLine.count({ where: { accountId: id } }));
      if (used === 0) await tx.account.delete({ where: { id } });
      else kept.push(`Account ${id}`);
    }

    // Clear lineage + reset rows/files to pre-commit state.
    await tx.externalSourceRef.deleteMany({ where: { batchId } });
    await tx.accountingImportRow.updateMany({
      where: { file: { batchId }, status: { in: ["committed", "skipped_duplicate"] } },
      data: { status: "valid", destinationType: "", destinationId: "" }
    });
    await tx.accountingImportFile.updateMany({ where: { batchId }, data: { committedCount: 0 } });
    await tx.migrationReconciliation.updateMany({ where: { batchId }, data: { status: "reversed" } });
    await tx.accountingImportBatch.update({
      where: { id: batchId },
      data: {
        status: "reversed",
        reversedAt: new Date(),
        reversedByUserId: actorUserId ?? null,
        reversalReason: reason
      }
    });
    await tx.auditLog.create({
      data: {
        orgId,
        actorUserId: actorUserId ?? null,
        action: "migration.reversed",
        entityType: "AccountingImportBatch",
        entityId: batchId,
        metadata: { reason, kept } as Prisma.InputJsonValue
      }
    });
  }, { timeout: 120000, maxWait: 30000 });

  return { status: "reversed" as const, kept };
}

export async function acceptBatch(batchId: string, actorUserId?: string) {
  const batch = await getBatchOrThrow(batchId);
  if (batch.status !== "reconciled") throw new Error(`Only a reconciled batch can be accepted (current: ${batch.status}).`);
  await prisma.migrationReconciliation.updateMany({
    where: { batchId, status: "discrepancy" },
    data: { status: "accepted", acceptedByUserId: actorUserId ?? null, acceptedAt: new Date() }
  });
  return prisma.accountingImportBatch.update({ where: { id: batchId }, data: { status: "accepted" } });
}
