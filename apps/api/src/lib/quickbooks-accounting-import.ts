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
  nextBillNumber,
  nextDepositNumber,
  nextExpenseNumber,
  nextInvoiceNumber,
  nextPaymentNumber,
  round2
} from "./finance-transactions.js";
import { readSheet } from "read-excel-file/node";

export const QUICKBOOKS_IMPORT_TYPES = [
  "customers",
  "vendors",
  "accounts",
  "products",
  "invoices",
  "bills",
  "expenses",
  "payments",
  "deposits"
] as const;

export type QuickBooksImportType = (typeof QUICKBOOKS_IMPORT_TYPES)[number];
export type CsvRow = Record<string, string>;

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
  warnings?: string[];
};

export type RowError = {
  rowNumber: number;
  message: string;
};

export type ImportPlan = {
  importType: QuickBooksImportType;
  headers: string[];
  mappings: Record<string, string>;
  previewRows: CsvRow[];
  rowCount: number;
  validationErrors: RowError[];
  validationErrorCount: number;
  warnings: string[];
};

export type ImportResult = {
  importType: QuickBooksImportType;
  created: number;
  skipped: number;
  skippedEmptyRows: number;
  duplicates: number;
  validationErrors: RowError[];
  validationErrorCount: number;
};

type FieldConfig = {
  required: string[];
  aliases: Record<string, string[]>;
};

const MAX_ROWS = 5000;
const PREVIEW_LIMIT = 25;
const MAX_VALIDATION_ERRORS = 10;
const SOURCE_ROW_NUMBER = "__quickBooksSourceRowNumber";
const SHIFTED_COLUMNS_WARNING = "QuickBooks columns looked shifted, so we corrected the mapping automatically.";
const EMPTY_ROWS_WARNING = "Empty rows from your QuickBooks export were ignored.";
const DUPLICATE_DISPLAY_NAME_WARNING = "Only one column can be used as Display name.";

type HeaderColumn = {
  header: string;
  index: number;
};

const configs: Record<QuickBooksImportType, FieldConfig> = {
  customers: {
    required: ["displayName"],
    aliases: {
      displayName: ["Customer", "Display Name", "Customer Name", "Name", "Company", "Company Name", "Full Name", "Contact", "Contact Name", "Payee"],
      companyName: ["Company", "Company Name"],
      email: ["Email", "Email Address", "Primary Email"],
      phone: ["Phone", "Phone Number", "Phone Numbers", "Mobile", "Mobile Phone", "Primary Phone"],
      billingAddress: ["Billing Address"],
      shippingAddress: ["Shipping Address"],
      openingBalance: ["Open Balance", "Balance", "Amount", "Opening Balance"]
    }
  },
  vendors: {
    required: ["displayName"],
    aliases: {
      displayName: ["Supplier", "Supplier Name", "Vendor", "Vendor Name", "Display Name", "Name", "Full Name", "Company", "Company Name", "Contact", "Contact Name", "Payee"],
      companyName: ["Company", "Company Name"],
      email: ["Email", "Email Address", "Primary Email"],
      phone: ["Phone", "Phone Number", "Phone Numbers", "Mobile", "Mobile Phone", "Primary Phone", "Business Phone", "Main Phone"],
      mailingAddress: ["Billing Address", "Street", "Street Address", "Address", "Mailing Address"],
      openingBalance: ["Open Balance", "Balance", "Amount", "Opening Balance"]
    }
  },
  accounts: {
    required: ["name", "type"],
    aliases: {
      name: ["Account Name", "Name"],
      type: ["Account Type", "Type"],
      subtype: ["Detail Type", "Detail"],
      code: ["Account Number", "Number", "No."],
      openingBalance: ["Balance", "Opening Balance"]
    }
  },
  products: {
    required: ["name"],
    aliases: {
      name: ["Name", "Product/Service", "Product", "Service"],
      sku: ["SKU", "Sku"],
      kind: ["Type"],
      description: ["Description"],
      salesPrice: ["Sales Price/Rate", "Rate", "Sales Price"],
      incomeAccountName: ["Income Account", "Income Account Name"]
    }
  },
  invoices: {
    required: ["number", "customerName", "issueDate", "total"],
    aliases: {
      number: ["Invoice No.", "Invoice Number", "No."],
      customerName: ["Customer", "Customer Name"],
      issueDate: ["Invoice Date", "Date"],
      dueDate: ["Due Date"],
      lineItemName: ["Product/Service", "Item"],
      lineAmount: ["Line Amount", "Item Amount", "Line Total"],
      total: ["Amount", "Total"],
      balance: ["Balance"],
      status: ["Status"]
    }
  },
  bills: {
    required: ["supplierName", "billDate", "total"],
    aliases: {
      number: ["Bill No.", "Bill Number", "No."],
      supplierName: ["Vendor", "Supplier", "Vendor Name"],
      billDate: ["Bill Date", "Date"],
      dueDate: ["Due Date"],
      total: ["Amount", "Total"],
      balance: ["Balance"],
      status: ["Status"]
    }
  },
  expenses: {
    required: ["expenseDate", "payeeName", "amount"],
    aliases: {
      expenseDate: ["Date", "Expense Date"],
      payeeName: ["Payee", "Vendor", "Supplier"],
      paymentAccountName: ["Payment Account", "Account"],
      categoryName: ["Category"],
      amount: ["Amount", "Total"],
      memo: ["Memo", "Description"]
    }
  },
  payments: {
    required: ["paymentDate", "customerName", "amount"],
    aliases: {
      paymentDate: ["Date", "Payment Date"],
      customerName: ["Customer", "Customer Name"],
      method: ["Payment Method", "Method"],
      reference: ["Reference No.", "Reference Number", "Ref No."],
      amount: ["Amount"],
      invoiceNumber: ["Invoice", "Invoice No.", "Invoice Number", "Applied To"],
      depositAccountName: ["Deposit To", "Deposit Account", "Account"]
    }
  },
  deposits: {
    required: ["depositDate", "accountName", "amount"],
    aliases: {
      depositDate: ["Date", "Deposit Date"],
      accountName: ["Account", "Deposit Account"],
      receivedFrom: ["Received From", "Payee"],
      memo: ["Memo", "Description"],
      amount: ["Amount", "Total"],
      offsetAccountName: ["Offset Account", "From Account", "Income Account"]
    }
  }
};

