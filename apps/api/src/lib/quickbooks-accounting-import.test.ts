import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImportPlan,
  normalizeCurrency,
  normalizeDate,
  parseCsv,
  parseExcel
} from "./quickbooks-accounting-import.js";
import { strToU8, zipSync } from "fflate";

function xmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function xlsxBuffer(rows: string[][]): Buffer {
  const sheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const files = {
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": strToU8('<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Accounting export" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`)
  };
  return Buffer.from(zipSync(files));
}

test("parseCsv handles quoted commas and ignores blank rows", () => {
  const rows = parseCsv('Display Name,Email,Billing Address\n"Acme, Inc.",a@example.com,"1 Main St"\n,,\n');
  assert.deepEqual(rows.headers, ["Display Name", "Email", "Billing Address"]);
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0]?.["Display Name"], "Acme, Inc.");
});

test("buildImportPlan maps QuickBooks customer columns and validates required fields", () => {
  const parsed = parseCsv("Display Name,Company,Email\nAcme,Acme LLC,a@example.com\n,Missing,m@example.com\n");
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows);
  assert.equal(plan.mappings["Display Name"], "displayName");
  assert.equal(plan.previewRows.length, 2);
  assert.equal(plan.validationErrors.length, 1);
  assert.equal(plan.validationErrors[0]?.rowNumber, 3);
  assert.match(plan.validationErrors[0]?.message ?? "", /Display name/i);
});

test("customer imports prefer Customer as the only display name mapping", () => {
  const parsed = parseCsv("Customer,Full Name,Email,Billing Address,Shipping Address,Account No.\nBelize Bay Resort,Belize Bay Resort,stay@example.com,1 Front St,2 Dock Rd,1001\n");
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows, {
    Customer: "displayName",
    "Full Name": "displayName",
    "Billing Address": "displayName",
    "Shipping Address": "displayName",
    "Account No.": "displayName",
    Email: "email"
  });

  assert.equal(plan.mappings["Customer"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Billing Address"], undefined);
  assert.equal(plan.mappings["Shipping Address"], undefined);
  assert.equal(plan.mappings["Account No."], undefined);
  assert.equal(plan.validationErrors.length, 0);
  assert.match(plan.warnings.join(" "), /kept Customer/i);
});

test("customer imports map billing and shipping addresses separately", () => {
  const parsed = parseCsv("Customer,Full Name,Email,Billing Address,Shipping Address\nBelize Bay Resort,Belize Bay Resort,stay@example.com,1 Front St,2 Dock Rd\n");
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Customer"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Billing Address"], "billingAddress");
  assert.equal(plan.mappings["Shipping Address"], "shippingAddress");
  assert.equal(plan.validationErrors.length, 0);
});

test("customer imports do not auto-map Full Name when Customer exists", () => {
  const parsed = parseCsv("Customer,Full Name,Phone Numbers,Email,Billing Address,Shipping Address\nBelize Bay Resort,Parent Customer,555-7777,stay@example.com,1 Front St,2 Dock Rd\n");
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Customer"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Phone Numbers"], "phone");
  assert.equal(plan.mappings["Email"], "email");
  assert.equal(plan.mappings["Billing Address"], "billingAddress");
  assert.equal(plan.mappings["Shipping Address"], "shippingAddress");
  assert.equal(plan.validationErrors.length, 0);
});

test("customer imports do not map non-contact values as phone or email", () => {
  const parsed = parseCsv("Customer,Phone Numbers,Email,Billing Address\nAcme Customer,Acme Customer,not-an-email,1 Front St\nBeta Customer,Beta Customer,Beta Customer,2 Main St\n");
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Customer"], "displayName");
  assert.equal(plan.mappings["Phone Numbers"], undefined);
  assert.equal(plan.mappings["Email"], undefined);
  assert.equal(plan.mappings["Billing Address"], "billingAddress");
  assert.equal(plan.validationErrors.length, 0);
});

test("customer imports ignore trailing QuickBooks footer rows before validation", () => {
  const validRows = Array.from({ length: 177 }, (_, index) => `Customer ${index + 1},,,`).join("\n");
  const parsed = parseCsv(`Customer,Phone Numbers,Email,Billing Address\n${validRows}\n,QuickBooks report generated,,\n`);
  const plan = buildImportPlan("customers", parsed.headers, parsed.rows);

  assert.equal(plan.rowCount, 177);
  assert.equal(plan.previewRows.length, 25);
  assert.equal(plan.validationErrors.length, 0);
  assert.match(plan.warnings.join(" "), /empty rows/i);
});

test("parseCsv skips QuickBooks report title rows and dash-only rows", () => {
  const parsed = parseCsv("Supplier Contact List\n\nDisplay Name,Primary Email,Primary Phone,Open Balance\nSupplier One,one@example.com,555-1111,12.50\n-,-,-,-\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);
  assert.deepEqual(parsed.headers, ["Display Name", "Primary Email", "Primary Phone", "Open Balance"]);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.["Display Name"], "Supplier One");
  assert.equal(plan.mappings["Display Name"], "displayName");
  assert.equal(plan.mappings["Primary Email"], "email");
  assert.equal(plan.mappings["Primary Phone"], "phone");
  assert.equal(plan.mappings["Open Balance"], "openingBalance");
  assert.equal(plan.validationErrors.length, 0);
});

test("parseExcel reads the first worksheet and detects the real header row", async () => {
  const parsed = await parseExcel(xlsxBuffer([
    ["Supplier Contact List"],
    [""],
    ["Vendor Name", "Email Address", "Mobile", "Mailing Address", "Balance"],
    ["Excel Supplier", "excel@example.com", "555-2222", "2 Main St", "42.00"]
  ]));
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.["Vendor Name"], "Excel Supplier");
  assert.equal(plan.mappings["Vendor Name"], "displayName");
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports keep leading blank QuickBooks columns from shifting values", () => {
  const parsed = parseCsv("Supplier Contact List\n,Supplier,Phone Numbers,Email,Address\n-,Acme Supply,(555) 111-2222,acme@example.com,12 Main St\n-,Beta Services,555-3333,beta@example.com,34 Market Road\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows, undefined, parsed.warnings);

  assert.deepEqual(parsed.headers, ["Supplier", "Phone Numbers", "Email", "Address"]);
  assert.equal(parsed.rows[0]?.["Supplier"], "Acme Supply");
  assert.equal(parsed.rows[0]?.["Phone Numbers"], "(555) 111-2222");
  assert.equal(parsed.rows[0]?.["Address"], "12 Main St");
  assert.equal(plan.mappings["Supplier"], "displayName");
  assert.equal(plan.mappings["Phone Numbers"], "phone");
  assert.equal(plan.mappings["Email"], "email");
  assert.equal(plan.mappings["Address"], "mailingAddress");
  assert.match(plan.warnings[0] ?? "", /corrected the mapping automatically/i);
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports shift dash-only supplier values onto the real name column", () => {
  const parsed = parseCsv("Supplier,Phone Numbers,Email,Address\n-,Acme Supply,(555) 111-2222,12 Main St\n-,Beta Services,555-3333,34 Market Road\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows, undefined, parsed.warnings);

  assert.equal(parsed.rows[0]?.["Supplier"], "Acme Supply");
  assert.equal(parsed.rows[0]?.["Phone Numbers"], "(555) 111-2222");
  assert.equal(parsed.rows[0]?.["Email"], "12 Main St");
  assert.equal(plan.mappings["Supplier"], "displayName");
  assert.equal(plan.mappings["Phone Numbers"], "phone");
  assert.equal(plan.mappings["Email"], undefined);
  assert.match(plan.warnings[0] ?? "", /corrected the mapping automatically/i);
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports do not map business names as phone, email, or address values", () => {
  const parsed = parseCsv("Supplier,Phone Numbers,Email,Address\nAcme Supply,Acme Supply,Acme Supply,Acme Supply\nBeta Services,Beta Services,Beta Services,Beta Services\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Supplier"], "displayName");
  assert.equal(plan.mappings["Phone Numbers"], undefined);
  assert.equal(plan.mappings["Email"], undefined);
  assert.equal(plan.mappings["Address"], undefined);
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports keep only the best display name mapping", () => {
  const parsed = parseCsv("Supplier,Phone Numbers,Email,Full Name,Address,Account No.\nAeropost,-,-,Aeropost,-,-\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows, {
    Supplier: "displayName",
    "Full Name": "displayName",
    Address: "displayName",
    "Account No.": "displayName",
    "Phone Numbers": "phone",
    Email: "email"
  });

  assert.equal(plan.mappings["Supplier"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Address"], undefined);
  assert.equal(plan.mappings["Account No."], undefined);
  assert.equal(plan.validationErrors.length, 0);
  assert.match(plan.warnings.join(" "), /Only one column can be used as Display name/);
});

test("supplier imports do not auto-map Full Name, Address, or Account No. to display name when Supplier exists", () => {
  const parsed = parseCsv("Supplier,Phone Numbers,Email,Full Name,Address,Account No.\nAeropost,-,-,Aeropost,-,-\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Supplier"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Address"], "mailingAddress");
  assert.equal(plan.mappings["Account No."], undefined);
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports prefer Vendor as display name and ignore Full Name", () => {
  const parsed = parseCsv("Vendor,Full Name,Phone Numbers,Email,Billing Address\nCaribbean Supply,Parent Supplier,555-8888,supply@example.com,5 Dock St\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);

  assert.equal(plan.mappings["Vendor"], "displayName");
  assert.equal(plan.mappings["Full Name"], undefined);
  assert.equal(plan.mappings["Phone Numbers"], "phone");
  assert.equal(plan.mappings["Email"], "email");
  assert.equal(plan.mappings["Billing Address"], "mailingAddress");
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports clean dash variants before preview and validation", () => {
  const parsed = parseCsv("Supplier,Phone Numbers,Email,Address\nAcme Supply,—,–,-\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);

  assert.equal(plan.previewRows[0]?.["Supplier"], "Acme Supply");
  assert.equal(plan.previewRows[0]?.["Phone Numbers"], "");
  assert.equal(plan.previewRows[0]?.["Email"], "");
  assert.equal(plan.previewRows[0]?.["Address"], "");
  assert.equal(plan.validationErrors.length, 0);
});

test("supplier imports ignore trailing QuickBooks footer rows before validation", () => {
  const validRows = Array.from({ length: 75 }, (_, index) => `Supplier ${index + 1},,,`).join("\n");
  const parsed = parseCsv(`Supplier,Phone Numbers,Email,Address\n${validRows}\n,QuickBooks report generated,,\n`);
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);

  assert.equal(plan.rowCount, 75);
  assert.equal(plan.previewRows.length, 25);
  assert.equal(plan.validationErrors.length, 0);
  assert.match(plan.warnings.join(" "), /empty rows/i);
});

test("missing supplier name mapping shows one clear mapping error", () => {
  const parsed = parseCsv("Supplier Contact List\nEmail,Phone\nx@example.com,555-3333\n");
  const plan = buildImportPlan("vendors", parsed.headers, parsed.rows);
  assert.equal(plan.validationErrors.length, 1);
  assert.equal(plan.validationErrors[0]?.rowNumber, 0);
  assert.equal(plan.validationErrors[0]?.message, "We could not find a supplier/vendor name column. Please choose which column contains the supplier name.");
});

test("normalizers handle QuickBooks currency and dates", () => {
  assert.equal(normalizeCurrency(" $1,234.50 "), 1234.5);
  assert.equal(normalizeCurrency("(42.10)"), -42.1);
  assert.equal(normalizeDate("04/28/2026")?.toISOString().slice(0, 10), "2026-04-28");
});
