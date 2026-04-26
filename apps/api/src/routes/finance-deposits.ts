import { AccountType, Role, TransactionStatus, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { MONEY_TOLERANCE, nextDepositNumber, round2 } from "../lib/finance-transactions.js";
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

class DepositConflictError extends Error {}

function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00.000Z` : text);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

type IncomingLine = {
  paymentId?: string | null;
  description?: string;
  amount: number;
  position?: number;
};

export const financeDepositsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/deposits", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = c.req.query("status");
    const items = await prisma.deposit.findMany({
      where: status === "draft" || status === "open" || status === "void" ? { status } : {},
      include: {
        bankAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { lines: true } }
      },
      orderBy: [{ depositDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/deposits/available-payments", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const bankAccountId = c.req.query("bankAccountId");
    if (!bankAccountId) {
      return c.json({ error: "bankAccountId is required." }, 400);
    }
    const items = await prisma.payment.findMany({
      where: { depositAccountId: bankAccountId, depositedAt: null },
      include: { customer: { select: { id: true, displayName: true } } },
      orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }]
    });
    return c.json({ items });
  })
  .get("/deposits/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const deposit = await prisma.deposit.findUnique({
      where: { id: c.req.param("id") },
      include: {
        bankAccount: true,
        lines: {
          include: {
            payment: {
              select: {
                id: true,
                number: true,
                paymentDate: true,
                method: true,
                amount: true,
                customer: { select: { id: true, displayName: true } }
              }
            }
          },
          orderBy: { position: "asc" }
        }
      }
    });
    if (!deposit) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ deposit });
  })
  .post("/deposits", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const bankAccountId = String(body.bankAccountId ?? "").trim();
      if (!bankAccountId) {
        return c.json({ error: "bankAccountId is required." }, 400);
      }
      const bankAccount = await prisma.account.findUnique({ where: { id: bankAccountId } });
      if (!bankAccount) {
        return c.json({ error: "bankAccountId not found." }, 400);
      }
      if (bankAccount.type !== AccountType.asset) {
        return c.json({ error: "bankAccountId must reference an asset account." }, 400);
      }

      const depositDate = parseDate(body.depositDate) ?? new Date();
      const rawLines = Array.isArray(body.lines) ? (body.lines as IncomingLine[]) : [];
      if (rawLines.length === 0) {
        return c.json({ error: "At least one deposit line is required." }, 400);
      }

      const paymentIds = Array.from(
        new Set(
          rawLines
            .map((l) => l.paymentId)
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
            .map((v) => v.trim())
        )
      );
      const payments = paymentIds.length
        ? await prisma.payment.findMany({ where: { id: { in: paymentIds } } })
        : [];
      const paymentById = new Map(payments.map((p) => [p.id, p]));

      const resolvedLines = rawLines.map((line, index) => {
        const paymentId = line.paymentId ? String(line.paymentId).trim() : null;
        const amount = round2(Number(line.amount ?? 0));
        if (amount === 0) {
          throw new Error(`Line ${index + 1}: amount cannot be zero.`);
        }
        if (paymentId) {
          const p = paymentById.get(paymentId);
          if (!p) {
            throw new Error(`Line ${index + 1}: paymentId not found.`);
          }
          if (p.depositAccountId !== bankAccountId) {
            throw new Error(
              `Line ${index + 1}: payment ${p.number} was posted to a different deposit account.`
            );
          }
          if (p.depositedAt) {
            throw new Error(`Line ${index + 1}: payment ${p.number} has already been deposited.`);
          }
          if (Math.abs(amount - p.amount) > MONEY_TOLERANCE) {
            throw new Error(
              `Line ${index + 1}: deposit amount must equal payment amount ${p.amount.toFixed(2)}.`
            );
          }
        }
        return {
          position: line.position ?? index + 1,
          paymentId,
          description: String(line.description ?? ""),
          amount
        };
      });

      const total = round2(resolvedLines.reduce((s, l) => s + l.amount, 0));
      const number = String(body.number ?? "").trim() || (await nextDepositNumber());

      const row = await prisma.deposit.create({
        data: {
          number,
          depositDate,
          memo: String(body.memo ?? ""),
          bankAccountId,
          total,
          status: TransactionStatus.draft,
          lines: { create: resolvedLines }
        },
        include: {
          bankAccount: true,
          lines: {
            include: { payment: { select: { id: true, number: true, amount: true } } },
            orderBy: { position: "asc" }
          }
        }
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "deposit.create",
        entityType: "Deposit",
        entityId: row.id,
        after: row
      });
      return c.json({ deposit: row }, 201);
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "Deposit number already exists." }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not create deposit." }, 400);
    }
  })
  .post("/deposits/:id/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.deposit.findUnique({
      where: { id },
      include: { lines: true }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft deposits can be posted." }, 409);
    }

    const paymentIds = Array.from(
      new Set(
        before.lines
          .map((l) => l.paymentId)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    );

    const now = new Date();
    let row;
    try {
      row = await prisma.$transaction(async (tx) => {
        if (paymentIds.length > 0) {
          const conflicts = await tx.payment.findMany({
            where: { id: { in: paymentIds }, depositedAt: { not: null } },
            select: { number: true }
          });
          if (conflicts.length > 0) {
            throw new DepositConflictError(
              `One or more linked payments are already deposited: ${conflicts.map((p) => p.number).join(", ")}`
            );
          }
          const updated = await tx.payment.updateMany({
            where: { id: { in: paymentIds }, depositedAt: null },
            data: { depositedAt: now }
          });
          if (updated.count !== paymentIds.length) {
            throw new DepositConflictError("One or more linked payments could not be deposited.");
          }
        }
        await tx.deposit.update({
          where: { id },
          data: { status: TransactionStatus.open, postedAt: now }
        });
        return tx.deposit.findUnique({
          where: { id },
          include: {
            bankAccount: true,
            lines: {
              include: { payment: { select: { id: true, number: true, depositedAt: true } } },
              orderBy: { position: "asc" }
            }
          }
        });
      });
    } catch (e) {
      if (e instanceof DepositConflictError) {
        return c.json({ error: e.message }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not post deposit." }, 400);
    }

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deposit.post",
      entityType: "Deposit",
      entityId: id,
      before,
      after: row
    });
    return c.json({ deposit: row });
  })
  .post("/deposits/:id/void", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.deposit.findUnique({
      where: { id },
      include: { lines: true }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === TransactionStatus.void) {
      return c.json({ error: "Deposit is already void." }, 409);
    }

    const paymentIds = before.lines
      .map((l) => l.paymentId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const now = new Date();
    const row = await prisma.$transaction(async (tx) => {
      if (paymentIds.length > 0) {
        await tx.payment.updateMany({
          where: { id: { in: paymentIds } },
          data: { depositedAt: null }
        });
      }
      await tx.deposit.update({
        where: { id },
        data: { status: TransactionStatus.void, voidedAt: now }
      });
      return tx.deposit.findUnique({
        where: { id },
        include: {
          bankAccount: true,
          lines: {
            include: { payment: { select: { id: true, number: true, depositedAt: true } } },
            orderBy: { position: "asc" }
          }
        }
      });
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deposit.void",
      entityType: "Deposit",
      entityId: id,
      before,
      after: row
    });
    return c.json({ deposit: row });
  })
  .delete("/deposits/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.deposit.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TransactionStatus.draft) {
      return c.json({ error: "Only draft deposits can be deleted; void posted deposits instead." }, 409);
    }
    await prisma.deposit.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deposit.delete",
      entityType: "Deposit",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