export function parseCsv(csv: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];
    if (ch === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      record.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i += 1;
      record.push(field);
      rows.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  record.push(field);
  rows.push(record);

  return parseTableRows(rows);
}

export async function parseExcel(buffer: Buffer): Promise<ParsedCsv> {
  const rows = await readSheet(buffer);
  if (!rows.length) throw new Error("Excel file does not contain a worksheet.");
  return parseTableRows(rows);
}

function parseTableRows(rows: unknown[][]): ParsedCsv {
  const normalizedRows = rows.map((r) => r.map((v) => sanitizeText(v)));
  const headerIndex = findHeaderRowIndex(normalizedRows);
  if (headerIndex < 0) {
    return { headers: [], rows: [] };
  }
  const rawHeaders = normalizedRows[headerIndex] ?? [];
  const bodyRows = normalizedRows.slice(headerIndex + 1);
  const warnings: string[] = [];
  let columns = buildHeaderColumns(rawHeaders);
  if (hasIgnoredLeadingColumns(rawHeaders, bodyRows, columns[0]?.index ?? 0)) {
    warnings.push(SHIFTED_COLUMNS_WARNING);
  }
  if (shouldShiftLeadingNameColumn(columns, bodyRows)) {
    columns = columns.map((column) => ({ ...column, index: column.index + 1 }));
    warnings.push(SHIFTED_COLUMNS_WARNING);
  }
  const headers = columns.map((column) => column.header);
  const body = normalizedRows
    .slice(headerIndex + 1)
    .map((r, index) => ({ row: r, rowNumber: headerIndex + index + 2 }))
    .filter(({ row }) => !isIgnorableRow(row))
    .slice(0, MAX_ROWS)
    .map(({ row, rowNumber }) => ({
      ...Object.fromEntries(columns.map(({ header, index }) => [header, sanitizeCell(row[index] ?? "")])),
      [SOURCE_ROW_NUMBER]: String(rowNumber)
    }));

  return { headers, rows: body, warnings: [...new Set(warnings)] };
}

function buildHeaderColumns(rawHeaders: string[]): HeaderColumn[] {
  return rawHeaders
    .map((header, index) => ({ header: header.trim(), index }))
    .filter(({ header }) => header && header !== "-");
}

function hasIgnoredLeadingColumns(rawHeaders: string[], bodyRows: string[][], firstHeaderIndex: number): boolean {
  if (firstHeaderIndex <= 0) return false;
  return rawHeaders.slice(0, firstHeaderIndex).every((header, index) => {
    if (header.trim() && header.trim() !== "-") return false;
    return isMostlyEmptyDashOrIndex(bodyRows.map((row) => sanitizeCell(row[index] ?? "")));
  });
}

function shouldShiftLeadingNameColumn(columns: HeaderColumn[], bodyRows: string[][]): boolean {
  const first = columns[0];
  if (!first || !isPrimaryNameHeader(first.header)) return false;
  const firstValues = bodyRows.map((row) => sanitizeCell(row[first.index] ?? ""));
  const nextValues = bodyRows.map((row) => sanitizeCell(row[first.index + 1] ?? ""));
  if (!isMostlyEmptyDashOrIndex(firstValues)) return false;
  if (columnRatio(nextValues, looksLikeBusinessName) < 0.6) return false;

  const secondHeader = columns[1]?.header ?? "";
  return secondHeader ? !isPrimaryNameHeader(secondHeader) : true;
}

