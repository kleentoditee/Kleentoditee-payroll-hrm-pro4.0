import assert from "node:assert/strict";
import test from "node:test";
import { buildRunItemsFromEntries } from "./payroll-run-builder.js";
import {
  YTD_IMPORT_TEMPLATE_CSV,
  parseYearInput,
  parseYtdImportCsv,
  planYtdImport,
  splitCsvRecords
} from "./payroll-ytd-import.js";

test("splitCsvRecords handles quotes, escaped quotes, and CRLF", () => {
  const records = splitCsvRecords('a,b\r\n"x,\r\ny","say ""hi"""\r\n1,2');
  assert.deepEqual(records, [["a", "b"], ["x,\r\ny", 'say "hi"'], ["1", "2"]]);
});

test("parseYtdImportCsv parses the template CSV", () => {
  const { rows, errors } = parseYtdImportCsv(YTD_IMPORT_TEMPLATE_CSV);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  const [row] = rows;
  assert.equal(row.email, "maria@example.com");
  assert.equal(row.employeeName, "Maria Example");
  assert.equal(row.amounts.gross, 12450);
  assert.equal(row.amounts.nhi, 373.5);
  assert.equal(row.amounts.employerPayrollTax, 622.5);
  assert.equal(row.notes, "Imported from legacy payroll");
  assert.deepEqual(row.errors, []);
});

test("parseYtdImportCsv requires a gross column and rejects empty input", () => {
  assert.ok(parseYtdImportCsv("").errors.length > 0);
  assert.ok(parseYtdImportCsv("email,nhi\na@b.c,10").errors.some((e) => e.includes("gross")));
  assert.ok(parseYtdImportCsv("gross,nhi\n100,10").errors.some((e) => e.includes("email")));
});

test("parseYtdImportCsv flags row-level amount errors", () => {
  const { rows } = parseYtdImportCsv("email,gross,nhi\na@b.c,,5\nb@c.d,-10,x\n");
  assert.equal(rows.length, 2);
  assert.ok(rows[0].errors.some((e) => e.includes("gross is required")));
  assert.ok(rows[1].errors.some((e) => e.includes("gross cannot be negative")));
  assert.ok(rows[1].errors.some((e) => e.includes("nhi is not a number")));
});

test("parseYtdImportCsv accepts currency symbols and thousands separators", () => {
  const { rows } = parseYtdImportCsv("email,gross\na@b.c,\"$12,450.00\"\n");
  assert.equal(rows[0].amounts.gross, 12450);
  assert.deepEqual(rows[0].errors, []);
});

test("planYtdImport matches by email case-insensitively and flags overwrites", () => {
  const { rows } = parseYtdImportCsv("email,gross\nMARIA@example.com,9000\n");
  const planned = planYtdImport(
    rows,
    [{ id: "emp-1", fullName: "Maria Example", email: "maria@example.com" }],
    new Map([["emp-1", "bal-1"]])
  );
  assert.equal(planned[0].employeeId, "emp-1");
  assert.equal(planned[0].matchedEmployeeName, "Maria Example");
  assert.equal(planned[0].willOverwrite, true);
  assert.equal(planned[0].existingBalanceId, "bal-1");
  assert.deepEqual(planned[0].errors, []);
});

test("planYtdImport matches by exact name and rejects ambiguous names", () => {
  const { rows } = parseYtdImportCsv("employee_name,gross\nMaria Example,100\nMaria Twin,100\nNobody Here,100\n");
  const planned = planYtdImport(rows, [
    { id: "emp-1", fullName: "Maria Example", email: "" },
    { id: "emp-2", fullName: "Maria Twin", email: "twin1@example.com" },
    { id: "emp-3", fullName: "Maria Twin", email: "twin2@example.com" }
  ], new Map());
  assert.equal(planned[0].employeeId, "emp-1");
  assert.ok(planned[1].errors.some((e) => e.includes("more than one employee")));
  assert.ok(planned[2].errors.some((e) => e.includes("No employee found")));
});

test("planYtdImport rejects duplicate rows for the same employee", () => {
  const { rows } = parseYtdImportCsv("email,gross\nmaria@example.com,100\nMARIA@example.com,200\n");
  const planned = planYtdImport(
    rows,
    [{ id: "emp-1", fullName: "Maria Example", email: "maria@example.com" }],
    new Map()
  );
  assert.deepEqual(planned[0].errors, []);
  assert.ok(planned[1].errors.some((e) => e.includes("Duplicate")));
});

test("parseYearInput accepts integer years in range only", () => {
  assert.equal(parseYearInput("2026"), 2026);
  assert.equal(parseYearInput(2026), 2026);
  assert.equal(parseYearInput("2026.5"), null);
  assert.equal(parseYearInput("1999"), null);
  assert.equal(parseYearInput("abc"), null);
});

test("opening YTD gross shifts the payroll-tax exemption so mid-year imports tax correctly", () => {
  const period = {
    schedule: "monthly" as const,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z")
  };
  const fixedEmployee = {
    id: "emp-fixed",
    fullName: "Maria Monthly",
    role: "Cleaner",
    defaultSite: "Site A",
    paySchedule: "monthly" as const,
    basePayType: "fixed" as const,
    dailyRate: 0,
    hourlyRate: 0,
    overtimeRate: 0,
    fixedPay: 2000,
    templateName: "Standard"
  };

  const withoutOpening = buildRunItemsFromEntries(period, [], undefined, { fixedEmployees: [fixedEmployee] });
  const withOpening = buildRunItemsFromEntries(period, [], undefined, {
    fixedEmployees: [fixedEmployee],
    // Simulates an imported opening balance of $9,000 gross earned Jan–Mar.
    yearToDateGrossByEmployee: new Map([["emp-fixed", 9000]])
  });

  // Default BVI config: $10,000 annual payroll-tax exemption, 8% employee rate.
  // Without history the $2,000 month is fully inside the exemption → $0 tax.
  assert.equal(withoutOpening[0].payrollTax, 0);
  // With $9,000 prior gross, only $1,000 of exemption remains → 8% of $1,000.
  assert.equal(withOpening[0].payrollTax, 80);
});
