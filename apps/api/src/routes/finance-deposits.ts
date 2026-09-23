import { requireOrgId, AccountType, Role, TransactionStatus, prisma, type Prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { buildDepositPostedJournal, ensureControlAccounts, postJournal, reverseJournal } from "../lib/gl-posting.js";
import { PeriodClosedError } from "../lib/fiscal-periods.js";
import { MONEY_TOLERANCE, nextDepositNumber, round2 } from "../lib/finance-transactions.js";
import { isUniqueConstraintError } from "../lib/prisma-errors.js";
import { caseInsensitiveContains, paginationMeta, parseListQuery } from "../lib/pagination.js";
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
  accountId?: string | null;
  description?: string;
  amount: number;
  position?: number;
};

export const financeDepositsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/deposits", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const list = parseListQuery((k) => c.req.query(k), {
      sortable: ["number", "depositDate", "total", "status", "createdAt"],
      defaultSort: [{ depositDate: "desc" }, { createdAt: "desc" }]
    });
    if (!list.ok) {
      return c.json({ error: list.error }, 400);
    }
    const status = c.req.query("status");
    const statusFilter = status === "draft" || status === "open" || status === "void" ? status : null;
    const where: Prisma.DepositWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(list.q
        ? { OR: [{ number: caseInsensitiveContains(list.q) }, { memo: caseInsensitiveContains(list.q) }] }
        : {})
    };
    const include = {
      bankAccount: { select: { id: true, code: true, name: true } },
      _count: { select: { lines: true } }
    };
    if (!list.paginated) {
      const items = await prisma.deposit.findMany({ where, include, orderBy: list.orderBy });
      return c.json({ items });
    }
    const [total, items] = await Promise.all([
      prisma.deposit.count({ where }),
      prisma.deposit.findMany({ where, include, orderBy: list.orderBy, skip: list.skip, take: list.take })
    ]);
    return c.json({ items, pagination: paginationMeta(list.page, list.pageSize, total) });
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

      const requestedAccountIds = [...new Set(rawLines.map((l) => l.accountId).filter((v): v is string => typeof v === "string" && v.length > 0))];
      const validAccountRows = requestedAccountIds.length
        ? await prisma.account.findMany({ where: { id: { in: requestedAccountIds } }, select: { id: true } })
        : [];
      const validAccountIds = new Set(validAccountRows.map((a) => a.id));

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
        let accountId: string | null = null;
        if (!paymentId) {
          accountId = line.accountId ? String(line.accountId).trim() : null;
          if (accountId && !validAccountIds.has(accountId)) {
            throw new Error(`Line ${index + 1}: offset account not found.`);
          }
        }
        return {
          position: line.position ?? index + 1,
          paymentId,
          accountId,
          description: String(line.description ?? ""),
          amount
        };
      });

      const total = round2(resolvedLines.reduce((s, l) => s + l.amount, 0));
      const number = String(body.number ?? "").trim() || (await nextDepositNumber());

      const row = await prisma.deposit.create({
        data: {
          orgId: requireOrgId(),
          number,
          depositDate,
          memo: String(body.memo ?? ""),
          bankAccountId,
          total,
          status: TransactionStatus.draft,
          lines: { create: resolvedLines.map((l) => ({ orgId: requireOrgId(), ...l })) }
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

    // Batch 13: ad-hoc (non-payment) lines need an offset account for the GL.
    const adhocMissing = before.lines.filter((l) => !l.paymentId && !l.accountId);
    if (adhocMissing.length > 0) {
      return c.json(
        { error: "Ad-hoc deposit lines need an offset account before posting. Edit the deposit and choose an account for each line." },
        400
      );
    }

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
        const accounts = await ensureControlAccounts(tx);
        const linkedPayments = paymentIds.length
          ? await tx.payment.findMany({ where: { id: { in: paymentIds } }, select: { number: true, amount: true } })
          : [];
        await postJournal(tx, buildDepositPostedJournal({
          id,
          number: before.number,
          depositDate: before.depositDate,
          bankAccountId: before.bankAccountId,
          total: before.total,
          undepositedFundsAccountId: accounts.undepositedFunds,
          paymentAmounts: linkedPayments,
          adhocLines: before.lines
            .filter((l) => !l.paymentId && l.accountId)
            .map((l) => ({ accountId: l.accountId as string, amount: l.amount, description: l.description }))
        }), c.get("userId"));
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
      if (e instanceof DepositConflictError || e instanceof PeriodClosedError) {
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
      if (before.status === TransactionStatus.open) {
        await reverseJournal(tx, "deposit_posted", id, {
          date: now,
          memo: `Void deposit ${before.number}`,
          createdByUserId: c.get("userId")
        });
      }
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