function findHeaderRowIndex(rows: string[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  rows.forEach((row, index) => {
    if (isIgnorableRow(row)) return;
    const values = row.map(normalizeHeader).filter(Boolean);
    const score = values.reduce((sum, value) => sum + headerScore(value), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 2 ? bestIndex : -1;
}

function headerScore(value: string): number {
  const known = new Set(Object.values(configs).flatMap((config) => Object.values(config.aliases).flat()).map(normalizeHeader));
  if (known.has(value)) return 2;
  if (["date", "type", "status", "memo", "description", "number", "no"].includes(value)) return 1;
  return 0;
}

function isIgnorableRow(row: string[]): boolean {
  return row.every((v) => {
    return sanitizeCell(v) === "";
  });
}

export function buildImportPlan(
  importType: QuickBooksImportType,
  headers: string[],
  rows: CsvRow[],
  mappings?: Record<string, string>,
  warnings: string[] = []
): ImportPlan {
  const normalizedMappings = normalizeMappings(importType, headers, rows, mappings ?? suggestMappings(importType, headers, rows));
  const effectiveMappings = normalizedMappings.mappings;
  const cleaned = cleanRowsForImport(importType, rows, effectiveMappings);
  const validationErrors = validateMappedRows(importType, cleaned.mappedRows, effectiveMappings);
  const planWarnings = [...warnings, ...normalizedMappings.warnings];
  if (cleaned.skippedRows > 0) planWarnings.push(EMPTY_ROWS_WARNING);
  return {
    importType,
    headers,
    mappings: effectiveMappings,
    previewRows: cleaned.sourceRows.slice(0, PREVIEW_LIMIT),
    rowCount: cleaned.sourceRows.length,
    validationErrors: validationErrors.slice(0, MAX_VALIDATION_ERRORS),
    validationErrorCount: validationErrors.length,
    warnings: [...new Set(planWarnings)]
  };
}

export function suggestMappings(importType: QuickBooksImportType, headers: string[], rows: CsvRow[] = []): Record<string, string> {
  const config = configs[importType];
  const byNorm = new Map(headers.map((h) => [normalizeHeader(h), h]));
  const mappings: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  for (const [field, aliases] of Object.entries(config.aliases)) {
    const found = aliases
      .map(normalizeHeader)
      .map((a) => byNorm.get(a))
      .find((header) => header && !usedHeaders.has(header) && isSafeSuggestedMapping(field, header, rows));
    if (found) mappings[found] = field;
    if (found) usedHeaders.add(found);
  }
  if (["customers", "vendors"].includes(importType) && !Object.values(mappings).includes("displayName")) {
    const nameHeader = findBestNameColumn(headers, rows, usedHeaders);
    if (nameHeader) mappings[nameHeader] = "displayName";
  }
  return mappings;
}

export function normalizeMappings(importType: QuickBooksImportType, headers: string[], rows: CsvRow[], mappings: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [header, field] of Object.entries(mappings)) {
    if (headers.includes(header) && field) normalized[header] = field;
  }

  const warnings: string[] = [];
  if (!["customers", "vendors"].includes(importType)) {
    return { mappings: normalized, warnings };
  }

  const displayNameHeaders = Object.entries(normalized)
    .filter(([, field]) => field === "displayName")
    .map(([header]) => header);
  if (!displayNameHeaders.length) {
    return { mappings: normalized, warnings };
  }

  const best = chooseBestDisplayNameHeader(importType, displayNameHeaders, rows);
  for (const header of displayNameHeaders) {
    delete normalized[header];
  }
  if (best) {
    normalized[best] = "displayName";
  }
  if (displayNameHeaders.length > 1 || displayNameHeaders.some(isForbiddenDisplayNameHeader)) {
    warnings.push(displayNameWarning(best));
  }

  return { mappings: normalized, warnings };
}

function chooseBestDisplayNameHeader(importType: QuickBooksImportType, headers: string[], rows: CsvRow[]): string | undefined {
  return headers
    .filter((header) => !isForbiddenDisplayNameHeader(header))
    .map((header) => ({
      header,
      score: displayNameHeaderPriority(importType, header) + columnRatio(columnValues(rows, header), looksLikeBusinessName)
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.header;
}

function displayNameWarning(header: string | undefined): string {
  return header
    ? `${DUPLICATE_DISPLAY_NAME_WARNING} We kept ${header} and ignored duplicate mappings.`
    : `${DUPLICATE_DISPLAY_NAME_WARNING} We ignored invalid duplicate mappings.`;
}

function displayNameHeaderPriority(importType: QuickBooksImportType, header: string): number {
  const customerPriorities: Record<string, number> = {
    customer: 100,
    displayname: 95,
    customername: 90,
    name: 85,
    company: 80,
    companyname: 75,
    fullname: 60
  };
  const vendorPriorities: Record<string, number> = {
    supplier: 100,
    suppliername: 95,
    vendor: 90,
    vendorname: 85,
    displayname: 80,
    name: 75,
    fullname: 60,
    company: 50,
    companyname: 45
  };
  return (importType === "customers" ? customerPriorities : vendorPriorities)[normalizeHeader(header)] ?? 0;
}

function isForbiddenDisplayNameHeader(header: string): boolean {
  return [
    "address",
    "mailingaddress",
    "billingaddress",
    "shippingaddress",
    "street",
    "streetaddress",
    "accountno",
    "accountnumber",
    "acctno",
    "phone",
    "phonenumber",
    "phonenumbers",
    "email",
    "emailaddress",
    "balance",
    "openbalance"
  ].includes(normalizeHeader(header));
}

export function normalizeCurrency(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const negative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[,$()\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return round2(negative ? -n : n);
}

export function normalizeDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, month, day, year] = m;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function executeQuickBooksImport(
  importType: QuickBooksImportType,
  headers: string[],
  rows: CsvRow[],
  mappings: Record<string, string>,
  actorUserId?: string
): Promise<ImportResult> {
  const effectiveMappings = normalizeMappings(importType, headers, rows, mappings).mappings;
  const { mappedRows, skippedRows, skippedEmptyRows } = cleanRowsForImport(importType, rows, effectiveMappings);
  const validationErrors = validateMappedRows(importType, mappedRows, effectiveMappings);
  if (validationErrors.length) {
    return {
      importType,
      created: 0,
      skipped: skippedRows,
      skippedEmptyRows,
      duplicates: 0,
      validationErrors: validationErrors.slice(0, MAX_VALIDATION_ERRORS),
      validationErrorCount: validationErrors.length
    };
  }

  let created = 0;
  let duplicates = 0;
  let skipped = skippedRows;

  for (const row of mappedRows) {
    const imported = await importRow(importType, row);
    if (imported === "created") created += 1;
    if (imported === "duplicate") duplicates += 1;
    if (imported === "skipped") skipped += 1;
  }

  if (created > 0) {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ?? null,
        action: "quickbooks.accounting_import",
        entityType: "AccountingImport",
        entityId: null,
        metadata: { importType, created, skipped, duplicates } as Prisma.InputJsonValue
      }
    });
  }

  return { importType, created, skipped, skippedEmptyRows, duplicates, validationErrors: [], validationErrorCount: 0 };
}

export function validateMappedRows(importType: QuickBooksImportType, rows: CsvRow[], mappings: Record<string, string>): RowError[] {
  const config = configs[importType];
  const errors: RowError[] = [];
  const mappedFields = new Set(Object.values(mappings));
  if (["customers", "vendors"].includes(importType) && !mappedFields.has("displayName")) {
    return [{ rowNumber: 0, message: "We could not find a supplier/vendor name column. Please choose which column contains the supplier name." }];
  }
  rows.forEach((row, index) => {
    const rowNumber = Number(row[SOURCE_ROW_NUMBER]) || index + 2;
    for (const field of config.required) {
      if (!row[field]?.trim()) {
        errors.push({ rowNumber, message: `${title(field)} is required.` });
      }
    }
    for (const field of ["issueDate", "dueDate", "billDate", "expenseDate", "paymentDate", "depositDate"]) {
      if (row[field] && !normalizeDate(row[field])) {
        errors.push({ rowNumber, message: `${title(field)} is not a valid date.` });
      }
    }
  });
  return errors;
}

function applyMappings(row: CsvRow, mappings: Record<string, string>): CsvRow {
  const mapped: CsvRow = {};
  if (row[SOURCE_ROW_NUMBER]) mapped[SOURCE_ROW_NUMBER] = row[SOURCE_ROW_NUMBER];
  for (const [header, field] of Object.entries(mappings)) {
    mapped[field] = sanitizeCell(row[header] ?? "");
  }
  return mapped;
}

export function cleanRowsForImport(importType: QuickBooksImportType, rows: CsvRow[], mappings: Record<string, string>) {
  const sourceRows: CsvRow[] = [];
  const mappedRows: CsvRow[] = [];
  let skippedRows = 0;
  let skippedEmptyRows = 0;

  rows.forEach((sourceRow) => {
    const cleanedSourceRow = cleanSourceRow(sourceRow);
    const mappedRow = cleanMappedRow(importType, applyMappings(cleanedSourceRow, mappings));
    if (shouldSkipMappedRow(importType, mappedRow)) {
      skippedRows += 1;
      skippedEmptyRows += 1;
      return;
    }
    sourceRows.push(cleanedSourceRow);
    mappedRows.push(mappedRow);
  });

  return { sourceRows, mappedRows, skippedRows, skippedEmptyRows };
}

function cleanSourceRow(row: CsvRow): CsvRow {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, key === SOURCE_ROW_NUMBER ? value : sanitizeCell(value)]));
}

