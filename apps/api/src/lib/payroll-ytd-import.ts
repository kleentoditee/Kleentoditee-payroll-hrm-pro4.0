import { prisma } from "@kleentoditee/db";

/**
 * Historical / year-to-date payroll opening-balance import.
 *
 * When a company migrates to this system mid-year, the payroll-tax annual
 * exemption needs each employee's gross pay from earlier in the calendar year
 * (paid under the previous system). This module parses a small CSV template,
 * matches rows to employees (email first, then exact full name), validates the
 * amounts, and upserts `PayrollYtdOpeningBalance` rows. The pay-run builder
 * adds `gross` into the year-to-date gross used by the payroll-tax exemption
 * calculation; the other components are stored for audit and future
 * register/reconciliation reports.
 *
 * The pure parsing/planning functions take their inputs as arguments so they
 * can be unit tested without a database.
 */

export const YTD_IMPORT_TEMPLATE_HEADERS = [
  "email",
  "employee_name",
  "gross",
  "nhi",
  "ssb",
  "income_tax",
  "payroll_tax",
  "employer_nhi",
  "employer_ssb",
  "employer_payroll_tax",
  "net",
  "notes"
] as const;

export const YTD_IMPORT_TEMPLATE_CSV = `${YTD_IMPORT_TEMPLATE_HEADERS.join(",")}\nmaria@example.com,Maria Example,12450.00,373.50,560.25,0,622.50,373.50,560.25,622.50,10893.75,Imported from legacy payroll\n`;

const MAX_ROWS = 1000;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export type YtdAmounts = {
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  net: number;
};

export type YtdImportRow = {
  rowNumber: number;
  email: string;
  employeeName: string;
  amounts: YtdAmounts;
  notes: string;
  errors: string[];
};

export type YtdEmployeeRef = {
  id: string;
  fullName: string;
  email: string;
};

export type YtdPlannedRow = YtdImportRow & {
  employeeId: string | null;
  matchedEmployeeName: string | null;
  existingBalanceId: string | null;
  willOverwrite: boolean;
};

export function parseYearInput(value: unknown): number | null {
  const year = Number(value);
  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }
  return year;
}

/** Quote-aware CSV parser for the fixed YTD template (comma separated, `"` escaped as `""`). */
export function splitCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
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
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }
  record.push(field);
  records.push(record);
  return records;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/^\uFEFF/, "").replace(/[\s-]+/g, "_");
}

function parseAmount(value: string, column: string, errors: string[]): number {
  const text = value.trim().replace(/[$,]/g, "");
  if (!text) {
    return 0;
  }
  const amount = Number(text);
  if (!Number.isFinite(amount)) {
    errors.push(`${column} is not a number.`);
    return 0;
  }
  if (amount < 0) {
    errors.push(`${column} cannot be negative.`);
    return 0;
  }
  return Math.round(amount * 100) / 100;
}

/** Parses and validates the CSV body. Rows with errors are returned flagged, never silently dropped. */
export function parseYtdImportCsv(csv: string): { rows: YtdImportRow[]; errors: string[] } {
  const errors: string[] = [];
  if (!csv.trim()) {
    return { rows: [], errors: ["CSV content is empty."] };
  }
  if (Buffer.byteLength(csv, "utf8") > 1024 * 1024) {
    return { rows: [], errors: ["CSV file is too large. Maximum size is 1 MB."] };
  }

  const records = splitCsvRecords(csv).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (!records.length) {
    return { rows: [], errors: ["CSV content is empty."] };
  }

  const headers = records[0].map(normalizeHeader);
  if (!headers.includes("email") && !headers.includes("employee_name")) {
    return {
      rows: [],
      errors: ["Header row must include an email or employee_name column."]
    };
  }
  if (!headers.includes("gross")) {
    return { rows: [], errors: ["Header row must include a gross column."] };
  }

  const column = (row: string[], name: string): string => {
    const index = headers.indexOf(name);
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };

  const rows: YtdImportRow[] = records.slice(1, MAX_ROWS + 1).map((row, index) => {
    const rowErrors: string[] = [];
    const amounts: YtdAmounts = {
      gross: 0,
      nhi: parseAmount(column(row, "nhi"), "nhi", rowErrors),
      ssb: parseAmount(column(row, "ssb"), "ssb", rowErrors),
      incomeTax: parseAmount(column(row, "income_tax"), "income_tax", rowErrors),
      payrollTax: parseAmount(column(row, "payroll_tax"), "payroll_tax", rowErrors),
      employerNhi: parseAmount(column(row, "employer_nhi"), "employer_nhi", rowErrors),
      employerSsb: parseAmount(column(row, "employer_ssb"), "employer_ssb", rowErrors),
      employerPayrollTax: parseAmount(column(row, "employer_payroll_tax"), "employer_payroll_tax", rowErrors),
      net: parseAmount(column(row, "net"), "net", rowErrors)
    };
    const grossText = column(row, "gross");
    if (!grossText) {
      rowErrors.push("gross is required.");
    } else {
      amounts.gross = parseAmount(grossText, "gross", rowErrors);
    }
    const email = column(row, "email").toLowerCase();
    const employeeName = column(row, "employee_name");
    if (!email && !employeeName) {
      rowErrors.push("email or employee_name is required.");
    }
    return {
      rowNumber: index + 2,
      email,
      employeeName,
      amounts,
      notes: column(row, "notes"),
      errors: rowErrors
    };
  });

  if (records.length - 1 > MAX_ROWS) {
    errors.push(`Only the first ${MAX_ROWS} rows were processed.`);
  }
  return { rows, errors };
}

/**
 * Matches parsed rows to employees: exact email (case-insensitive) first, then
 * exact full name. Name matches that hit more than one employee are rejected.
 */
