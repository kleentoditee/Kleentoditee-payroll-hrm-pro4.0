import {
  BankReconciliationStatus,
  BankStatementLineStatus,
  JournalEntryStatus,
  Role,
  TransactionStatus,
  prisma,
  requireOrgId
} from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  rankCandidates,
  type MatchEntityType,
  type ScorableDocument
} from "../lib/bank-matching.js";
import {
  buildStatementPlan,
  parseCsvText,
  suggestStatementMapping,
  type StatementMapping
} from "../lib/bank-statements.js";
import { round2 } from "../lib/finance-transactions.js";
import { loadAccountLedger } from "../lib/gl-reports.js";
import { paginationMeta, parseListQuery } from "../lib/pagination.js";
import { isUniqueConstraintError } from "../lib/prisma-errors.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.finance_admin] as const;

const MONEY_TOLERANCE = 0.005;
const RECON_TOLERANCE = 0.005;

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseMapping(raw: unknown): StatementMapping {
  const m = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : undefined);
  return {
    date: num(m.date),
    description: num(m.description),
    reference: num(m.reference),
    amount: num(m.amount),
    debit: num(m.debit),
    credit: num(m.credit)
  };
}

/** Signed bank-perspective amount for a document candidate. */
type BankDoc = ScorableDocument;

async function loadBankDocumentCandidates(bankAccountId: string, aroundDate?: Date): Promise<BankDoc[]> {
  const dateWindow = aroundDate
    ? {
        gte: new Date(aroundDate.getTime() - 31 * 86_400_000),
        lte: new Date(aroundDate.getTime() + 31 * 86_400_000)
      }
    : undefined;

  const [payments, deposits, expenses, billPayments, journals] = await Promise.all([
    prisma.payment.findMany({
      where: { depositAccountId: bankAccountId, ...(dateWindow ? { paymentDate: dateWindow } : {}) },
      select: { id: true, number: true, paymentDate: true, amount: true, reference: true, memo: true, customer: { select: { displayName: true } } }
    }),
    prisma.deposit.findMany({
      where: { bankAccountId, status: TransactionStatus.open, ...(dateWindow ? { depositDate: dateWindow } : {}) },
      select: { id: true, number: true, depositDate: true, total: true, memo: true }
    }),
    prisma.expense.findMany({
      where: { paymentAccountId: bankAccountId, status: TransactionStatus.open, ...(dateWindow ? { expenseDate: dateWindow } : {}) },
      select: { id: true, number: true, expenseDate: true, total: true, reference: true, payeeName: true, memo: true }
    }),
    prisma.billPayment.findMany({
      where: { sourceAccountId: bankAccountId, ...(dateWindow ? { paymentDate: dateWindow } : {}) },
      select: { id: true, number: true, paymentDate: true, amount: true, reference: true, memo: true, supplier: { select: { displayName: true } } }
    }),
    prisma.journalEntry.findMany({
      where: {
        sourceType: "manual_journal",
        status: JournalEntryStatus.posted,
        lines: { some: { accountId: bankAccountId } },
        ...(dateWindow ? { date: dateWindow } : {})
      },
      select: { id: true, date: true, memo: true, lines: { where: { accountId: bankAccountId }, select: { debit: true, credit: true } } }
    })
  ]);

  const docs: BankDoc[] = [];
  for (const p of payments) {
    docs.push({
      entityType: "payment",
      entityId: p.id,
      label: p.number,
      date: toISO(p.paymentDate),
      amount: round2(p.amount),
      reference: p.reference,
      description: [p.customer.displayName, p.memo].filter(Boolean).join(" — ")
    });
  }
  for (const d of deposits) {
    docs.push({
      entityType: "deposit",
      entityId: d.id,
      label: d.number,
      date: toISO(d.depositDate),
      amount: round2(d.total),
      reference: "",
      description: d.memo || d.number
    });
  }
  for (const e of expenses) {
    docs.push({
      entityType: "expense",
      entityId: e.id,
      label: e.number,
      date: toISO(e.expenseDate),
      amount: round2(-e.total),
      reference: e.reference,
      description: [e.payeeName, e.memo].filter(Boolean).join(" — ")
    });
  }
  for (const b of billPayments) {
    docs.push({
      entityType: "bill_payment",
      entityId: b.id,
      label: b.number,
      date: toISO(b.paymentDate),
      amount: round2(-b.amount),
      reference: b.reference,
      description: [b.supplier.displayName, b.memo].filter(Boolean).join(" — ")
    });
  }
  for (const j of journals) {
    const net = round2(j.lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
    if (Math.abs(net) <= MONEY_TOLERANCE) continue;
    docs.push({
      entityType: "journal",
      entityId: j.id,
      label: "Manual journal",
      date: toISO(j.date),
      amount: net,
      reference: "",
      description: j.memo || "Manual journal"
    });
  }
  return docs;
}

/** Resolve one document and its signed bank amount for match validation. */
async function resolveMatchTarget(
  bankAccountId: string,
  entityType: MatchEntityType,
  entityId: string
): Promise<{ label: string; amount: number } | null> {
  if (entityType === "payment") {
    const p = await prisma.payment.findUnique({ where: { id: entityId }, select: { number: true, amount: true, depositAccountId: true } });
    if (!p || p.depositAccountId !== bankAccountId) return null;
    return { label: p.number, amount: round2(p.amount) };
  }
  if (entityType === "deposit") {
    const d = await prisma.deposit.findUnique({ where: { id: entityId }, select: { number: true, total: true, bankAccountId: true, status: true } });
    if (!d || d.bankAccountId !== bankAccountId || d.status !== TransactionStatus.open) return null;
    return { label: d.number, amount: round2(d.total) };
  }
  if (entityType === "expense") {
    const e = await prisma.expense.findUnique({ where: { id: entityId }, select: { number: true, total: true, paymentAccountId: true, status: true } });
    if (!e || e.paymentAccountId !== bankAccountId || e.status !== TransactionStatus.open) return null;
    return { label: e.number, amount: round2(-e.total) };
  }
  if (entityType === "bill_payment") {
    const b = await prisma.billPayment.findUnique({ where: { id: entityId }, select: { number: true, amount: true, sourceAccountId: true } });
    if (!b || b.sourceAccountId !== bankAccountId) return null;
    return { label: b.number, amount: round2(-b.amount) };
  }
  if (entityType === "journal") {
    const j = await prisma.journalEntry.findUnique({
      where: { id: entityId },
      select: { memo: true, status: true, sourceType: true, lines: { where: { accountId: bankAccountId }, select: { debit: true, credit: true } } }
    });
    if (!j || j.sourceType !== "manual_journal" || j.status !== JournalEntryStatus.posted) return null;
    const net = round2(j.lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0));
    if (Math.abs(net) <= MONEY_TOLERANCE) return null;
    return { label: j.memo || "Manual journal", amount: net };
  }
  return null;
}

