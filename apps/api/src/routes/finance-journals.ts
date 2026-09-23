import { randomUUID } from "node:crypto";
import { FiscalPeriodStatus, JournalEntryStatus, Role, prisma, requireOrgId } from "@kleentoditee/db";
import { Hono, type Context } from "hono";
import { writeAudit } from "../lib/audit.js";
import { assertPeriodOpen, fiscalPeriodLabel, PeriodClosedError } from "../lib/fiscal-periods.js";
import { round2, sourceKey, validateJournalLines } from "../lib/gl-posting.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [Role.platform_owner, Role.finance_admin, Role.payroll_admin, Role.hr_admin] as const;
const CAN_EDIT = [Role.platform_owner, Role.finance_admin] as const;

const LINE_INCLUDE = {
  lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } }, orderBy: { position: "asc" as const } }
};

type IncomingLine = { accountId?: string; debit?: number; credit?: number; memo?: string };

function parseLines(raw: unknown): Array<{ accountId: string; debit: number; credit: number; memo: string }> | string {
  if (!Array.isArray(raw)) return "lines must be an array.";
  const lines = [];
  for (const l of raw as IncomingLine[]) {
    const accountId = String(l.accountId ?? "").trim();
    if (!accountId) return "Every line needs an accountId.";
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
      return "Debit/credit must be non-negative numbers.";
    }
    lines.push({ accountId, debit: round2(debit), credit: round2(credit), memo: String(l.memo ?? "").slice(0, 500) });
  }
  try {
    validateJournalLines(lines);
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid journal lines.";
  }
  return lines;
}

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Manual journal entries: draft -> approve -> post -> reverse (Batch 13). */
export const financeJournalRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/journals", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = c.req.query("status");
    const items = await prisma.journalEntry.findMany({
      where: {
        sourceType: "manual_journal",
        ...(status && ["draft", "approved", "posted", "void"].includes(status)
          ? { status: status as JournalEntryStatus }
          : {})
      },
      include: LINE_INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .post("/journals", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const date = parseDate(body.date);
    if (!date) return c.json({ error: "A valid date is required." }, 400);
    const memo = String(body.memo ?? "").trim().slice(0, 500);
    const lines = parseLines(body.lines);
    if (typeof lines === "string") return c.json({ error: lines }, 400);

    // Accounts must exist in this org (scoped lookup).
    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } }, select: { id: true } });
    if (accounts.length !== accountIds.length) {
      return c.json({ error: "One or more accounts do not exist." }, 400);
    }

    try {
      await assertPeriodOpen(prisma, date);
    } catch (e) {
      if (e instanceof PeriodClosedError) return c.json({ error: e.message }, 409);
      throw e;
    }

    const id = randomUUID();
    const orgId = requireOrgId();
    const entry = await prisma.journalEntry.create({
      data: {
        id,
        orgId,
        date,
        memo,
        sourceType: "manual_journal",
        sourceId: id,
        sourceKey: sourceKey("manual_journal", id),
        status: JournalEntryStatus.draft,
        createdByUserId: c.get("userId"),
        lines: { create: lines.map((l, i) => ({ orgId, position: i + 1, ...l })) }
      },
      include: LINE_INCLUDE
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "manual_journal.create",
      entityType: "JournalEntry",
      entityId: entry.id,
      after: entry
    });
    return c.json({ journal: entry }, 201);
  })
  .post("/journals/:id/approve", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const entry = await prisma.journalEntry.findFirst({
      where: { id, sourceType: "manual_journal" },
      include: LINE_INCLUDE
    });
    if (!entry) return c.json({ error: "Not found" }, 404);
    if (entry.status !== JournalEntryStatus.draft) {
      return c.json({ error: "Only draft journals can be approved." }, 409);
    }
    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { status: JournalEntryStatus.approved },
      include: LINE_INCLUDE
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "manual_journal.approve",
      entityType: "JournalEntry",
      entityId: id,
      before: { status: entry.status },
      after: { status: updated.status }
    });
    return c.json({ journal: updated });
  })
  .post("/journals/:id/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const entry = await prisma.journalEntry.findFirst({
      where: { id, sourceType: "manual_journal" },
      include: LINE_INCLUDE
    });
    if (!entry) return c.json({ error: "Not found" }, 404);
    if (entry.status !== JournalEntryStatus.draft && entry.status !== JournalEntryStatus.approved) {
      return c.json({ error: "Only draft or approved journals can be posted." }, 409);
    }
    try {
      await assertPeriodOpen(prisma, entry.date);
    } catch (e) {
      if (e instanceof PeriodClosedError) return c.json({ error: e.message }, 409);
      throw e;
    }
    const updated = await prisma.journalEntry.update({
      where: { id },
      data: { status: JournalEntryStatus.posted },
      include: LINE_INCLUDE
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "manual_journal.post",
      entityType: "JournalEntry",
      entityId: id,
      before: { status: entry.status },
      after: { status: updated.status }
    });
    return c.json({ journal: updated });
  })
  .post("/journals/:id/reverse", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const entry = await prisma.journalEntry.findFirst({
      where: { id, sourceType: "manual_journal" },
      include: { lines: true }
    });
    if (!entry) return c.json({ error: "Not found" }, 404);
    if (entry.status !== JournalEntryStatus.posted) {
      return c.json({ error: "Only posted journals can be reversed." }, 409);
    }
    const existingReversal = await prisma.journalEntry.findFirst({
      where: { sourceKey: sourceKey("manual_journal_reversal", id) },
      select: { id: true }
    });
    if (existingReversal) {
      return c.json({ error: "This journal is already reversed." }, 409);
    }

    const now = new Date();
    try {
      await assertPeriodOpen(prisma, now);
    } catch (e) {
      if (e instanceof PeriodClosedError) return c.json({ error: e.message }, 409);
      throw e;
    }

    const reversalId = randomUUID();
    const orgId = requireOrgId();
    const reversal = await prisma.$transaction(async (tx) => {
      const rev = await tx.journalEntry.create({
        data: {
          id: reversalId,
          orgId,
          date: now,
          memo: `Reversal of manual journal ${id.slice(0, 8)}: ${entry.memo}`.slice(0, 500),
          sourceType: "manual_journal_reversal",
          sourceId: id,
          sourceKey: sourceKey("manual_journal_reversal", id),
          status: JournalEntryStatus.posted,
          reversalOfId: entry.id,
          createdByUserId: c.get("userId"),
          lines: {
            create: entry.lines.map((l, i) => ({
              orgId,
              position: i + 1,
              accountId: l.accountId,
              debit: l.credit,
              credit: l.debit,
              memo: l.memo
            }))
          }
        },
        include: LINE_INCLUDE
      });
      await tx.journalEntry.update({ where: { id }, data: { status: JournalEntryStatus.void } });
      return rev;
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "manual_journal.reverse",
      entityType: "JournalEntry",
      entityId: id,
      after: { reversalId }
    });
    return c.json({ journal: reversal });
  })
  .delete("/journals/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const entry = await prisma.journalEntry.findFirst({
      where: { id, sourceType: "manual_journal" },
      select: { id: true, status: true }
    });
    if (!entry) return c.json({ error: "Not found" }, 404);
    if (entry.status !== JournalEntryStatus.draft) {
      return c.json({ error: "Only draft journals can be deleted. Reverse a posted journal instead." }, 409);
    }
    await prisma.journalEntry.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "manual_journal.delete_draft",
      entityType: "JournalEntry",
      entityId: id
    });
    return c.json({ ok: true });
  });