function shouldSkipMappedRow(importType: QuickBooksImportType, row: CsvRow): boolean {
  if (!["customers", "vendors"].includes(importType)) return false;
  const values = Object.entries(row)
    .filter(([key]) => key !== SOURCE_ROW_NUMBER)
    .map(([, value]) => sanitizeCell(value))
    .filter(Boolean);
  if (!values.length) return true;
  if (sanitizeCell(row.displayName)) return false;
  return values.every(isFormattingOrFooterValue);
}

function cleanMappedRow(importType: QuickBooksImportType, row: CsvRow): CsvRow {
  if (!["customers", "vendors"].includes(importType)) return row;
  const cleaned = { ...row };
  cleaned.displayName = sanitizeCell(cleaned.displayName);
  cleaned.companyName = sanitizeCell(cleaned.companyName);
  cleaned.email = looksLikeEmail(cleaned.email ?? "") ? sanitizeCell(cleaned.email) : "";
  cleaned.phone = looksLikePhone(cleaned.phone ?? "") ? sanitizeCell(cleaned.phone) : "";
  cleaned.billingAddress = sanitizeCell(cleaned.billingAddress);
  cleaned.shippingAddress = sanitizeCell(cleaned.shippingAddress);
  cleaned.mailingAddress = sanitizeCell(cleaned.mailingAddress);
  return cleaned;
}