function reconSummary(r: { openingBalance: number; statementEndingBalance: number }, clearedNet: number) {
  const net = round2(clearedNet);
  return { clearedNet: net, difference: round2(r.statementEndingBalance - (r.openingBalance + net)) };
}

export const financeBankingRoutes = new Hono<{ Variables: AuthVariables }>()

  // ---------------------------------------------------------------------
  // Statement imports
  // ---------------------------------------------------------------------

  .get("/banking/imports", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const bankAccountId = c.req.query("bankAccountId");
    const items = await prisma.bankStatementImport.findMany({
      where: bankAccountId ? { bankAccountId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { bankAccount: { select: { id: true, code: true, name: true } }, _count: { select: { lines: true } } }
    });
    return c.json({ items });
  })

  .post("/banking/imports/preview", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const bankAccountId = String(body.bankAccountId ?? "").trim();
    const account = bankAccountId ? await prisma.account.findUnique({ where: { id: bankAccountId } }) : null;
    if (!account) return c.json({ error: "bankAccountId not found." }, 400);

    const csv = String(body.csv ?? body.fileContent ?? "");
    if (!csv.trim()) return c.json({ error: "No CSV content supplied." }, 400);
    const table = parseCsvText(csv);
    if (table.length < 2) return c.json({ error: "The file needs a header row plus at least one transaction row." }, 400);
    const headers = table[0];
    const mapping = body.mapping ? parseMapping(body.mapping) : suggestStatementMapping(headers);
    const plan = buildStatementPlan({ headers, rows: table.slice(1), mapping, bankAccountId });

    // Flag rows already imported (duplicate detection, preview side).
    const existing = plan.rows.length
      ? await prisma.bankStatementLine.findMany({
          where: { fingerprint: { in: plan.rows.map((r) => r.fingerprint) } },
          select: { fingerprint: true }
        })
      : [];
    const existingSet = new Set(existing.map((e) => e.fingerprint));
    const rows = plan.rows.map((r) => ({ ...r, duplicate: existingSet.has(r.fingerprint) }));

    return c.json({
      plan: {
        headers: plan.headers,
        mapping: plan.mapping,
        rows: rows.slice(0, 50),
        rowCount: plan.rowCount,
        parsedCount: plan.rows.length,
        duplicateCount: rows.filter((r) => r.duplicate).length,
        validationErrors: plan.validationErrors,
        warnings: plan.warnings
      }
    });
  })

  .post("/banking/imports/commit", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const bankAccountId = String(body.bankAccountId ?? "").trim();
    const account = bankAccountId ? await prisma.account.findUnique({ where: { id: bankAccountId } }) : null;
    if (!account) return c.json({ error: "bankAccountId not found." }, 400);

    const csv = String(body.csv ?? body.fileContent ?? "");
    if (!csv.trim()) return c.json({ error: "No CSV content supplied." }, 400);
    const table = parseCsvText(csv);
    if (table.length < 2) return c.json({ error: "The file needs a header row plus at least one transaction row." }, 400);
    const mapping = body.mapping ? parseMapping(body.mapping) : suggestStatementMapping(table[0]);
    const plan = buildStatementPlan({ headers: table[0], rows: table.slice(1), mapping, bankAccountId });
    if (plan.validationErrors.length > 0 && plan.rows.length === 0) {
      return c.json({ error: "No importable rows.", validationErrors: plan.validationErrors }, 400);
    }

    const existing = plan.rows.length
      ? await prisma.bankStatementLine.findMany({
          where: { fingerprint: { in: plan.rows.map((r) => r.fingerprint) } },
          select: { fingerprint: true }
        })
      : [];
    const existingSet = new Set(existing.map((e) => e.fingerprint));
    const fresh = plan.rows.filter((r) => !existingSet.has(r.fingerprint));
    const duplicates = plan.rows.length - fresh.length;

    const orgId = requireOrgId();
    const imported = await prisma.bankStatementImport.create({
      data: {
        orgId,
        bankAccountId,
        fileName: String(body.fileName ?? "").slice(0, 300),
        statementStartDate: parseDate(body.statementStartDate),
        statementEndDate: parseDate(body.statementEndDate),
        openingBalance: typeof body.openingBalance === "number" ? body.openingBalance : null,
        closingBalance: typeof body.closingBalance === "number" ? body.closingBalance : null,
        rowCount: plan.rows.length,
        duplicateCount: duplicates,
        importedByUserId: c.get("userId")
      }
    });

    let createdCount = 0;
    if (fresh.length > 0) {
      try {
        const result = await prisma.bankStatementLine.createMany({
          data: fresh.map((r) => ({
            orgId,
            importId: imported.id,
            position: r.position,
            date: new Date(`${r.date}T00:00:00.000Z`),
            description: r.description,
            reference: r.reference,
            amount: r.amount,
            fingerprint: r.fingerprint
          }))
        });
        createdCount = result.count;
      } catch (e) {
        if (!isUniqueConstraintError(e)) throw e;
        // Unique race: another import beat us — count conservatively.
        createdCount = 0;
      }
    }

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.statement_import",
      entityType: "BankStatementImport",
      entityId: imported.id,
      after: { fileName: imported.fileName, bankAccountId, rowCount: plan.rows.length, created: createdCount, duplicates }
    });
    return c.json({
      result: {
        importId: imported.id,
        rowCount: plan.rows.length,
        created: createdCount,
        duplicates,
        validationErrors: plan.validationErrors,
        warnings: plan.warnings
      }
    }, 201);
  })

  // ---------------------------------------------------------------------
  // Statement lines + matching
  // ---------------------------------------------------------------------

  .get("/banking/lines", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const list = parseListQuery((k) => c.req.query(k), {
      sortable: ["date", "position", "amount", "status", "reference", "createdAt"],
      defaultSort: [{ date: "asc" }, { position: "asc" }]
    });
    if (!list.ok) {
      return c.json({ error: list.error }, 400);
    }
    const bankAccountId = c.req.query("bankAccountId");
    const status = c.req.query("status");
    const where = {
      ...(bankAccountId ? { import: { bankAccountId } } : {}),
      ...(status ? { status: status as BankStatementLineStatus } : {}),
      ...(list.q
        ? { OR: [{ description: { contains: list.q } }, { reference: { contains: list.q } }] }
        : {})
    };
    const include = { import: { select: { id: true, fileName: true, bankAccountId: true } } };
    if (!list.paginated) {
      const items = await prisma.bankStatementLine.findMany({
        where,
        orderBy: list.orderBy,
        take: 500,
        include
      });
      return c.json({ items });
    }
    const [total, items] = await Promise.all([
      prisma.bankStatementLine.count({ where }),
      prisma.bankStatementLine.findMany({
        where,
        orderBy: list.orderBy,
        skip: list.skip,
        take: list.take,
        include
      })
    ]);
    return c.json({ items, pagination: paginationMeta(list.page, list.pageSize, total) });
  })

  .get("/banking/lines/:id/suggestions", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const line = await prisma.bankStatementLine.findUnique({
      where: { id: c.req.param("id") },
      include: { import: { select: { bankAccountId: true } } }
    });
    if (!line) return c.json({ error: "Not found" }, 404);

    const docs = await loadBankDocumentCandidates(line.import.bankAccountId, line.date);
    // A document already matched to another line is not a candidate.
    const taken = await prisma.bankStatementLine.findMany({
      where: { matchedEntityId: { not: null }, id: { not: line.id } },
      select: { matchedEntityType: true, matchedEntityId: true }
    });
    const takenSet = new Set(taken.map((t) => `${t.matchedEntityType}:${t.matchedEntityId}`));
    const available = docs.filter((d) => !takenSet.has(`${d.entityType}:${d.entityId}`));

    const suggestions = rankCandidates(
      { date: toISO(line.date), amount: line.amount, reference: line.reference, description: line.description },
      available
    );
    return c.json({ suggestions: suggestions.slice(0, 10) });
  })

  .post("/banking/lines/:id/match", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const line = await prisma.bankStatementLine.findUnique({
      where: { id: c.req.param("id") },
      include: { import: { select: { bankAccountId: true } } }
    });
    if (!line) return c.json({ error: "Not found" }, 404);
    if (line.status === BankStatementLineStatus.matched) {
      return c.json({ error: "Line is already matched. Unmatch it first." }, 409);
    }
    if (line.reconciledAt) {
      return c.json({ error: "Line is cleared in a completed reconciliation. Unlock that reconciliation first." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const entityType = String(body.entityType ?? "") as MatchEntityType;
    const entityId = String(body.entityId ?? "").trim();
    if (!["payment", "deposit", "expense", "bill_payment", "journal"].includes(entityType) || !entityId) {
      return c.json({ error: "entityType (payment|deposit|expense|bill_payment|journal) and entityId are required." }, 400);
    }

    const target = await resolveMatchTarget(line.import.bankAccountId, entityType, entityId);
    if (!target) return c.json({ error: "Document not found on this bank account (or no longer open)." }, 400);
    if (Math.abs(Math.abs(target.amount) - Math.abs(line.amount)) > MONEY_TOLERANCE || Math.sign(target.amount) !== Math.sign(line.amount)) {
      return c.json({ error: `Amount/sign mismatch: statement ${line.amount.toFixed(2)} vs document ${target.amount.toFixed(2)}.` }, 409);
    }
    const conflict = await prisma.bankStatementLine.findFirst({
      where: { matchedEntityType: entityType, matchedEntityId: entityId, id: { not: line.id } },
      select: { id: true }
    });
    if (conflict) return c.json({ error: "That document is already matched to another statement line." }, 409);

    const updated = await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: BankStatementLineStatus.matched,
        matchedEntityType: entityType,
        matchedEntityId: entityId,
        matchedAt: new Date(),
        matchedByUserId: c.get("userId")
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.line_match",
      entityType: "BankStatementLine",
      entityId: line.id,
      after: { entityType, entityId, label: target.label }
    });
    return c.json({ line: updated });
  })

  .post("/banking/lines/:id/unmatch", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const line = await prisma.bankStatementLine.findUnique({ where: { id: c.req.param("id") } });
    if (!line) return c.json({ error: "Not found" }, 404);
    if (line.reconciledAt) {
      return c.json({ error: "Line is cleared in a completed reconciliation. Unlock that reconciliation first." }, 409);
    }
    const updated = await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: { status: BankStatementLineStatus.unmatched, matchedEntityType: null, matchedEntityId: null, matchedAt: null, matchedByUserId: null }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.line_unmatch",
      entityType: "BankStatementLine",
      entityId: line.id
    });
    return c.json({ line: updated });
  })

  .post("/banking/lines/:id/exclude", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const line = await prisma.bankStatementLine.findUnique({ where: { id: c.req.param("id") } });
    if (!line) return c.json({ error: "Not found" }, 404);
    if (line.reconciledAt) {
      return c.json({ error: "Line is cleared in a completed reconciliation. Unlock that reconciliation first." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
    const next = line.status === BankStatementLineStatus.excluded
      ? BankStatementLineStatus.unmatched
      : BankStatementLineStatus.excluded;
    const updated = await prisma.bankStatementLine.update({
      where: { id: line.id },
      data: {
        status: next,
        ...(next === BankStatementLineStatus.excluded
          ? { matchedEntityType: null, matchedEntityId: null, matchedAt: null, matchedByUserId: null }
          : {})
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: next === BankStatementLineStatus.excluded ? "banking.line_exclude" : "banking.line_include",
      entityType: "BankStatementLine",
      entityId: line.id,
      after: { reason: String((body as Record<string, unknown>).reason ?? "") }
    });
    return c.json({ line: updated });
  })

  // ---------------------------------------------------------------------
  // Reconciliation sessions
  // ---------------------------------------------------------------------

  .get("/banking/reconciliations", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const list = parseListQuery((k) => c.req.query(k), {
      sortable: ["statementEndingDate", "status", "createdAt"],
      defaultSort: [{ createdAt: "desc" }]
    });
    if (!list.ok) {
      return c.json({ error: list.error }, 400);
    }
    const bankAccountId = c.req.query("bankAccountId");
    const where = bankAccountId ? { bankAccountId } : undefined;
    const include = {
      bankAccount: { select: { id: true, code: true, name: true } },
      _count: { select: { lines: true } }
    };
    if (!list.paginated) {
      const items = await prisma.bankReconciliation.findMany({
        where,
        orderBy: list.orderBy,
        take: 100,
        include
      });
      return c.json({ items });
    }
    const [total, items] = await Promise.all([
      prisma.bankReconciliation.count({ where }),
      prisma.bankReconciliation.findMany({
        where,
        orderBy: list.orderBy,
        skip: list.skip,
        take: list.take,
        include
      })
    ]);
    return c.json({ items, pagination: paginationMeta(list.page, list.pageSize, total) });
  })

  .post("/banking/reconciliations", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const bankAccountId = String(body.bankAccountId ?? "").trim();
    const account = bankAccountId ? await prisma.account.findUnique({ where: { id: bankAccountId } }) : null;
    if (!account) return c.json({ error: "bankAccountId not found." }, 400);
    const statementEndingDate = parseDate(body.statementEndingDate);
    if (!statementEndingDate) return c.json({ error: "A valid statementEndingDate is required." }, 400);
    const statementEndingBalance = Number(body.statementEndingBalance);
    if (!Number.isFinite(statementEndingBalance)) return c.json({ error: "A numeric statementEndingBalance is required." }, 400);

    const inProgress = await prisma.bankReconciliation.findFirst({
      where: { bankAccountId, status: BankReconciliationStatus.in_progress },
      select: { id: true }
    });
    if (inProgress) {
      return c.json({ error: "This account already has a reconciliation in progress. Complete or unlock/delete it first." }, 409);
    }

    const lastCompleted = await prisma.bankReconciliation.findFirst({
      where: { bankAccountId, status: BankReconciliationStatus.completed },
      orderBy: { completedAt: "desc" },
      select: { statementEndingBalance: true }
    });

    const recon = await prisma.bankReconciliation.create({
      data: {
        orgId: requireOrgId(),
        bankAccountId,
        statementEndingDate,
        statementEndingBalance: round2(statementEndingBalance),
        openingBalance: lastCompleted?.statementEndingBalance ?? 0,
        createdByUserId: c.get("userId"),
        ...reconSummary({ openingBalance: lastCompleted?.statementEndingBalance ?? 0, statementEndingBalance }, 0)
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.reconciliation_create",
      entityType: "BankReconciliation",
      entityId: recon.id,
      after: recon
    });
    return c.json({ reconciliation: recon }, 201);
  })

  .get("/banking/reconciliations/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const recon = await prisma.bankReconciliation.findUnique({
      where: { id: c.req.param("id") },
      include: {
        bankAccount: { select: { id: true, code: true, name: true } },
        lines: { orderBy: { date: "asc" }, include: { statementLine: { select: { id: true, status: true, matchedEntityType: true, matchedEntityId: true, reference: true } } } }
      }
    });
    if (!recon) return c.json({ error: "Not found" }, 404);

    // Outstanding items: documents on this bank account never reconciled.
    const docs = await loadBankDocumentCandidates(recon.bankAccountId);
    const reconciled = await prisma.bankStatementLine.findMany({
      where: { reconciledAt: { not: null }, matchedEntityId: { not: null } },
      select: { matchedEntityType: true, matchedEntityId: true }
    });
    const reconciledSet = new Set(reconciled.map((r) => `${r.matchedEntityType}:${r.matchedEntityId}`));
    const outstanding = docs.filter((d) => !reconciledSet.has(`${d.entityType}:${d.entityId}`));

    return c.json({ reconciliation: recon, outstanding });
  })

  .post("/banking/reconciliations/:id/clear", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const recon = await prisma.bankReconciliation.findUnique({
      where: { id: c.req.param("id") },
      include: { lines: { select: { amount: true } } }
    });
    if (!recon) return c.json({ error: "Not found" }, 404);
    if (recon.status !== BankReconciliationStatus.in_progress) {
      return c.json({ error: "This reconciliation is completed. Unlock it to change cleared lines." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const statementLineId = String(body.statementLineId ?? "").trim();
    const line = statementLineId
      ? await prisma.bankStatementLine.findUnique({ where: { id: statementLineId }, include: { import: { select: { bankAccountId: true } } } })
      : null;
    if (!line) return c.json({ error: "statementLineId not found." }, 400);
    if (line.import.bankAccountId !== recon.bankAccountId) {
      return c.json({ error: "That statement line belongs to a different bank account." }, 400);
    }
    if (line.status === BankStatementLineStatus.excluded) {
      return c.json({ error: "Excluded lines cannot be cleared. Include the line first." }, 400);
    }
    const elsewhere = await prisma.bankReconciliationLine.findFirst({
      where: { statementLineId, reconciliation: { status: BankReconciliationStatus.completed } },
      select: { id: true }
    });
    if (elsewhere) {
      return c.json({ error: "That line is already cleared in a completed reconciliation." }, 409);
    }

    try {
      await prisma.bankReconciliationLine.create({
        data: {
          orgId: requireOrgId(),
          reconciliationId: recon.id,
          statementLineId: line.id,
          date: line.date,
          description: line.description,
          amount: line.amount
        }
      });
    } catch (e) {
      if (isUniqueConstraintError(e)) return c.json({ error: "Line is already cleared in this reconciliation." }, 409);
      throw e;
    }
    const clearedNet = round2(recon.lines.reduce((s, l) => s + l.amount, 0) + line.amount);
    const updated = await prisma.bankReconciliation.update({
      where: { id: recon.id },
      data: reconSummary(recon, clearedNet)
    });
    return c.json({ reconciliation: updated });
  })

  .post("/banking/reconciliations/:id/unclear", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const recon = await prisma.bankReconciliation.findUnique({
      where: { id: c.req.param("id") },
      include: { lines: { select: { amount: true, statementLineId: true } } }
    });
    if (!recon) return c.json({ error: "Not found" }, 404);
    if (recon.status !== BankReconciliationStatus.in_progress) {
      return c.json({ error: "This reconciliation is completed. Unlock it to change cleared lines." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const statementLineId = String(body.statementLineId ?? "").trim();
    const existing = recon.lines.find((l) => l.statementLineId === statementLineId);
    if (!existing) return c.json({ error: "That line is not cleared in this reconciliation." }, 404);
    await prisma.bankReconciliationLine.delete({
      where: { reconciliationId_statementLineId: { reconciliationId: recon.id, statementLineId } }
    });
    const clearedNet = round2(recon.lines.filter((l) => l.statementLineId !== statementLineId).reduce((s, l) => s + l.amount, 0));
    const updated = await prisma.bankReconciliation.update({
      where: { id: recon.id },
      data: reconSummary(recon, clearedNet)
    });
    return c.json({ reconciliation: updated });
  })

  .post("/banking/reconciliations/:id/complete", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const recon = await prisma.bankReconciliation.findUnique({
      where: { id: c.req.param("id") },
      include: { lines: true }
    });
    if (!recon) return c.json({ error: "Not found" }, 404);
    if (recon.status !== BankReconciliationStatus.in_progress) {
      return c.json({ error: "Reconciliation is already completed." }, 409);
    }
    const { clearedNet, difference } = reconSummary(recon, recon.lines.reduce((s, l) => s + l.amount, 0));
    if (Math.abs(difference) > RECON_TOLERANCE) {
      return c.json({
        error: `Out of balance: statement ending ${recon.statementEndingBalance.toFixed(2)} vs opening ${recon.openingBalance.toFixed(2)} + cleared ${clearedNet.toFixed(2)} (difference ${difference.toFixed(2)}).`
      }, 409);
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.bankReconciliation.update({
        where: { id: recon.id },
        data: {
          status: BankReconciliationStatus.completed,
          completedAt: now,
          completedByUserId: c.get("userId"),
          clearedNet,
          difference: 0
        }
      });
      await tx.bankStatementLine.updateMany({
        where: { id: { in: recon.lines.map((l) => l.statementLineId) } },
        data: { reconciledAt: now }
      });
      return row;
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.reconciliation_complete",
      entityType: "BankReconciliation",
      entityId: recon.id,
      after: { clearedNet, lineCount: recon.lines.length, statementEndingBalance: recon.statementEndingBalance }
    });
    return c.json({ reconciliation: updated });
  })

  .post("/banking/reconciliations/:id/unlock", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const recon = await prisma.bankReconciliation.findUnique({
      where: { id: c.req.param("id") },
      include: { lines: { select: { statementLineId: true } } }
    });
    if (!recon) return c.json({ error: "Not found" }, 404);
    if (recon.status !== BankReconciliationStatus.completed) {
      return c.json({ error: "Only a completed reconciliation can be unlocked." }, 409);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const reason = String(body.reason ?? "").trim();
    if (!reason) return c.json({ error: "An unlock reason is required (audit)." }, 400);
    const latest = await prisma.bankReconciliation.findFirst({
      where: { bankAccountId: recon.bankAccountId, status: BankReconciliationStatus.completed },
      orderBy: { completedAt: "desc" },
      select: { id: true }
    });
    if (latest?.id !== recon.id) {
      return c.json({ error: "Only the latest completed reconciliation for this account can be unlocked." }, 409);
    }
    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.bankReconciliation.update({
        where: { id: recon.id },
        data: {
          status: BankReconciliationStatus.in_progress,
          unlockedAt: now,
          unlockedByUserId: c.get("userId"),
          unlockReason: reason
        }
      });
      await tx.bankStatementLine.updateMany({
        where: { id: { in: recon.lines.map((l) => l.statementLineId) } },
        data: { reconciledAt: null }
      });
      return row;
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "banking.reconciliation_unlock",
      entityType: "BankReconciliation",
      entityId: recon.id,
      after: { reason }
    });
    return c.json({ reconciliation: updated });
  })

  // ---------------------------------------------------------------------
  // Bank register: GL ledger annotated with reconciliation state
  // ---------------------------------------------------------------------

  .get("/banking/register/:accountId", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const accountId = c.req.param("accountId");
    const from = parseDate(c.req.query("from"));
    const to = parseDate(c.req.query("to"));
    const ledger = await loadAccountLedger(accountId, from ?? undefined, to ?? undefined);
    if (!ledger) return c.json({ error: "Account not found." }, 404);

    const reconciled = await prisma.bankStatementLine.findMany({
      where: { reconciledAt: { not: null }, matchedEntityId: { not: null } },
      select: { matchedEntityType: true, matchedEntityId: true }
    });
    const reconciledSet = new Set(reconciled.map((r) => `${r.matchedEntityType}:${r.matchedEntityId}`));
    const mapSource = (sourceType: string): MatchEntityType | null => {
      const base = sourceType.replace(/_reversal$/, "");
      if (base === "payment") return "payment";
      if (base === "deposit_posted") return "deposit";
      if (base === "expense") return "expense";
      if (base === "bill_payment") return "bill_payment";
      if (base === "manual_journal") return "journal";
      return null;
    };
    const rows = ledger.rows.map((r) => {
      const entityType = mapSource(r.sourceType);
      return {
        ...r,
        entityType,
        reconciled: entityType ? reconciledSet.has(`${entityType}:${r.sourceId}`) : false
      };
    });
    return c.json({ register: { ...ledger, rows } });
  });
