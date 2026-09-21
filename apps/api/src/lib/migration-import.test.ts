import assert from "node:assert/strict";
import test from "node:test";
import {
  buildErrorReportCsv,
  CUTOVER_EXCLUDED_TYPES,
  deriveSourceRef,
  groupInvoiceRows,
  inferImportTypeFromName,
  invoiceLinesFromGroup,
  mappingTemplateCsv,
  sha256Hex,
  signedOpeningBalance,
  sniffUpload,
  suggestB18Mappings,
  typeDisposition
} from "./migration-import.js";
import { buildOpeningBalanceJournal, validateJournalLines } from "./gl-posting.js";

test("sha256Hex is stable and content-sensitive", () => {
  const a = sha256Hex(Buffer.from("hello"));
  assert.equal(a, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  assert.notEqual(sha256Hex(Buffer.from("hello!")), a);
});

test("sniffUpload accepts CSV text and rejects empty/non-UTF8", () => {
  assert.equal(sniffUpload("customers.csv", Buffer.from("Name\nAcme\n")).kind, "csv");
  assert.throws(() => sniffUpload("customers.csv", Buffer.alloc(0)), /empty/i);
  assert.throws(() => sniffUpload("customers.csv", Buffer.from([0xff, 0xfe, 0x41])), /UTF-8/i);
});

test("sniffUpload detects xlsx by PK magic, rejects macro workbooks and mismatched names", () => {
  const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("fake-zip-bytes")]);
  assert.equal(sniffUpload("data.xlsx", xlsx).kind, "xlsx");
  const macro = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("xl/vbaProject.bin")]);
  assert.throws(() => sniffUpload("data.xlsx", macro), /Macro/i);
  assert.throws(() => sniffUpload("data.csv", xlsx), /\.xlsx/);
  assert.throws(() => sniffUpload("evil.xlsm", xlsx), /not accepted/i);
  assert.throws(() => sniffUpload("data.xlsx", Buffer.from("plain text")), /not a valid Excel/i);
});

test("deriveSourceRef is stable, prefers explicit ids, and distinguishes types", () => {
  const row = { displayName: "  Acme  Corp " };
  assert.equal(deriveSourceRef("quickbooks", "customers", row), "quickbooks:customers:acme corp");
  assert.equal(deriveSourceRef("quickbooks", "customers", row), deriveSourceRef("quickbooks", "customers", { displayName: "ACME CORP" }));
  assert.notEqual(deriveSourceRef("quickbooks", "customers", row), deriveSourceRef("quickbooks", "vendors", row));
  assert.equal(deriveSourceRef("quickbooks", "customers", { ...row, sourceId: "QB-42" }), "quickbooks:customers:QB-42");
  assert.equal(
    deriveSourceRef("quickbooks", "payments", { customerName: "Acme", paymentDate: "01/05/2026", amount: "100.00", reference: "R1" }),
    "quickbooks:payments:acme:01/05/2026:100.00:r1"
  );
});

test("groupInvoiceRows preserves multi-line invoices in order", () => {
  const rows = [
    { number: "1001", lineItemName: "Wash", total: "50" },
    { number: "1002", lineItemName: "Dry", total: "80" },
    { number: "1001", lineItemName: "Fold", total: "50" }
  ];
  const groups = groupInvoiceRows(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].number, "1001");
  assert.equal(groups[0].rows.length, 2);
});

test("invoiceLinesFromGroup uses lineAmount when present, else summary line", () => {
  const withLines = invoiceLinesFromGroup([
    { number: "1", lineItemName: "Wash", lineAmount: "30.00", total: "55.00" },
    { number: "1", lineItemName: "Fold", lineAmount: "25.00", total: "55.00" }
  ]);
  assert.equal(withLines.usedLineAmounts, true);
  assert.equal(withLines.total, 55);
  assert.deepEqual(withLines.lines.map((l) => l.amount), [30, 25]);

  const summary = invoiceLinesFromGroup([{ number: "2", lineItemName: "Wash", total: "40.00" }]);
  assert.equal(summary.usedLineAmounts, false);
  assert.equal(summary.total, 40);
  assert.equal(summary.lines.length, 1);
});

test("signedOpeningBalance: assets/expenses debit-normal, others credit-normal", () => {
  assert.equal(signedOpeningBalance("asset", 100), 100);
  assert.equal(signedOpeningBalance("expense", 100), 100);
  assert.equal(signedOpeningBalance("liability", 100), -100);
  assert.equal(signedOpeningBalance("equity", 100), -100);
  assert.equal(signedOpeningBalance("revenue", 100), -100);
});