function isFormattingOrFooterValue(value: string): boolean {
  const text = value.toLowerCase();
  return (
    text === "" ||
    text === "total" ||
    text.startsWith("total ") ||
    text.startsWith("page ") ||
    text.includes("quickbooks") ||
    text.includes("intuit") ||
    text.includes("accrual basis") ||
    text.includes("cash basis") ||
    text.includes("generated") ||
    text.includes("report")
  );
}

async function importRow(importType: QuickBooksImportType, row: CsvRow): Promise<"created" | "duplicate" | "skipped"> {
  switch (importType) {
    case "customers":
      return importCustomer(row);
    case "vendors":
      return importSupplier(row);
    case "accounts":
      return importAccount(row);
    case "products":
      return importProduct(row);
    case "invoices":
      return importInvoice(row);
    case "bills":
      return importBill(row);
    case "expenses":
      return importExpense(row);
    case "payments":
      return importPayment(row);
    case "deposits":
      return importDeposit(row);
  }
}

async function importCustomer(row: CsvRow) {
  const displayName = sanitizeCell(row.displayName);
  const email = looksLikeEmail(row.email ?? "") ? sanitizeCell(row.email) : "";
  const phone = looksLikePhone(row.phone ?? "") ? sanitizeCell(row.phone) : "";
  if (!displayName) return "skipped";
  if (email && (await prisma.customer.findFirst({ where: { email } }))) return "duplicate";
  if (await prisma.customer.findFirst({ where: { displayName } })) return "duplicate";
  await prisma.customer.create({
    data: {
      orgId: requireOrgId(),
      displayName,
      companyName: row.companyName ?? "",
      email,
      phone,
      billingAddress: row.billingAddress ?? "",
      notes: customerImportNotes(row)
    }
  });
  return "created";
}

async function importSupplier(row: CsvRow) {
  const displayName = sanitizeCell(row.displayName);
  const email = looksLikeEmail(row.email ?? "") ? sanitizeCell(row.email) : "";
  const phone = looksLikePhone(row.phone ?? "") ? sanitizeCell(row.phone) : "";
  if (!displayName) return "skipped";
  if (email && (await prisma.supplier.findFirst({ where: { email } }))) return "duplicate";
  if (await prisma.supplier.findFirst({ where: { displayName } })) return "duplicate";
  await prisma.supplier.create({
    data: {
      orgId: requireOrgId(),
      displayName,
      companyName: row.companyName ?? "",
      email,
      phone,
      mailingAddress: row.mailingAddress ?? "",
      notes: noteOpeningBalance(row.openingBalance)
    }
  });
  return "created";
}

