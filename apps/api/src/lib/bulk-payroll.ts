// Batch 20 — bulk employee onboarding, reusable payroll-mutation imports with
// batch reversal, and BVI bank-payout export built from finalized pay runs.
import { PayBasis, PaySchedule, prisma, requireOrgId } from "@kleentoditee/db";
import { parseCsv } from "./quickbooks-accounting-import.js";
import { sha256Hex } from "./migration-import.js";
import { roundMoney } from "./payroll-calc.js";

// ---------------------------------------------------------------------------
// Bulk employee onboarding
// ---------------------------------------------------------------------------

export type OnboardingRow = {
  fullName: string;
  email: string;
  phone: string;
  role: string;
  defaultSite: string;
  basePayType: "daily" | "hourly" | "fixed";
  dailyRate: number;
  hourlyRate: number;
  fixedPay: number;
  paySchedule: "weekly" | "biweekly" | "monthly";
  templateId: string;
};

export const ONBOARDING_HEADERS = [
  "fullName", "email", "phone", "role", "defaultSite",
  "basePayType", "dailyRate", "hourlyRate", "fixedPay", "paySchedule", "templateId"
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse + validate an onboarding CSV. All-or-nothing: any row error aborts. */
export async function validateOnboardingCsv(csv: string): Promise<{ rows: OnboardingRow[]; errors: string[] }> {
  const parsed = parseCsv(csv);
  const errors: string[] = [];
  const rows: OnboardingRow[] = [];
  const seenEmails = new Set<string>();
  const headerOf = (row: Record<string, string>, name: string) => {
    const key = Object.keys(row).find((k) => k.toLowerCase().replace(/[^a-z]/g, "") === name.toLowerCase());
    return key ? String(row[key] ?? "").trim() : "";
  };
  const templates = await prisma.deductionTemplate.findMany({ select: { id: true, name: true } });
  const templateIds = new Set(templates.map((t) => t.id));
  const templateByName = new Map(templates.map((t) => [t.name.toLowerCase(), t.id]));

  parsed.rows.forEach((row, i) => {
    const line = i + 2;
    const fullName = headerOf(row, "fullname");
    const email = headerOf(row, "email").toLowerCase();
    const basePayType = headerOf(row, "basepaytype");
    const paySchedule = headerOf(row, "payschedule") || "monthly";
    const templateRef = headerOf(row, "templateid") || headerOf(row, "template");
    if (!fullName) errors.push(`row ${line}: fullName is required`);
    if (!EMAIL_RE.test(email)) errors.push(`row ${line}: valid email is required`);
    if (seenEmails.has(email)) errors.push(`row ${line}: duplicate email in file (${email})`);
    seenEmails.add(email);
    if (!["daily", "hourly", "fixed"].includes(basePayType)) errors.push(`row ${line}: basePayType must be daily|hourly|fixed`);
    if (!["weekly", "biweekly", "monthly"].includes(paySchedule)) errors.push(`row ${line}: paySchedule must be weekly|biweekly|monthly`);
    const templateId = templateIds.has(templateRef) ? templateRef : templateByName.get(templateRef.toLowerCase()) ?? "";
    if (!templateId) errors.push(`row ${line}: unknown template "${templateRef}"`);
    const num = (v: string) => (v === "" ? 0 : Number(v));
    for (const f of ["dailyrate", "hourlyrate", "fixedpay"] as const) {
      const v = headerOf(row, f);
      if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) errors.push(`row ${line}: ${f} must be a non-negative number`);
    }
    if (errors.length && errors[errors.length - 1].startsWith(`row ${line}`)) {
      // still push a placeholder row to keep indexes aligned; skipped on errors anyway
    }
    rows.push({
      fullName,
      email,
      phone: headerOf(row, "phone"),
      role: headerOf(row, "role"),
      defaultSite: headerOf(row, "defaultsite"),
      basePayType: basePayType as OnboardingRow["basePayType"],
      dailyRate: num(headerOf(row, "dailyrate")),
      hourlyRate: num(headerOf(row, "hourlyrate")),
      fixedPay: num(headerOf(row, "fixedpay")),
      paySchedule: paySchedule as OnboardingRow["paySchedule"],
      templateId
    });
  });

  // DB-level duplicate email check (batch)
  const emails = rows.map((r) => r.email).filter(Boolean);
  if (emails.length) {
    const existing = await prisma.employee.findMany({
      where: { email: { in: emails } },
      select: { email: true }
    });
    for (const e of existing) errors.push(`email already in use: ${e.email}`);
  }
  return { rows, errors };
}

