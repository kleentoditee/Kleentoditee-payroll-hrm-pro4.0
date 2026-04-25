import {
  AccountType,
  PaymentMethod,
  Role,
  TransactionStatus,
  prisma
} from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { nextBillPaymentNumber, round2 } from "../lib/finance-transactions.js";
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

type ApplicationInput = { billId: string; amount: number };

function deriveBillStatus(
  current: TransactionStatus,
  total: number,
  amountPaid: number
): TransactionStatus {
  if (current === TransactionStatus.draft || current === TransactionStatus.void) {
    return current;
  }
  if (amountPaid <= 0.005) return TransactionStatus.open;
  if (amountPaid + 0.005 < total) return TransactionStatus.partial;
  return TransactionStatus.paid;
}

export const financeBillPaymentsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/bill-payments", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const supplierId = c.req.query("supplierId");
    const items = await prisma.billPayment.findMany({
      where: { ...(supplierId ? { supplierId } : {}) },
      include: {
        supplier: { select: { id: true, displayName: true } },
        sourceAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { applications: true } }
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/bill-payments/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const billPayment = await prisma.billPayment.findUnique({
      where: { id: c.req.param("id") },
      include: {
        supplier: true,
        sourceAccount: true,
        applications: {
          include: {
            bill: {
              select: {
                id: true,
                number: true,
                total: true,
                amountPaid: true,
                balance: true,
                status: true,
                billDate: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!billPayment) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ billPayment });
  })
  .post("/bill-payments", authRequired, requireRole(...CAN_EDIT), async (c) => {
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

      const paymentDate = parseDate(body.paymentDate) ?? new Date();
      const method = parseMethod(body.method) ?? PaymentMethod.check;
      const amount = round2(Number(body.amount ?? 0));
      if (!(amount > 0)) {
        return c.json({ error: "amount must be greater than zero." }, 400);
      }

      const sourceAccountId = String(body.sourceAccountId ?? "").trim();
      if (!sourceAccountId) {
        return c.json({ error: "sourceAccountId is required." }, 400);
      }
      const sourceAccount = await prisma.account.findUnique({ where: { id: sourceAccountId } });
      if (!sourceAccount) {
        return c.json({ error: "sourceAccountId not found." }, 400);
      }
      if (sourceAccount.type !== AccountType.asset) {
        return c.json({ error: "sourceAccountId must reference an asset account." }, 400);
      }

      const rawApps = Array.isArray(body.applications)
        ? (body.applications as ApplicationInput[])
        : [];
      const applications = rawApps
        .map((a) => ({ billId: String(a?.billId ?? "").trim(), amount: round2(Number(a?.amount ?? 0)) }))
        .filter((a) => a.billId && a.amount > 0);

      const appliedTotal = round2(applications.reduce((s, a) => s + a.amount, 0));
      if (appliedTotal - 0.005 > amount) {
        return c.json({ error: "Applied amount exceeds payment amount." }, 400);
      }

      if (applications.length > 0) {
        const ids = applications.map((a) => a.billId);
        const bills = await prisma.bill.findMany({ where: { id: { in: ids } } });
        const billById = new Map(bills.map((b) => [b.id, b]));
        for (const app of applications) {
          const bill = billById.get(app.billId);
          if (!bill) {
            return c.json({ error: `Bill ${app.billId} not found.` }, 400);
          }
          if (bill.supplierId !== supplierId) {
            return c.json({ error: `Bill ${bill.number} belongs to a different supplier.` }, 400);
          }
          if (bill.status !== TransactionStatus.open && bill.status !== TransactionStatus.partial) {
            return c.json(
              { error: `Bill ${bill.number} must be open or partial to accept payment (status: ${bill.status}).` },
              400
            );
          }
          if (app.amount - 0.005 > bill.balance) {
            return c.json(
              { error: `Applied amount on ${bill.number} exceeds the open balance of ${bill.balance.toFixed(2)}.` },
              400
            );
          }
        }
      }

      const unapplied = round2(amount - appliedTotal);
      const number = String(body.number ?? "").trim() || (await nextBillPaymentNumber());
      const existing = await prisma.billPayment.findUnique({ where: { number } });
      if (existing) {
        return c.json({ error: `Bill payment number "${number}" already exists.` }, 409);
      }

      const billPayment = await prisma.$transaction(async (tx) => {
        const created = await tx.billPayment.create({
          data: {
            number,
            supplierId,
            paymentDate,
            method,
            reference: String(body.reference ?? ""),
            memo: String(body.memo ?? ""),
            amount,
            applied: appliedTotal,
            unapplied,
            sourceAccountId,
            applications: {
              create: applications.map((a) => ({ billId: a.billId, amount: a.amount }))
            }
          }
        });
        for (const app of applications) {
          const bill = await tx.bill.findUnique({ where: { id: app.billId } });
          if (!bill) continue;
          const nextAmountPaid = round2(bill.amountPaid + app.amount);
          const nextBalance = round2(bill.total - nextAmountPaid);
          await tx.bill.update({
            where: { id: bill.id },
            data: {
              amountPaid: nextAmountPaid,
              balance: nextBalance,
              status: deriveBillStatus(bill.status, bill.total, nextAmountPaid)
            }
          });
        }
        return tx.billPayment.findUnique({
          where: { id: created.id },
          include: {
            supplier: true,
            sourceAccount: true,
            applications: { include: { bill: { select: { id: true, number: true, status: true, balance: true } } } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "bill_payment.create",
        entityType: "BillPayment",
        entityId: billPayment?.id,
        after: billPayment
      });
      return c.json({ billPayment }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not record bill payment." }, 400);
    }
  })
  .post(
    "/bill-payments/:id/unapply/:applicationId",
    authRequired,
    requireRole(...CAN_EDIT),
    async (c) => {
      const id = c.req.param("id");
      const applicationId = c.req.param("applicationId");
      const before = await prisma.billPayment.findUnique({ where: { id } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      const application = await prisma.billPaymentApplication.findUnique({
        where: { id: applicationId },
        include: { bill: true }
      });
      if (!application || application.billPaymentId !== id) {
        return c.json({ error: "Application not found on this bill payment." }, 404);
      }

      const billPayment = await prisma.$transaction(async (tx) => {
        await tx.billPaymentApplication.delete({ where: { id: applicationId } });
        const nextAmountPaid = round2(application.bill.amountPaid - application.amount);
        const nextBalance = round2(application.bill.total - nextAmountPaid);
        await tx.bill.update({
          where: { id: application.billId },
          data: {
            amountPaid: nextAmountPaid,
            balance: nextBalance,
            status: deriveBillStatus(application.bill.status, application.bill.total, nextAmountPaid)
          }
        });
        const nextApplied = round2(before.applied - application.amount);
        await tx.billPayment.update({
          where: { id },
          data: { applied: nextApplied, unapplied: round2(before.amount - nextApplied) }
        });
        return tx.billPayment.findUnique({
          where: { id },
          include: {
            supplier: true,
            sourceAccount: true,
            applications: { include: { bill: { select: { id: true, number: true, status: true, balance: true } } } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "bill_payment.unapply",
        entityType: "BillPayment",
        entityId: id,
        before,
        after: billPayment,
        metadata: { applicationId }
      });
      return c.json({ billPayment });
    }
  )
  .delete("/bill-payments/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.billPayment.findUnique({
      where: { id },
      include: { applications: { include: { bill: true } } }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }

    await prisma.$transaction(async (tx) => {
      for (const app of before.applications) {
        const nextAmountPaid = round2(app.bill.amountPaid - app.amount);
        const nextBalance = round2(app.bill.total - nextAmountPaid);
        await tx.bill.update({
          where: { id: app.billId },
          data: {
            amountPaid: nextAmountPaid,
            balance: nextBalance,
            status: deriveBillStatus(app.bill.status, app.bill.total, nextAmountPaid)
          }
        });
      }
      await tx.billPayment.delete({ where: { id } });
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "bill_payment.delete",
      entityType: "BillPayment",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