async function importAccount(row: CsvRow) {
  const name = row.name;
  const type = parseAccountType(row.type);
  if (!type) return "skipped";
  const existing = await prisma.account.findFirst({ where: { name, type } });
  if (existing) return "duplicate";
  const code = row.code || (await nextAccountCode(type));
  const codeClash = await prisma.account.findFirst({ where: { code } });
  await prisma.account.create({
    data: {
      orgId: requireOrgId(),
      code: codeClash ? await nextAccountCode(type) : code,
      name,
      type,
      subtype: row.subtype ?? "",
      description: noteOpeningBalance(row.openingBalance)
    }
  });
  return "created";
}

async function importProduct(row: CsvRow) {
  const name = row.name;
  const sku = row.sku || safeSku(name);
  const existing = await prisma.product.findFirst({ where: { OR: [{ sku }, { name }] } });
  if (existing) return "duplicate";
  const incomeAccount = await findOrCreateAccount(row.incomeAccountName || "Sales", AccountType.revenue);
  await prisma.product.create({
    data: {
      orgId: requireOrgId(),
      sku,
      name,
      kind: parseProductKind(row.kind),
      description: row.description ?? "",
      salesPrice: normalizeCurrency(row.salesPrice),
      incomeAccountId: incomeAccount.id
    }
  });
  return "created";
}

async function importInvoice(row: CsvRow) {
  const number = row.number;
  if (await prisma.invoice.findFirst({ where: { number } })) return "duplicate";
  const customer = await findOrCreateCustomer(row.customerName);
  const incomeAccount = await findOrCreateAccount("Sales", AccountType.revenue);
  const issueDate = normalizeDate(row.issueDate) ?? new Date();
  const dueDate = normalizeDate(row.dueDate);
  const total = normalizeCurrency(row.total);
  const amountPaid = Math.max(0, total - normalizeCurrency(row.balance));
  await prisma.invoice.create({
    data: {
      orgId: requireOrgId(),
      number,
      customerId: customer.id,
      issueDate,
      dueDate,
      status: parseTransactionStatus(row.status),
      subtotal: total,
      total,
      amountPaid,
      balance: round2(total - amountPaid),
      lines: {
        create: [{
          orgId: requireOrgId(),
          position: 1,
          description: row.lineItemName || "QuickBooks import",
          quantity: 1,
          unitPrice: total,
          amount: total,
          incomeAccountId: incomeAccount.id
        }]
      }
    }
  });
  return "created";
}

async function importBill(row: CsvRow) {
  const number = row.number || (await nextBillNumber());
  const total = normalizeCurrency(row.total);
  const billDate = normalizeDate(row.billDate) ?? new Date();
  const existing = await prisma.bill.findFirst({
    where: { number, supplier: { displayName: row.supplierName }, billDate, total }
  });
  if (existing) return "duplicate";
  const supplier = await findOrCreateSupplier(row.supplierName);
  const expenseAccount = await findOrCreateAccount("Cost of Goods Sold", AccountType.expense);
  await prisma.bill.create({
    data: {
      orgId: requireOrgId(),
      number,
      supplierId: supplier.id,
      billDate,
      dueDate: normalizeDate(row.dueDate),
      status: parseTransactionStatus(row.status),
      subtotal: total,
      total,
      balance: normalizeCurrency(row.balance) || total,
      lines: {
        create: [{ orgId: requireOrgId(), position: 1, description: "QuickBooks import", quantity: 1, unitCost: total, amount: total, expenseAccountId: expenseAccount.id }]
      }
    }
  });
  return "created";
}

async function importExpense(row: CsvRow) {
  const amount = normalizeCurrency(row.amount);
  const expenseDate = normalizeDate(row.expenseDate) ?? new Date();
  const paymentAccount = await findOrCreateAccount(row.paymentAccountName || "Checking", AccountType.asset);
  const existing = await prisma.expense.findFirst({ where: { expenseDate, payeeName: row.payeeName, total: amount, paymentAccountId: paymentAccount.id } });
  if (existing) return "duplicate";
  const expenseAccount = await findOrCreateAccount(row.categoryName || "General Expenses", AccountType.expense);
  await prisma.expense.create({
    data: {
      orgId: requireOrgId(),
      number: await nextExpenseNumber(),
      expenseDate,
      payeeName: row.payeeName,
      memo: row.memo ?? "",
      paymentAccountId: paymentAccount.id,
      subtotal: amount,
      total: amount,
      status: TransactionStatus.open,
      lines: { create: [{ orgId: requireOrgId(), position: 1, description: row.memo ?? "", quantity: 1, unitCost: amount, amount, expenseAccountId: expenseAccount.id }] }
    }
  });
  return "created";
}