export async function importEmployees(csv: string, fileName: string, actorUserId?: string) {
  const orgId = requireOrgId();
  const { rows, errors } = await validateOnboardingCsv(csv);
  if (!rows.length) throw new Error("No data rows found in the CSV.");
  if (errors.length) {
    const err = new Error(`Validation failed: ${errors.slice(0, 10).join(" | ")}${errors.length > 10 ? ` (+${errors.length - 10} more)` : ""}`);
    (err as Error & { errors?: string[] }).errors = errors;
    throw err;
  }
  const sha256 = sha256Hex(Buffer.from(csv, "utf8"));
  const dup = await prisma.onboardingBatch.findFirst({ where: { sha256, status: "committed" } });
  if (dup) throw new Error("This exact file was already imported (batch " + dup.id + ").");

  const created = await prisma.$transaction(async (tx) => {
    const ids: string[] = [];
    for (const row of rows) {
      const emp = await tx.employee.create({
        data: {
          orgId,
          fullName: row.fullName,
          email: row.email,
          phone: row.phone,
          role: row.role,
          defaultSite: row.defaultSite,
          basePayType: row.basePayType as PayBasis,
          dailyRate: row.dailyRate,
          hourlyRate: row.hourlyRate,
          fixedPay: row.fixedPay,
          paySchedule: row.paySchedule as PaySchedule,
          templateId: row.templateId,
          active: true
        },
        select: { id: true }
      });
      ids.push(emp.id);
    }
    const batch = await tx.onboardingBatch.create({
      data: {
        orgId,
        fileName,
        sha256,
        rowCount: rows.length,
        createdCount: ids.length,
        createdEmployeeIds: ids,
        createdByUserId: actorUserId ?? null
      }
    });
    return { batch, ids };
  });
  return { batchId: created.batch.id, created: created.ids.length, employeeIds: created.ids };
}

/** Reverse an onboarding batch: deletes exactly the employees it created, only
 * while none of them has payroll/time/request history. */
export async function reverseOnboardingBatch(batchId: string, actorUserId?: string) {
  const batch = await prisma.onboardingBatch.findFirst({ where: { id: batchId } });
  if (!batch) throw new Error("Onboarding batch not found.");
  if (batch.status === "reversed") throw new Error("Batch is already reversed.");
  const ids = batch.createdEmployeeIds as string[];
  const blockers: string[] = [];
  for (const id of ids) {
    const emp = await prisma.employee.findFirst({ where: { id }, select: { fullName: true } });
    if (!emp) continue; // already gone
    const [payItems, timeEntries, requests] = await Promise.all([
      prisma.payRunItem.count({ where: { employeeId: id } }),
      prisma.timeEntry.count({ where: { employeeId: id } }),
      prisma.staffRequest.count({ where: { employeeId: id } })
    ]);
    if (payItems + timeEntries + requests > 0) {
      blockers.push(`${emp.fullName} (pay items ${payItems}, time entries ${timeEntries}, requests ${requests})`);
    }
  }
  if (blockers.length) {
    throw new Error(`Cannot reverse — employees have history: ${blockers.join(" | ")}`);
  }
  await prisma.$transaction(async (tx) => {
    for (const id of ids) {
      await tx.employeeDocument.deleteMany({ where: { employeeId: id } });
      await tx.employmentContract.deleteMany({ where: { employeeId: id } });
      await tx.employeeAsset.deleteMany({ where: { employeeId: id } });
      await tx.leaveEvent.deleteMany({ where: { employeeId: id } });
      await tx.leavePolicyAssignment.deleteMany({ where: { employeeId: id } });
      await tx.user.updateMany({ where: { employeeId: id }, data: { employeeId: null } });
      await tx.employee.deleteMany({ where: { id } });
    }
    await tx.onboardingBatch.update({
      where: { id: batch.id },
      data: { status: "reversed", reversedAt: new Date(), reversedByUserId: actorUserId ?? null }
    });
  });
  return { batchId: batch.id, deleted: ids.length };
}

// ---------------------------------------------------------------------------
// Payroll-mutation imports (draft runs only, batch-reversible)
// ---------------------------------------------------------------------------