export function planYtdImport(
  rows: YtdImportRow[],
  employees: YtdEmployeeRef[],
  existingByEmployeeId: Map<string, string>
): YtdPlannedRow[] {
  const byEmail = new Map(employees.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e]));
  const byName = new Map<string, YtdEmployeeRef[]>();
  for (const employee of employees) {
    const key = employee.fullName.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), employee]);
  }

  const planned = rows.map((row) => {
    const errors = [...row.errors];
    let match: YtdEmployeeRef | null = null;
    if (row.email) {
      match = byEmail.get(row.email) ?? null;
      if (!match && !row.employeeName) {
        errors.push(`No employee found with email "${row.email}".`);
      }
    }
    if (!match && row.employeeName) {
      const candidates = byName.get(row.employeeName.trim().toLowerCase()) ?? [];
      if (candidates.length === 1) {
        match = candidates[0];
      } else if (candidates.length > 1) {
        errors.push(`Employee name "${row.employeeName}" matches more than one employee; use email instead.`);
      } else if (!row.email) {
        errors.push(`No employee found with name "${row.employeeName}".`);
      } else {
        errors.push(`No employee found for email "${row.email}" or name "${row.employeeName}".`);
      }
    }
    const existingBalanceId = match ? (existingByEmployeeId.get(match.id) ?? null) : null;
    return {
      ...row,
      errors,
      employeeId: match?.id ?? null,
      matchedEmployeeName: match?.fullName ?? null,
      existingBalanceId,
      willOverwrite: existingBalanceId !== null
    };
  });

  // One row per employee per file: duplicates would silently upsert over each
  // other inside the same commit.
  const seen = new Map<string, number>();
  for (const row of planned) {
    if (!row.employeeId) continue;
    const firstRow = seen.get(row.employeeId);
    if (firstRow !== undefined) {
      row.errors.push(
        `Duplicate: ${row.matchedEmployeeName} already appears on row ${firstRow}; keep one row per employee.`
      );
    } else {
      seen.set(row.employeeId, row.rowNumber);
    }
  }
  return planned;
}

async function loadMatchContext(year: number) {
  const [employees, existing] = await Promise.all([
    prisma.employee.findMany({ select: { id: true, fullName: true, email: true } }),
    prisma.payrollYtdOpeningBalance.findMany({ where: { year }, select: { id: true, employeeId: true } })
  ]);
  return {
    employees,
    existingByEmployeeId: new Map(existing.map((row) => [row.employeeId, row.id]))
  };
}

export type YtdImportPlan = {
  year: number;
  rows: YtdPlannedRow[];
  errors: string[];
  ready: number;
  rejected: number;
};

export async function previewYtdImport(csv: string, year: number): Promise<YtdImportPlan> {
  const parsed = parseYtdImportCsv(csv);
  const { employees, existingByEmployeeId } = await loadMatchContext(year);
  const rows = planYtdImport(parsed.rows, employees, existingByEmployeeId);
  return {
    year,
    rows,
    errors: parsed.errors,
    ready: rows.filter((row) => row.errors.length === 0 && row.employeeId).length,
    rejected: rows.filter((row) => row.errors.length > 0 || !row.employeeId).length
  };
}

/**
 * Upserts opening balances for the given year. Any row-level error rejects the
 * whole commit so a partial import never leaves the YTD figures half-applied.
 */
export async function commitYtdImport(csv: string, year: number, actorUserId: string | null) {
  const plan = await previewYtdImport(csv, year);
  if (plan.errors.length) {
    throw new Error(plan.errors.join(" "));
  }
  const invalid = plan.rows.filter((row) => row.errors.length > 0 || !row.employeeId);
  if (invalid.length) {
    const detail = invalid
      .slice(0, 5)
      .map((row) => `row ${row.rowNumber}: ${row.errors.join("; ") || "no matching employee"}`)
      .join(" | ");
    throw new Error(`Fix ${invalid.length} row(s) before importing. ${detail}`);
  }
  if (!plan.rows.length) {
    throw new Error("CSV contains no data rows.");
  }

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    for (const row of plan.rows) {
      const data = {
        year,
        gross: row.amounts.gross,
        nhi: row.amounts.nhi,
        ssb: row.amounts.ssb,
        incomeTax: row.amounts.incomeTax,
        payrollTax: row.amounts.payrollTax,
        employerNhi: row.amounts.employerNhi,
        employerSsb: row.amounts.employerSsb,
        employerPayrollTax: row.amounts.employerPayrollTax,
        net: row.amounts.net,
        source: "csv-import",
        notes: row.notes,
        importedBy: actorUserId ?? ""
      };
      const saved = await tx.payrollYtdOpeningBalance.upsert({
        where: { employeeId_year: { employeeId: row.employeeId as string, year } },
        create: { employeeId: row.employeeId as string, ...data },
        update: data
      });
      if (row.willOverwrite) {
        updated += 1;
      } else {
        created += 1;
      }
      void saved;
    }
    return { created, updated };
  });

  return { year, ...result, total: plan.rows.length };
}

/**
 * Opening-balance gross per employee for a calendar year, keyed by employeeId.
 * Added to prior finalized-run gross by the pay-run builder so the payroll-tax
 * annual exemption accounts for pay earned before the system went live.
 */
export async function loadYtdOpeningGrossByEmployee(employeeIds: string[], year: number) {
  if (!employeeIds.length) {
    return new Map<string, number>();
  }
  const rows = await prisma.payrollYtdOpeningBalance.findMany({
    where: { employeeId: { in: employeeIds }, year },
    select: { employeeId: true, gross: true }
  });
  return new Map(rows.map((row) => [row.employeeId, row.gross]));
}
