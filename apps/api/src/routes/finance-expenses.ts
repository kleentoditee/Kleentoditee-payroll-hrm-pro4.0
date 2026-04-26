import { AccountType, PaymentMethod, Role, TransactionStatus, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  nextExpenseNumber,
  rollupTotals,
  round2
} from "../lib/finance-transactions.js";
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

function parseMethod(v: unknown): PaymentMethod | null {
  if (v === "cash" || v === "check" || v === "card" || v === "ach" || v === "other") {
    return v;
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

type IncomingLine = {
  position?: number;
  description?: string;
  quantity?: number;
  unitCost?: number;
  expenseAccountId?: string;
  taxable?: boolean;
  taxAmount?: number;
};

async function resolveLines(lines: IncomingLine[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one line is required.");
  }
  const resolved = lines.map((line, index) => {
    const quantity = Number(line.quantity ?? 1);
    const unitCost = Number(line.unitCost ?? 0);
    const taxAmount = round2(Number(line.taxAmount ?? 0));
    const amount = round2(quantity * unitCost);
    const expenseAccountId = String(line.expenseAccountId ?? "").trim();
    if (!expenseAccountId) {
      throw new Error(`Line ${index + 1}: expenseAccountId is required.`);
    }
    return {
      position: line.position ?? index + 1,
      description: String(line.description ?? ""),
      quantity,
      unitCost,
      expenseAccountId,
      taxable: Boolean(line.taxable ?? false),
      taxAmount,
      amount
    };
  });

  const accountIds = Array.from(new Set(resolved.map((l) => l.expenseAccountId)));
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  for (const [i, line] of resolved.entries()) {
    const account = accountById.get(line.expenseAccountId);
    if (!account) {
      throw new Error(`Line ${i + 1}: expenseAccountId not found.`);
    }
    if (account.type !== AccountType.expense) {
      throw new Error(`Line ${i + 1}: expenseAccountId must reference an expense account.`);
    }
  }

  return resolved;
}

export const financeExpensesRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/expenses", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = c.req.query("status");
    const supplierId = c.req.query("supplierId");
    const items = await prisma.expense.findMany({
      where: {
        ...(status === "draft" || status === "open" || status === "void" ? { status } : {}),
        ...(supplierId ? { supplierId } : {})
      },
      include: {
        supplier: { select: { id: true, displayName: true } },
        paymentAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } }
      },
      orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/expenses/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const expense = await prisma.expense.findUnique({
      where: { id: c.req.param("id") },
      include: {
        supplier: true,
        paymentAccount: true,
        lines: { include: { expenseAccount: true }, orderBy: { position: "asc" } }
      }
    });
    if (!expense) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ expense });
  })
  .post("/expenses", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const expenseDate = parseDate(body.expenseDate) ?? new Date();
      const method = parseMethod(body.method) ?? PaymentMethod.card;

      const paymentAccountId = String(body.paymentAccountId ?? "").trim();
      if (!paymentAccountId) {
        return c.json({ error: "paymentAccountId is required." }, 400);
      }
      const paymentAccount = await prisma.account.findUnique({ where: { id: paymentAccountId } });
      if (!paymentAccount) {
        return c.json({ error: "paymentAccountId not found." }, 400);
      }
      if (paymentAccount.type !== AccountType.asset) {
        return c.json({ error: "paymentAccountId must reference an asset account." }, 400);
      }

      let supplierId: string | null = null;
      if (body.supplierId && String(body.supplierId).trim()) {
        supplierId = String(body.supplierId).trim();
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) {
          return c.json({ error: "supplierId not found." }, 400);
        }
      }

      const lines = await resolveLines((body.lines ?? []) as IncomingLine[]);
      const totals = rollupTotals(lines, 0);
      const number = String(body.number ?? "").trim() || (await nextExpenseNumber());

      const row = await prisma.expense.create({
        data: {
          number,
          expenseDate,
          method,
          reference: String(body.reference ?? ""),
          memo: String(body.memo ?? ""),
          supplierId,
          payeeName: String(body.payeeName ?? ""),
          paymentAccountId,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          status: TransactionStatus.draft,
          lines: { create: lines }
        },
        include: {
          supplier: true,
          paymentAccount: true,
          lines: { include: { expenseAccount: true }, orderBy: { position: "asc" } }
        }
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "expense.create",
        entityType: "Expense",
        entityId: row.id,
        after: row
      });
      return c.json({ expense: row }, 201);
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "Expense number already exists." }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not create expense." }, 400);
    }
  })
  .patch("/expenses/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const id = c.req.param("id");
      const before = await prisma.expense.findUnique({ where: { id }, include: { lines: true } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      if (before.status !== TransactionStatus.draft) {
        return c.json({ error: "Only draft expenses can be edited." }, 409);
      }
      const body = await c.req.json<Record<string, unknown>>();
      const data: Record<string, unknown> = {};

      if (body.expenseDate !== undefined) {
        const d = parseDate(body.expenseDate);
        if (!d) return c.json({ error: "Invalid expenseDate." }, 400);
        data.expenseDate = d;
      }
      if (body.method !== undefined) {
        const m = parseMethod(body.method);
        if (!m) return c.json({ error: "Invalid method." }, 400);
        data.method = m;
      }
      if (body.reference !== undefined) data.reference = String(body.reference);
      if (body.memo !== undefined) data.memo = String(body.memo);
      if (body.payeeName !== undefined) data.payeeName = String(body.payeeName);
      if (body.supplierId !== undefined) {
        if (body.supplierId === null || String(body.supplierId).trim() === "") {
          data.supplierId = null;
        } else {
          const sid = String(body.supplierId).trim();
          const s = await prisma.supplier.findUnique({ where: { id: sid } });
          if (!s) return c.json({ error: "supplierId not found." }, 400);
          data.supplierId = sid;
        }
      }
      if (body.paymentAccountId !== undefined) {
        const pid = String(body.paymentAccountId).trim();
        const p = await prisma.account.findUnique({ where: { id: pid } });
        if (!p) return c.json({ error: "paymentAccountId not found." }, 400);
        if (p.type !== AccountType.asset) {
          return c.json({ error: "paymentAccountId must reference an asset account." }, 400);
        }
        data.paymentAccountId = pid;
      }

      let nextLines: Awaited<ReturnType<typeof resolveLines>> | null = null;
      if (body.lines !== undefined) {
        nextLines = await resolveLines(body.lines as IncomingLine[]);
        const totals = rollupTotals(nextLines, 0);
        data.subtotal = totals.subtotal;
        data.taxTotal = totals.taxTotal;
        data.total = totals.total;
      }

      if (Object.keys(data).length === 0 && !nextLines) {
        return c.json({ error: "No fields to update." }, 400);
      }

      const row = await prisma.$transaction(async (tx) => {
        if (nextLines) {
          await tx.expenseLine.deleteMany({ where: { expenseId: id } });
          await tx.expense.update({
            where: { id },
            data: { ...data, lines: { create: nextLines } }
          });
        } else {
          await tx.expense.update({ where: { id }, data: data as never });
        }
        return tx.expense.findUnique({
          where: { id },
          include: {
            supplier: true,
            paymentAccount: true,
            lines: { include: { expenseAccount: true }, orderBy: { position: "asc" } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "expense.update",
        entityType: "Expense",
        entityId: id,
        before,
        after: row
      });
      return c.json({ expense: row });
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "Expense number already exists." }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not update expense." }, 400);
    }
  })
  .post("/expenses/:id/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.expense.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft expenses can be posted." }, 409);
    }
    if (before.total <= 0) {
      return c.json({ error: "Expense total must be greater than zero before posting." }, 409);
    }
    const row = await prisma.expense.update({
      where: { id },
      data: { status: TransactionStatus.open, postedAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "expense.post",
      entityType: "Expense",
      entityId: id,
      before,
      after: row
    });
    return c.json({ expense: row });
  })
  .post("/expenses/:id/void", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.expense.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === TransactionStatus.void) {
      return c.json({ error: "Expense is already void." }, 409);
    }
    const row = await prisma.expense.update({
      where: { id },
      data: { status: TransactionStatus.void, voidedAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "expense.void",
      entityType: "Expense",
      entityId: id,
      before,
      after: row
    });
    return c.json({ expense: row });
  })
  .delete("/expenses/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.expense.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft expenses can be deleted; void posted expenses instead." }, 409);
    }
    await prisma.expense.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "expense.delete",
      entityType: "Expense",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