export type MutationRow = { employeeId: string; kind: "addition" | "deduction"; label: string; amount: number };

export async function validateMutationCsv(
  runId: string,
  csv: string
): Promise<{ rows: MutationRow[]; errors: string[] }> {
  const parsed = parseCsv(csv);
  const errors: string[] = [];
  const rows: MutationRow[] = [];
  const headerOf = (row: Record<string, string>, ...names: string[]) => {
    const key = Object.keys(row).find((k) => names.includes(k.toLowerCase().replace(/[^a-z]/g, "")));
    return key ? String(row[key] ?? "").trim() : "";
  };
  const items = await prisma.payRunItem.findMany({
    where: { runId },
    select: { employeeId: true, employee: { select: { email: true } } }
  });
  const byEmail = new Map(items.map((i) => [i.employee.email.toLowerCase(), i.employeeId]));
  const byId = new Map(items.map((i) => [i.employeeId, i.employeeId]));

  parsed.rows.forEach((row, i) => {
    const line = i + 2;
    const ref = (headerOf(row, "employeeemail", "email", "employeeid") || "").toLowerCase();
    const kind = headerOf(row, "kind", "type").toLowerCase();
    const label = headerOf(row, "label", "description");
    const amount = Number(headerOf(row, "amount"));
    const employeeId = byEmail.get(ref) ?? byId.get(ref) ?? "";
    if (!employeeId) errors.push(`row ${line}: no pay-run item for "${ref}"`);
    if (kind !== "addition" && kind !== "deduction") errors.push(`row ${line}: kind must be addition|deduction`);
    if (!label) errors.push(`row ${line}: label is required`);
    if (!Number.isFinite(amount) || amount <= 0) errors.push(`row ${line}: amount must be positive`);
    rows.push({ employeeId, kind: kind as MutationRow["kind"], label, amount: roundMoney(amount) || 0 });
  });
  return { rows, errors };
}

/** Apply a mutation CSV to a DRAFT pay run. All-or-nothing. */
export async function importPayrollMutations(runId: string, csv: string, fileName: string, actorUserId?: string) {
  const orgId = requireOrgId();
  const run = await prisma.payRun.findFirst({ where: { id: runId } });
  if (!run) throw new Error("Pay run not found.");
  if (run.status !== "draft") throw new Error(`Mutations apply to draft runs only (current: ${run.status}).`);
  const { rows, errors } = await validateMutationCsv(runId, csv);
  if (!rows.length) throw new Error("No data rows found in the CSV.");
  if (errors.length) {
    const err = new Error(`Validation failed: ${errors.slice(0, 10).join(" | ")}`);
    (err as Error & { errors?: string[] }).errors = errors;
    throw err;
  }
  return prisma.$transaction(async (tx) => {
    const batch = await tx.payrollMutationBatch.create({
      data: { orgId, runId, fileName, rowCount: rows.length, appliedCount: rows.length, createdByUserId: actorUserId ?? null }
    });
    for (const row of rows) {
      await tx.payrollMutation.create({
        data: { orgId, batchId: batch.id, runId, employeeId: row.employeeId, kind: row.kind, label: row.label, amount: row.amount }
      });
      const item = await tx.payRunItem.findFirstOrThrow({ where: { runId, employeeId: row.employeeId } });
      await tx.payRunItem.update({
        where: { id: item.id },
        data:
          row.kind === "addition"
            ? {
                allowance: roundMoney(item.allowance + row.amount),
                gross: roundMoney(item.gross + row.amount),
                net: roundMoney(item.net + row.amount)
              }
            : {
                otherDeduction: roundMoney(item.otherDeduction + row.amount),
                totalDeductions: roundMoney(item.totalDeductions + row.amount),
                net: roundMoney(item.net - row.amount)
              }
      });
    }
    return { batchId: batch.id, applied: rows.length };
  });
}