async function importPayment(row: CsvRow) {
  const amount = normalizeCurrency(row.amount);
  const paymentDate = normalizeDate(row.paymentDate) ?? new Date();
  const reference = row.reference ?? "";
  const customer = await findOrCreateCustomer(row.customerName);
  const existing = await prisma.payment.findFirst({ where: { reference, paymentDate, customerId: customer.id, amount } });
  if (existing) return "duplicate";
  const depositAccount = await findOrCreateAccount(row.depositAccountName || "Undeposited Funds", AccountType.asset);
  await prisma.payment.create({
    data: {
      orgId: requireOrgId(),
      number: reference || (await nextPaymentNumber()),
      customerId: customer.id,
      paymentDate,
      method: parsePaymentMethod(row.method),
      reference,
      amount,
      unapplied: amount,
      depositAccountId: depositAccount.id
    }
  });
  return "created";
}

async function importDeposit(row: CsvRow) {
  const total = normalizeCurrency(row.amount);
  const depositDate = normalizeDate(row.depositDate) ?? new Date();
  const bankAccount = await findOrCreateAccount(row.accountName, AccountType.asset);
  const existing = await prisma.deposit.findFirst({ where: { depositDate, bankAccountId: bankAccount.id, total } });
  if (existing) return "duplicate";
  await prisma.deposit.create({
    data: {
      orgId: requireOrgId(),
      number: await nextDepositNumber(),
      depositDate,
      memo: [row.receivedFrom, row.memo].filter(Boolean).join(" - "),
      bankAccountId: bankAccount.id,
      total,
      status: TransactionStatus.open,
      lines: { create: [{ orgId: requireOrgId(), position: 1, description: row.receivedFrom || row.memo || "QuickBooks import", amount: total }] }
    }
  });
  return "created";
}

function sanitizeText(value: unknown): string {
  return String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function sanitizeCell(value: unknown): string {
  const text = sanitizeText(value);
  return isDashOnlyValue(text) ? "" : text;
}

function isDashOnlyValue(value: string): boolean {
  return /^[\s\-\u2010-\u2015\u2212]+$/.test(value);
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSafeSuggestedMapping(field: string, header: string, rows: CsvRow[]): boolean {
  const values = columnValues(rows, header);
  if (field === "displayName") {
    return values.length > 0 && columnRatio(values, looksLikeBusinessName) >= 0.5;
  }
  if (field === "email") {
    return values.length === 0 || columnRatio(values, looksLikeEmail) >= 0.6;
  }
  if (field === "phone") {
    return values.length === 0 || columnRatio(values, looksLikePhone) >= 0.6;
  }
  if (field === "billingAddress" || field === "mailingAddress" || field === "shippingAddress") {
    if (values.length === 0) return true;
    const addressRatio = columnRatio(values, looksLikeAddress);
    const nameRatio = columnRatio(values, looksLikeBusinessName);
    return addressRatio >= 0.4 || (isAddressHeader(header) && nameRatio < 0.5);
  }
  return true;
}

function findBestNameColumn(headers: string[], rows: CsvRow[], usedHeaders: Set<string>): string | undefined {
  return headers
    .filter((header) => !usedHeaders.has(header))
    .map((header) => ({ header, score: scoreNameColumn(header, columnValues(rows, header)) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)[0]?.header;
}

function scoreNameColumn(header: string, values: string[]): number {
  if (!values.length) return 0;
  const nameRatio = columnRatio(values, looksLikeBusinessName);
  const badRatio = columnRatio(values, (value) => looksLikeEmail(value) || looksLikePhone(value) || looksLikeAccountNumber(value));
  if (nameRatio < 0.5 || badRatio > 0.3) return 0;
  return nameRatio + (isPrimaryNameHeader(header) ? 1 : 0);
}

function columnValues(rows: CsvRow[], header: string): string[] {
  return rows.map((row) => sanitizeCell(row[header] ?? "")).filter(Boolean);
}

function columnRatio(values: string[], predicate: (value: string) => boolean): number {
  const present = values.map(sanitizeCell).filter(Boolean);
  if (!present.length) return 0;
  return present.filter(predicate).length / present.length;
}

function isMostlyEmptyDashOrIndex(values: string[]): boolean {
  const present = values.map(sanitizeText).filter(Boolean);
  if (!present.length) return true;
  const emptyDashOrIndex = present.filter((value, index) => sanitizeCell(value) === "" || /^\d+$/.test(value) && Number(value) === index + 1);
  return emptyDashOrIndex.length / present.length >= 0.8;
}

function isPrimaryNameHeader(header: string): boolean {
  return ["supplier", "suppliername", "vendor", "vendorname", "name", "displayname", "company", "companyname", "fullname", "customer", "customername"].includes(normalizeHeader(header));
}

function isAddressHeader(header: string): boolean {
  return normalizeHeader(header).includes("address") || normalizeHeader(header).includes("street");
}

function looksLikeEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function looksLikePhone(value: string): boolean {
  const text = value.trim();
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7) return false;
  return /^[\d\s()+\-.]+(?:\s*(?:x|ext\.?)\s*\d+)?$/i.test(text);
}

function looksLikeAddress(value: string): boolean {
  const text = value.toLowerCase();
  if (looksLikeEmail(value) || looksLikePhone(value)) return false;
  return /\d/.test(text) && /\b(st|street|rd|road|ave|avenue|dr|drive|ln|lane|blvd|boulevard|ct|court|plaza|suite|ste|unit|apt|po box|p\.o\.)\b/.test(text);
}

function looksLikeAccountNumber(value: string): boolean {
  const text = value.trim();
  return /^[A-Z0-9-]{4,}$/i.test(text) && !/[aeiou]/i.test(text);
}

function looksLikeBusinessName(value: string): boolean {
  const text = value.trim();
  if (!/[A-Za-z]/.test(text)) return false;
  if (looksLikeEmail(text) || looksLikePhone(text) || looksLikeAddress(text) || looksLikeAccountNumber(text)) return false;
  if (/^\d+(?:\.\d+)?$/.test(text)) return false;
  return true;
}

function title(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function parseAccountType(value: string | undefined): AccountType | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("bank") || v.includes("asset") || v.includes("receivable")) return AccountType.asset;
  if (v.includes("liability") || v.includes("payable") || v.includes("credit card")) return AccountType.liability;
  if (v.includes("equity")) return AccountType.equity;
  if (v.includes("income") || v.includes("revenue") || v.includes("sales")) return AccountType.revenue;
  if (v.includes("expense") || v.includes("cost")) return AccountType.expense;
  return null;
}

function parseProductKind(value: string | undefined): ProductKind {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("bundle")) return ProductKind.bundle;
  if (v.includes("product") || v.includes("inventory")) return ProductKind.product;
  return ProductKind.service;
}

function parsePaymentMethod(value: string | undefined): PaymentMethod {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("check") || v.includes("cheque")) return PaymentMethod.check;
  if (v.includes("card") || v.includes("credit")) return PaymentMethod.card;
  if (v.includes("ach") || v.includes("bank")) return PaymentMethod.ach;
  if (v.includes("cash")) return PaymentMethod.cash;
  return PaymentMethod.other;
}

