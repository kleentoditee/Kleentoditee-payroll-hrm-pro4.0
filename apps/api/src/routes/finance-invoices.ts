import { AccountType, Role, TransactionStatus, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  computeInvoiceLine,
  nextInvoiceNumber,
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
  unitPrice?: number;
  incomeAccountId?: string;
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
    const incomeAccountId =
      line.incomeAccountId && String(line.incomeAccountId).trim()
        ? String(line.incomeAccountId).trim()
        : productId
        ? productById.get(productId)!.incomeAccountId
        : "";
    if (!incomeAccountId) {
      throw new Error(`Line ${index + 1}: incomeAccountId is required when no product is selected.`);
    }
    return computeInvoiceLine(
      {
        ...line,
        productId,
        incomeAccountId
      },
      index
    );
  });

  const accountIds = Array.from(new Set(resolved.map((l) => l.incomeAccountId)));
  const accounts = await prisma.account.findMany({ where: { id: { in: accountIds } } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  for (const [i, line] of resolved.entries()) {
    const account = accountById.get(line.incomeAccountId);
    if (!account) {
      throw new Error(`Line ${i + 1}: incomeAccountId not found.`);
    }
    if (account.type !== AccountType.revenue) {
      throw new Error(`Line ${i + 1}: incomeAccountId must reference a revenue account.`);
    }
  }

  return resolved;
}

export const financeInvoicesRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/invoices", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = parseStatus(c.req.query("status"));
    const customerId = c.req.query("customerId");
    const items = await prisma.invoice.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(customerId ? { customerId } : {})
      },
      include: {
        customer: { select: { id: true, displayName: true } },
        _count: { select: { lines: true } }
      },
      orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/invoices/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: c.req.param("id") },
      include: {
        customer: true,
        lines: {
          include: { product: true, incomeAccount: true },
          orderBy: { position: "asc" }
        }
      }
    });
    if (!invoice) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ invoice });
  })
  .post("/invoices", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const customerId = String(body.customerId ?? "").trim();
      if (!customerId) {
        return c.json({ error: "customerId is required." }, 400);
      }
      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        return c.json({ error: "customerId not found." }, 400);
      }

      const issueDate = parseDate(body.issueDate) ?? new Date();
      const dueDate = body.dueDate !== undefined ? parseDate(body.dueDate) : null;

      const resolvedLines = await resolveLines((body.lines ?? []) as IncomingLine[]);
      const totals = rollupTotals(resolvedLines, 0);
      const number = String(body.number ?? "").trim() || (await nextInvoiceNumber());
      const existing = await prisma.invoice.findUnique({ where: { number } });
      if (existing) {
        return c.json({ error: `Invoice number "${number}" already exists.` }, 409);
      }

      const row = await prisma.invoice.create({
        data: {
          number,
          customerId,
          issueDate,
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
          customer: true,
          lines: { include: { product: true, incomeAccount: true }, orderBy: { position: "asc" } }
        }
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "invoice.create",
        entityType: "Invoice",
        entityId: row.id,
        after: row
      });
      return c.json({ invoice: row }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not create invoice." }, 400);
    }
  })
  .patch("/invoices/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const id = c.req.param("id");
      const before = await prisma.invoice.findUnique({ where: { id }, include: { lines: true } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      if (before.status !== TransactionStatus.draft) {
        return c.json({ error: "Only draft invoices can be edited." }, 409);
      }

      const body = await c.req.json<Record<string, unknown>>();
      const data: Record<string, unknown> = {};
      if (body.customerId !== undefined) {
        const customerId = String(body.customerId ?? "").trim();
        if (!customerId) {
          return c.json({ error: "customerId cannot be empty." }, 400);
        }
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
          return c.json({ error: "customerId not found." }, 400);
        }
        data.customerId = customerId;
      }
      if (body.issueDate !== undefined) {
        const d = parseDate(body.issueDate);
        if (!d) return c.json({ error: "Invalid issueDate." }, 400);
        data.issueDate = d;
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
          const clash = await prisma.invoice.findUnique({ where: { number } });
          if (clash) {
            return c.json({ error: `Invoice number "${number}" already exists.` }, 409);
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
          await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
          await tx.invoice.update({
            where: { id },
            data: { ...data, lines: { create: nextLines } }
          });
        } else {
          await tx.invoice.update({ where: { id }, data: data as never });
        }
        return tx.invoice.findUnique({
          where: { id },
          include: {
            customer: true,
            lines: { include: { product: true, incomeAccount: true }, orderBy: { position: "asc" } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "invoice.update",
        entityType: "Invoice",
        entityId: id,
        before,
        after: row
      });
      return c.json({ invoice: row });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not update invoice." }, 400);
    }
  })
  .post("/invoices/:id/send", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.invoice.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft invoices can be sent." }, 409);
    }
    if (before.total <= 0) {
      return c.json({ error: "Invoice total must be greater than zero before sending." }, 409);
    }
    const row = await prisma.invoice.update({
      where: { id },
      data: { status: TransactionStatus.open, sentAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "invoice.send",
      entityType: "Invoice",
      entityId: id,
      before,
      after: row
    });
    return c.json({ invoice: row });
  })
  .post("/invoices/:id/void", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.invoice.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === TransactionStatus.void) {
      return c.json({ error: "Invoice is already void." }, 409);
    }
    if (before.amountPaid > 0) {
      return c.json(
        { error: "Cannot void an invoice with payments applied; unapply payments first." },
        409
      );
    }
    const row = await prisma.invoice.update({
      where: { id },
      data: { status: TransactionStatus.void, voidedAt: new Date() }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "invoice.void",
      entityType: "Invoice",
      entityId: id,
      before,
      after: row
    });
    return c.json({ invoice: row });
  })
  .delete("/invoices/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.invoice.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft invoices can be deleted; void open invoices instead." }, 409);
    }
    await prisma.invoice.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "invoice.delete",
      entityType: "Invoice",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