export async function reverseMutationBatch(batchId: string, actorUserId?: string) {
  const batch = await prisma.payrollMutationBatch.findFirst({ where: { id: batchId }, include: { run: true } });
  if (!batch) throw new Error("Mutation batch not found.");
  if (batch.status === "reversed") throw new Error("Batch is already reversed.");
  if (batch.run.status !== "draft") throw new Error(`Cannot reverse after the run left draft (current: ${batch.run.status}).`);
  const mutations = await prisma.payrollMutation.findMany({ where: { batchId } });
  await prisma.$transaction(async (tx) => {
    for (const m of mutations) {
      const item = await tx.payRunItem.findFirst({ where: { runId: m.runId, employeeId: m.employeeId } });
      if (!item) continue;
      await tx.payRunItem.update({
        where: { id: item.id },
        data:
          m.kind === "addition"
            ? {
                allowance: roundMoney(item.allowance - m.amount),
                gross: roundMoney(item.gross - m.amount),
                net: roundMoney(item.net - m.amount)
              }
            : {
                otherDeduction: roundMoney(item.otherDeduction - m.amount),
                totalDeductions: roundMoney(item.totalDeductions - m.amount),
                net: roundMoney(item.net + m.amount)
              }
      });
    }
    await tx.payrollMutationBatch.update({
      where: { id: batch.id },
      data: { status: "reversed", reversedAt: new Date(), reversedByUserId: actorUserId ?? null }
    });
  });
  return { batchId: batch.id, reversed: mutations.length };
}

// ---------------------------------------------------------------------------
// BVI bank-payout export
// ---------------------------------------------------------------------------

export const BANK_PAYOUT_FORMAT = "bvi_bank_csv";

export type BankPayoutLine = {
  bankName: string;
  accountNumber: string;
  transitNumber: string;
  employeeName: string;
  amount: number;
  reference: string;
};

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Build the bank file contents from a run's items. Pure given the lines. */
export function buildBankPayoutCsv(lines: BankPayoutLine[], runLabel: string): string {
  const header = "Bank,Account Number,Transit,Employee,Amount,Reference";
  const rows = lines.map((l) =>
    [l.bankName, l.accountNumber, l.transitNumber, l.employeeName, l.amount.toFixed(2), l.reference].map(csvEscape).join(",")
  );
  const total = roundMoney(lines.reduce((s, l) => s + l.amount, 0));
  return [header, ...rows, `TOTAL,,,${csvEscape(runLabel)},${total.toFixed(2)},${lines.length} payment(s)`].join("\r\n") + "\r\n";
}

/**
 * Create the bank-payout export for a finalized run. Every item's employee
 * must carry bank details; the file total must equal the run's net exactly
 * (Gate 20). Idempotent per run — an existing export is returned as-is.
 */
export async function createBankPayoutExport(runId: string) {
  const orgId = requireOrgId();
  const run = await prisma.payRun.findFirst({
    where: { id: runId },
    include: { period: true, items: { include: { employee: true }, orderBy: { employeeName: "asc" } } }
  });
  if (!run) throw new Error("Pay run not found.");
  if (!["finalized", "exported", "paid"].includes(run.status)) {
    throw new Error(`Bank payout requires a finalized run (current: ${run.status}).`);
  }
  const existing = await prisma.payrollExport.findFirst({ where: { runId, format: BANK_PAYOUT_FORMAT } });
  if (existing) return { exportRow: existing, reused: true };

  const missing = run.items.filter((i) => !i.employee.bankAccountNumber.trim());
  if (missing.length) {
    throw new Error(`Missing bank account numbers: ${missing.map((i) => i.employeeName).join(", ")}`);
  }
  const label = run.period.label || `${run.period.startDate.toISOString().slice(0, 10)} run`;
  const lines: BankPayoutLine[] = run.items.map((i) => ({
    bankName: i.employee.bankName || "BVI Bank",
    accountNumber: i.employee.bankAccountNumber,
    transitNumber: i.employee.bankTransitNumber,
    employeeName: i.employeeName,
    amount: roundMoney(i.net),
    reference: `PAYROLL ${label}`.slice(0, 40)
  }));
  const totalFile = roundMoney(lines.reduce((s, l) => s + l.amount, 0));
  const totalRun = roundMoney(run.items.reduce((s, i) => s + i.net, 0));
  if (totalFile !== totalRun) {
    throw new Error(`Bank file total ${totalFile} does not equal approved net payroll ${totalRun}.`);
  }
  const csv = buildBankPayoutCsv(lines, label);
  const fileName = `bank-payout-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${run.id.slice(-6)}.csv`;
  const exportRow = await prisma.payrollExport.create({
    data: { orgId, runId, format: BANK_PAYOUT_FORMAT, fileName, contents: csv }
  });
  return { exportRow, reused: false, totalNet: totalFile, itemCount: lines.length };
}