test("buildOpeningBalanceJournal balances against Opening Balance Equity", () => {
  const j = buildOpeningBalanceJournal({
    batchId: "batch1",
    asOfDate: new Date("2026-01-01T00:00:00Z"),
    openingBalanceEquityAccountId: "obe",
    entries: [
      { accountId: "cash", code: "1000", name: "Cash", balance: 5000 },
      { accountId: "loan", code: "2100", name: "Loan", balance: -2000 }
    ]
  });
  const lines = validateJournalLines(j.lines);
  const debits = lines.reduce((s, l) => s + l.debit, 0);
  const credits = lines.reduce((s, l) => s + l.credit, 0);
  assert.equal(debits, credits);
  assert.equal(lines.find((l) => l.accountId === "obe")?.credit, 3000);
  assert.equal(j.sourceType, "migration_opening_balance");

  const creditHeavy = buildOpeningBalanceJournal({
    batchId: "b2",
    asOfDate: new Date(),
    openingBalanceEquityAccountId: "obe",
    entries: [{ accountId: "loan", code: "2100", name: "Loan", balance: -900 }]
  });
  const l2 = validateJournalLines(creditHeavy.lines);
  assert.equal(l2.find((l) => l.accountId === "obe")?.debit, 900);
});

test("buildErrorReportCsv escapes and lists invalid rows", () => {
  const csv = buildErrorReportCsv([
    { fileName: "in.csv", rowIndex: 3, errorMessage: 'Customer "X" not found', payloadJson: { a: "1,2" } }
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "file,row,error,payload");
  assert.match(lines[1], /^in\.csv,3,"Customer ""X"" not found","/);
});

test("mappingTemplateCsv covers every import type", () => {
  for (const t of ["customers", "vendors", "accounts", "products", "invoices", "bills", "expenses", "payments", "deposits", "opening_balances"] as const) {
    const csv = mappingTemplateCsv(t);
    assert.ok(csv.trim().length > 0);
    if (t === "payments") assert.ok(csv.includes("invoiceNumber"));
    if (t === "invoices") assert.ok(csv.includes("lineAmount"));
  }
});

test("typeDisposition classifies every B18 type", () => {
  assert.equal(typeDisposition("invoices"), "importable");
  assert.equal(typeDisposition("journal_entries"), "importable");
  assert.equal(typeDisposition("bill_payments"), "importable");
  assert.equal(typeDisposition("sales_receipts"), "importable");
  assert.equal(typeDisposition("transfers"), "importable");
  assert.equal(typeDisposition("estimates"), "archived");
  assert.equal(typeDisposition("classes"), "archived");
  assert.equal(typeDisposition("attachment"), "archived");
  assert.equal(typeDisposition("credit_memos"), "unsupported");
  assert.ok(CUTOVER_EXCLUDED_TYPES.includes("payments"));
  assert.ok(CUTOVER_EXCLUDED_TYPES.includes("journal_entries"));
  assert.ok(!CUTOVER_EXCLUDED_TYPES.includes("invoices"));
});

test("inferImportTypeFromName matches longest type first and refuses unknown", () => {
  assert.equal(inferImportTypeFromName("bill_payments.csv"), "bill_payments");
  assert.equal(inferImportTypeFromName("bills.csv"), "bills");
  assert.equal(inferImportTypeFromName("exports/invoices_2026.csv"), "invoices");
  assert.equal(inferImportTypeFromName("opening_balances_qbo.xlsx"), "opening_balances");
  assert.equal(inferImportTypeFromName("journal_entries-Sept.csv"), "journal_entries");
  assert.equal(inferImportTypeFromName("receipt-123.pdf"), null);
  assert.equal(inferImportTypeFromName("random_data.csv"), null);
});

test("suggestB18Mappings maps headers by alias without reuse", () => {
  const m = suggestB18Mappings("bill_payments", ["Date", "Vendor", "Amount", "Bank Account", "Bill No."]);
  assert.equal(m["Date"], "paymentDate");
  assert.equal(m["Vendor"], "supplierName");
  assert.equal(m["Amount"], "amount");
  assert.equal(m["Bank Account"], "sourceAccountName");
  assert.equal(m["Bill No."], "billNumber");
});

test("deriveSourceRef covers B18 types", () => {
  assert.equal(deriveSourceRef("quickbooks", "transfers", { fromAccountName: "Checking", toAccountName: "Savings", transferDate: "01/01/2026", amount: "100" }),
    "quickbooks:transfers:checking:savings:01/01/2026:100");
  assert.equal(deriveSourceRef("quickbooks", "journal_entries", { number: "JE-7" }), "quickbooks:journal_entries:je-7");
  assert.equal(deriveSourceRef("quickbooks", "sales_receipts", { number: "SR-1" }), "quickbooks:sales_receipts:sr-1");
});
