import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStatementPlan,
  normalizeStatementAmount,
  normalizeStatementDate,
  parseCsvText,
  statementFingerprint,
  suggestStatementMapping
} from "./bank-statements.js";
import { rankCandidates, scoreCandidate } from "./bank-matching.js";

test("parseCsvText handles quotes, commas, CRLF, and empty rows", () => {
  const rows = parseCsvText('Date,Description,Amount\r\n2026-09-01,"Deposit, walk-in",50.00\r\n\r\n2026-09-02,"He said ""paid""",-75.50\n');
  assert.deepEqual(rows, [
    ["Date", "Description", "Amount"],
    ["2026-09-01", "Deposit, walk-in", "50.00"],
    ["2026-09-02", 'He said "paid"', "-75.50"]
  ]);
});

test("normalizeStatementAmount parses currency formats and signs", () => {
  assert.equal(normalizeStatementAmount("$1,234.56"), 1234.56);
  assert.equal(normalizeStatementAmount("(75.00)"), -75);
  assert.equal(normalizeStatementAmount("-75"), -75);
  assert.equal(normalizeStatementAmount("+42.10"), 42.1);
  assert.equal(normalizeStatementAmount("abc"), null);
  assert.equal(normalizeStatementAmount(""), null);
});

test("normalizeStatementDate accepts iso, us/eu slashes, and dd-Mmm-yyyy", () => {
  assert.equal(normalizeStatementDate("2026-09-05"), "2026-09-05");
  assert.equal(normalizeStatementDate("09/05/2026"), "2026-09-05");
  assert.equal(normalizeStatementDate("15/09/2026"), "2026-09-15"); // unambiguous dd/mm
  assert.equal(normalizeStatementDate("05-Sep-2026"), "2026-09-05");
  assert.equal(normalizeStatementDate("2026-13-01"), null);
  assert.equal(normalizeStatementDate("not a date"), null);
});

test("suggestStatementMapping maps common bank headers", () => {
  const m = suggestStatementMapping(["Date", "Description", "Reference", "Debit", "Credit"]);
  assert.deepEqual(m, { date: 0, description: 1, reference: 2, debit: 3, credit: 4 });
  const single = suggestStatementMapping(["Posted", "Narrative", "Amount"]);
  assert.equal(single.date, 0);
  assert.equal(single.description, 1);
  assert.equal(single.amount, 2);
});

test("fingerprint is stable and changes with any field", () => {
  const base = { bankAccountId: "b1", date: "2026-09-01", amount: 50, description: "Deposit", reference: "R1" };
  const a = statementFingerprint(base);
  assert.equal(a, statementFingerprint({ ...base, description: "  DEPOSIT " }));
  assert.notEqual(a, statementFingerprint({ ...base, amount: 51 }));
  assert.notEqual(a, statementFingerprint({ ...base, bankAccountId: "b2" }));
});

test("buildStatementPlan parses signed amounts and debit/credit pairs", () => {
  const headers = ["Date", "Description", "Amount"];
  const rows = [
    ["2026-09-01", "Deposit", "50.00"],
    ["2026-09-02", "Expense", "-75.00"],
    ["bad date", "Nope", "10"],
    ["2026-09-03", "Zero", "0.00"],
    ["2026-09-01", "Deposit", "50.00"] // in-file duplicate
  ];
  const plan = buildStatementPlan({ headers, rows, mapping: { date: 0, description: 1, amount: 2 }, bankAccountId: "b1" });
  assert.equal(plan.rows.length, 2);
  assert.equal(plan.rows[0].amount, 50);
  assert.equal(plan.rows[1].amount, -75);
  assert.equal(plan.validationErrors.length, 1);
  assert.equal(plan.warnings.length, 2); // zero + in-file duplicate

  const pair = buildStatementPlan({
    headers: ["Date", "Debit", "Credit"],
    rows: [["2026-09-01", "75.00", ""], ["2026-09-02", "", "120.00"]],
    mapping: { date: 0, debit: 1, credit: 2 },
    bankAccountId: "b1"
  });
  assert.equal(pair.rows[0].amount, -75);
  assert.equal(pair.rows[1].amount, 120);
});

test("buildStatementPlan requires date and amount columns", () => {
  const plan = buildStatementPlan({ headers: ["a"], rows: [], mapping: {}, bankAccountId: "b1" });
  assert.equal(plan.validationErrors.length, 2);
  assert.equal(plan.rows.length, 0);
});

test("scoreCandidate requires same sign, matching amount, nearby date", () => {
  const line = { date: "2026-09-10", amount: -75, reference: "CHK 101", description: "Office supplies" };
  const doc = { entityType: "expense" as const, entityId: "e1", label: "EXP-1", date: "2026-09-11", amount: -75, reference: "chk 101", description: "Office supplies" };
  assert.ok((scoreCandidate(line, doc) ?? 0) > 70);
  // wrong sign
  assert.equal(scoreCandidate(line, { ...doc, amount: 75 }), null);
  // wrong amount
  assert.equal(scoreCandidate(line, { ...doc, amount: -75.01 }), null);
  // too far apart in time
  assert.equal(scoreCandidate(line, { ...doc, date: "2026-10-01" }), null);
});

test("rankCandidates orders best match first and drops non-matches", () => {
  const line = { date: "2026-09-10", amount: 50, reference: "R9", description: "Customer deposit" };
  const ranked = rankCandidates(line, [
    { entityType: "deposit", entityId: "far", label: "D1", date: "2026-09-03", amount: 50, reference: "", description: "" },
    { entityType: "deposit", entityId: "near", label: "D2", date: "2026-09-10", amount: 50, reference: "R9", description: "Customer deposit" },
    { entityType: "payment", entityId: "wrong", label: "P1", date: "2026-09-10", amount: 51, reference: "R9", description: "" }
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].entityId, "near");
  assert.equal(ranked[0].score, 100);
});