type Ctx = Context<{ Variables: AuthVariables }>;

async function setPeriodStatus(c: Ctx, target: FiscalPeriodStatus, allowedFrom: FiscalPeriodStatus[]) {
  const id = c.req.param("id");
  const period = await prisma.fiscalPeriod.findFirst({ where: { id } });
  if (!period) return c.json({ error: "Not found" }, 404);
  if (!allowedFrom.includes(period.status)) {
    return c.json(
      { error: `Period ${fiscalPeriodLabel(period.year, period.period)} is ${period.status}; cannot move to ${target}.` },
      409
    );
  }
  const updated = await prisma.fiscalPeriod.update({
    where: { id },
    data: {
      status: target,
      closedAt: target === FiscalPeriodStatus.open ? null : new Date(),
      closedByUserId: target === FiscalPeriodStatus.open ? null : c.get("userId")
    }
  });
  await writeAudit({
    actorUserId: c.get("userId"),
    action: `fiscal_period.${target === FiscalPeriodStatus.open ? "reopen" : target === FiscalPeriodStatus.locked ? "lock" : "close"}`,
    entityType: "FiscalPeriod",
    entityId: id,
    before: { status: period.status },
    after: { status: target }
  });
  return c.json({ period: updated });
}

/** Fiscal period management (Batch 13). */
export const fiscalPeriodRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/periods", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const years = await prisma.fiscalYear.findMany({
      include: { periods: { orderBy: { period: "asc" } } },
      orderBy: { year: "desc" }
    });
    return c.json({ items: years });
  })
  .post("/periods/:id/close", authRequired, requireRole(...CAN_EDIT), (c) => setPeriodStatus(c, FiscalPeriodStatus.soft_closed, [FiscalPeriodStatus.open]))
  .post("/periods/:id/lock", authRequired, requireRole(...CAN_EDIT), (c) => setPeriodStatus(c, FiscalPeriodStatus.locked, [FiscalPeriodStatus.open, FiscalPeriodStatus.soft_closed]))
  .post("/periods/:id/reopen", authRequired, requireRole(Role.platform_owner), (c) => setPeriodStatus(c, FiscalPeriodStatus.open, [FiscalPeriodStatus.soft_closed, FiscalPeriodStatus.locked]));