function parseTransactionStatus(value: string | undefined): TransactionStatus {
  const v = String(value ?? "").trim().toLowerCase();
  if (v.includes("paid") || v.includes("closed")) return TransactionStatus.paid;
  if (v.includes("partial")) return TransactionStatus.partial;
  if (v.includes("void") || v.includes("cancel")) return TransactionStatus.void;
  if (v.includes("open") || v.includes("sent") || v.includes("unpaid")) return TransactionStatus.open;
  return TransactionStatus.draft;
}

function noteOpeningBalance(value: string | undefined): string {
  if (!value) return "";
  const amount = normalizeCurrency(value);
  return amount ? `QuickBooks opening balance: ${amount.toFixed(2)}` : "";
}

function customerImportNotes(row: CsvRow): string {
  return [noteOpeningBalance(row.openingBalance), row.shippingAddress ? `QuickBooks shipping address: ${row.shippingAddress}` : ""]
    .filter(Boolean)
    .join("\n");
}

function safeSku(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || `QB-${Date.now()}`;
}

async function nextAccountCode(type: AccountType): Promise<string> {
  const base = { asset: 1000, liability: 2000, equity: 3000, revenue: 4000, expense: 5000 }[type];
  const latest = await prisma.account.findFirst({
    where: { code: { startsWith: String(base).slice(0, 1) } },
    orderBy: { code: "desc" },
    select: { code: true }
  });
  const next = latest ? Number(latest.code.replace(/\D/g, "")) + 1 : base;
  return String(Number.isFinite(next) ? next : base);
}

async function findOrCreateAccount(name: string, type: AccountType) {
  const displayName = sanitizeText(name) || (type === AccountType.revenue ? "Sales" : type === AccountType.expense ? "General Expenses" : "Checking");
  const existing = await prisma.account.findFirst({ where: { name: displayName, type } });
  if (existing) return existing;
  return prisma.account.create({ data: { orgId: requireOrgId(), code: await nextAccountCode(type), name: displayName, type } });
}

async function findOrCreateCustomer(displayName: string) {
  const name = sanitizeText(displayName);
  const existing = await prisma.customer.findFirst({ where: { displayName: name } });
  return existing ?? prisma.customer.create({ data: { orgId: requireOrgId(), displayName: name } });
}

async function findOrCreateSupplier(displayName: string) {
  const name = sanitizeText(displayName);
  const existing = await prisma.supplier.findFirst({ where: { displayName: name } });
  return existing ?? prisma.supplier.create({ data: { orgId: requireOrgId(), displayName: name } });
}
