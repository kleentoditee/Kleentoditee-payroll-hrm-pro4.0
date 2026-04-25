import { AccountType, Role, TransactionStatus, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  computeBillLine,
  nextBillNumber,
  rollupTotals
} from "../lib/finance-transactions.js";
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

function parseStatus(v: unknown): TransactionStatus | null {
  if (
    v === "draft" ||
    v === "open" ||
    v === "partial" ||
    v === "paid" ||
    v === "void"
  ) {
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
  productId?: string | null;
  description?: string;
  quantity: number;
  unitCost?: number;
  expenseAccountId?: string;
  taxable?: boolean;
  taxAmount?: number;
};

async function resolveLines(lines: IncomingLine[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one line is required.");
  }

  const productIds = Array.from(
    new Set(lines.map((l) => l.productId).filter((v): v is string => typeof v === "string" && v.length > 0))
  );
  const products = productIds.length
    ? await prisma.product.findMany({ where: { id: { in: productIds } } })
    : [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const resolved = lines.map((line, index) => {
    let productId: string | null = null;
    if (line.productId) {
      const p = productById.get(line.productId);
      if (!p) {
        throw new Error(`Line ${index + 1}: productId not found.`);
      }
      productId = p.id;
    }
    const expenseAccountId =
      line.expenseAccountId && String(line.expenseAccountId).trim()
        ? String(line.expenseAccountId).trim()
        : productId
        ? productById.get(productId)!.expenseAccountId ?? ""
        : "";
    if (!expenseAccountId) {
      throw new Error(`Line ${index + 1}: expenseAccountId is required when no product with a mapped expense account is selected.`);
    }
    return computeBillLine(
      {
        ...line,
        productId,
        expenseAccountId
      },
      index
    );
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

export const financeBillsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/bills", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = parseStatus(c.req.query("status"));
    const supplierId = c.req.query("supplierId");
    const items = await prisma.bill.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(supplierId ? { supplierId } : {})
      },
      include: {
        supplier: { select: { id: true, displayName: true } },
        _count: { select: { lines: true } }
      },
      orderBy: [{ billDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/bills/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const bill = await prisma.bill.findUnique({
      where: { id: c.req.param("id") },
      include: {
        supplier: true,
        lines: {
          include: { product: true, expenseAccount: true },
          orderBy: { position: "asc" }
        }
      }
    });
    if (!bill) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ bill });
  })
  .post("/bills", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const supplierId = String(body.supplierId ?? "").trim();
      if (!supplierId) {
        return c.json({ error: "supplierId is required." }, 400);
      }
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) {
        return c.json({ error: "supplierId not found." }, 400);
      }

      const billDate = parseDate(body.billDate) ?? new Date();
      const dueDate = body.dueDate !== undefined ? parseDate(body.dueDate) : null;

      const resolvedLines = await resolveLines((body.lines ?? []) as IncomingLine[]);
      const totals = rollupTotals(resolvedLines, 0);
      const number = String(body.number ?? "").trim() || (await nextBillNumber());
      const existing = await prisma.bill.findUnique({ where: { number } });
      if (existing) {
        return c.json({ error: `Bill number "${number}" already exists.` }, 409);
      }

      const row = await prisma.bill.create({
        data: {
          number,
          supplierId,
          billDate,
          dueDate: dueDate ?? null,
          memo: String(body.memo ?? ""),
          status: TransactionStatus.draft,
          subtotal: totals.subtotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          amountPaid: 0,
          balance: totals.balance,
          lines: { create: resolvedLines }
        },
        include: {
          supplier: true,
          lines: {
            include: { product: true, expenseAccount: true },
            orderBy: { position: "asc" }
          }
        }
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "bill.create",
        entityType: "Bill",
        entityId: row.id,
        after: row
      });
      return c.json({ bill: row }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not create bill." }, 400);
    }
  })
  .patch("/bills/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const id = c.req.param("id");
      const before = await prisma.bill.findUnique({ where: { id }, include: { lines: true } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      if (before.status !== TransactionStatus.draft) {
        return c.json({ error: "Only draft bills can be edited." }, 409);
      }

      const body = await c.req.json<Record<string, unknown>>();
      const data: Record<string, unknown> = {};
      if (body.supplierId !== undefined) {
        const supplierId = String(body.supplierId ?? "").trim();
        if (!supplierId) {
          return c.json({ error: "supplierId cannot be empty." }, 400);
        }
        const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
        if (!supplier) {
          return c.json({ error: "supplierId not found." }, 400);
        }
        data.supplierId = supplierId;
      }
      if (body.billDate !== undefined) {
        const d = parseDate(body.billDate);
        if (!d) return c.json({ error: "Invalid billDate." }, 400);
        data.billDate = d;
      }
      if (body.dueDate !== undefined) {
        if (body.dueDate === null || body.dueDate === "") {
          data.dueDate = null;
        } else {
          const d = parseDate(body.dueDate);
          if (!d) return c.json({ error: "Invalid dueDate." }, 400);
          data.dueDate = d;
        }
      }
      if (body.memo !== undefined) {
        data.memo = String(body.memo ?? "");
      }
      if (body.number !== undefined) {
        const number = String(body.number ?? "").trim();
        if (!number) {
          return c.json({ error: "number cannot be empty." }, 400);
        }
        if (number !== before.number) {
          const clash = await prisma.bill.findUnique({ where: { number } });
          if (clash) {
            return c.json({ error: `Bill number "${number}" already exists.` }, 409);
          }
        }
        data.number = number;
      }

      let nextLines: Awaited<ReturnType<typeof resolveLines>> | null = null;
      if (body.lines !== undefined) {
        nextLines = await resolveLines(body.lines as IncomingLine[]);
        const totals = rollupTotals(nextLines, 0);
        data.subtotal = totals.subtotal;
        data.taxTotal = totals.taxTotal;
        data.total = totals.total;
        data.balance = totals.balance;
      }

      if (Object.keys(data).length === 0 && !nextLines) {
        return c.json({ error: "No fields to update." }, 400);
      }

      const row = await prisma.$transaction(async (tx) => {
        if (nextLines) {
          await tx.billLine.deleteMany({ where: { billId: id } });
          await tx.bill.update({
            where: { id },
            data: { ...data, lines: { create: nextLines } }
          });
        } else {
          await tx.bill.update({ where: { id }, data: data as never });
        }
        return tx.bill.findUnique({
          where: { id },
          include: {
            supplier: true,
            lines: {
              include: { product: true, expenseAccount: true },
              orderBy: { position: "asc" }
            }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "bill.update",
        entityType: "Bill",
        entityId: id,
        before,
        after: row
      });
      return c.json({ bill: row });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not update bill." }, 400);
    }
  })
  .post("/bills/:id/receive", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.bill.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft bills can be marked received." }, 409);
    }
    if (before.total <= 0) {
      return c.json({ error: "Bill total must be greater than zero before receiving." }, 409);
    }
    const row = await prisma.bill.update({
      where: { id },
      data: { status: TransactionStatus.open, receivedAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "bill.receive",
      entityType: "Bill",
      entityId: id,
      before,
      after: row
    });
    return c.json({ bill: row });
  })
  .post("/bills/:id/void", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.bill.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === TransactionStatus.void) {
      return c.json({ error: "Bill is already void." }, 409);
    }
    if (before.amountPaid > 0) {
      return c.json(
        { error: "Cannot void a bill with payments applied; unapply payments first." },
        409
      );
    }
    const row = await prisma.bill.update({
      where: { id },
      data: { status: TransactionStatus.void, voidedAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "bill.void",
      entityType: "Bill",
      entityId: id,
      before,
      after: row
    });
    return c.json({ bill: row });
  })
  .delete("/bills/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.bill.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft bills can be deleted; void open bills instead." }, 409);
    }
    await prisma.bill.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "bill.delete",
      entityType: "Bill",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
