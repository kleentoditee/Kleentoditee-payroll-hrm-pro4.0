// Bank statement CSV import (Batch 14): parsing, column mapping, fingerprint
// duplicate detection. Pure functions — unit-tested without a DB.

import { createHash } from "node:crypto";

export const MAX_STATEMENT_ROWS = 5000;

export type StatementMapping = {
  date?: number;
  description?: number;
  reference?: number;
  /** Single signed amount column (positive = money in). */
  amount?: number;
  /** Money-out column (used with `credit` when there is no signed amount). */
  debit?: number;
  /** Money-in column. */
  credit?: number;
};

export type ParsedStatementRow = {
  position: number;
  date: string; // ISO yyyy-mm-dd
  description: string;
  reference: string;
  amount: number; // signed
  fingerprint: string;
};

export type StatementPlan = {
  headers: string[];
  mapping: StatementMapping;
  rows: ParsedStatementRow[];
  rowCount: number;
  validationErrors: string[];
  warnings: string[];
};

/** RFC-4180-ish CSV: quotes, escaped quotes, CRLF/LF. No papaparse dependency. */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch === "\r") {
      // swallowed; \n follows in CRLF
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  // Drop fully empty rows
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

const HEADER_ALIASES: Record<keyof StatementMapping, RegExp[]> = {
  date: [/^(transaction\s*)?date$/i, /^posted(\s*date)?$/i, /^value\s*date$/i],
  description: [/^(description|details|narrative|memo|payee|transaction\s*details)$/i],
  reference: [/^(reference|ref(\s*(no|number|#))?|check(\s*(no|number|#))?|cheque)$/i],
  amount: [/^(amount|transaction\s*amount|signed\s*amount)$/i],
  debit: [/^(debit|withdrawal|withdrawals|money\s*out|paid\s*out)$/i],
  credit: [/^(credit|deposit|deposits|money\s*in|paid\s*in)$/i]
};

/** Best-effort header -> field mapping by alias. */
export function suggestStatementMapping(headers: string[]): StatementMapping {
  const mapping: StatementMapping = {};
  for (const [field, patterns] of Object.entries(HEADER_ALIASES) as Array<[keyof StatementMapping, RegExp[]]>) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].trim();
      if (!h) continue;
      if (patterns.some((p) => p.test(h))) {
        if (mapping[field] === undefined) mapping[field] = i;
        break;
      }
    }
  }
  return mapping;
}

/** "$1,234.56", "(75.00)", "-75", "1 234.56" -> number; null when unparseable. */
export function normalizeStatementAmount(raw: string): number | null {
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$€£\s]/g, "").replace(/,/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Accepts yyyy-mm-dd, mm/dd/yyyy, dd/mm/yyyy, dd-Mmm-yyyy. Returns ISO date or null. */
export function normalizeStatementDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(m[1], m[2], m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // mm/dd when unambiguously so or ambiguous-but-us-style; dd/mm when a > 12
    const [mm, dd] = a > 12 ? [b, a] : [a, b];
    return iso(m[3], mm, dd);
  }
  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s);
  if (m) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mi = months.indexOf(m[2].toLowerCase());
    if (mi >= 0) return iso(m[3], mi + 1, m[1]);
  }
  return null;
}

function iso(y: string | number, m: string | number, d: string | number): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yy.toString().padStart(4, "0")}-${mm.toString().padStart(2, "0")}-${dd.toString().padStart(2, "0")}`;
}

/**
 * Stable duplicate key for a statement line within one org + bank account.
 * Two imports of the same statement produce identical fingerprints and the
 * unique index + commit-time skip prevent duplicate entries.
 */
export function statementFingerprint(input: {
  bankAccountId: string;
  date: string;
  amount: number;
  description: string;
  reference: string;
}): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const payload = [
    input.bankAccountId,
    input.date,
    input.amount.toFixed(2),
    norm(input.description),
    norm(input.reference)
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/** Turn raw CSV rows + a column mapping into validated statement rows. */
export function buildStatementPlan(input: {
  headers: string[];
  rows: string[][];
  mapping: StatementMapping;
  bankAccountId: string;
}): StatementPlan {
  const { headers, rows, mapping, bankAccountId } = input;
  const validationErrors: string[] = [];
  const warnings: string[] = [];
  const parsed: ParsedStatementRow[] = [];

  if (mapping.date === undefined) validationErrors.push("Map a date column.");
  const hasSigned = mapping.amount !== undefined;
  const hasPair = mapping.debit !== undefined || mapping.credit !== undefined;
  if (!hasSigned && !hasPair) validationErrors.push("Map an amount column, or a debit/credit pair.");
  if (validationErrors.length > 0) {
    return { headers, mapping, rows: [], rowCount: rows.length, validationErrors, warnings };
  }

  const capped = rows.slice(0, MAX_STATEMENT_ROWS);
  if (rows.length > MAX_STATEMENT_ROWS) {
    warnings.push(`Only the first ${MAX_STATEMENT_ROWS} rows are imported (file has ${rows.length}).`);
  }

  const seenInFile = new Set<string>();
  for (const [i, cols] of capped.entries()) {
    const position = i + 1;
    const cell = (idx?: number) => (idx === undefined ? "" : String(cols[idx] ?? "").trim());
    const date = normalizeStatementDate(cell(mapping.date));
    if (!date) {
      validationErrors.push(`Row ${position}: unparseable date "${cell(mapping.date)}".`);
      continue;
    }
    let amount: number | null = null;
    if (hasSigned) {
      amount = normalizeStatementAmount(cell(mapping.amount));
    } else {
      const debit = normalizeStatementAmount(cell(mapping.debit));
      const credit = normalizeStatementAmount(cell(mapping.credit));
      const d = debit === null ? 0 : Math.abs(debit);
      const cr = credit === null ? 0 : Math.abs(credit);
      if (debit === null && credit === null) {
        amount = null;
      } else {
        amount = Math.round((cr - d) * 100) / 100;
      }
    }
    if (amount === null) {
      validationErrors.push(`Row ${position}: unparseable amount.`);
      continue;
    }
    if (amount === 0) {
      warnings.push(`Row ${position}: zero-amount line skipped.`);
      continue;
    }
    const description = cell(mapping.description) || "Statement line";
    const reference = cell(mapping.reference);
    const fingerprint = statementFingerprint({ bankAccountId, date, amount, description, reference });
    if (seenInFile.has(fingerprint)) {
      warnings.push(`Row ${position}: duplicate of an earlier row in this file — skipped.`);
      continue;
    }
    seenInFile.add(fingerprint);
    parsed.push({ position, date, description, reference, amount, fingerprint });
  }

  return { headers, mapping, rows: parsed, rowCount: rows.length, validationErrors: validationErrors.slice(0, 20), warnings: warnings.slice(0, 20) };
}
