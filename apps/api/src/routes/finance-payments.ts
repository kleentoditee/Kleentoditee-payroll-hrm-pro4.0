import {
  AccountType,
  PaymentMethod,
  Role,
  TransactionStatus,
  prisma
} from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { nextPaymentNumber, round2 } from "../lib/finance-transactions.js";
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

type ApplicationInput = { invoiceId: string; amount: number };

function deriveInvoiceStatus(
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

export const financePaymentsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/payments", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const customerId = c.req.query("customerId");
    const onlyOpen = c.req.query("hasUnapplied") === "true";
    const items = await prisma.payment.findMany({
      where: {
        ...(customerId ? { customerId } : {}),
        ...(onlyOpen ? { unapplied: { gt: 0 } } : {})
      },
      include: {
        customer: { select: { id: true, displayName: true } },
        depositAccount: { select: { id: true, code: true, name: true } },
        _count: { select: { applications: true } }
      },
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({ items });
  })
  .get("/payments/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const payment = await prisma.payment.findUnique({
      where: { id: c.req.param("id") },
      include: {
        customer: true,
        depositAccount: true,
        applications: {
          include: {
            invoice: {
              select: {
                id: true,
                number: true,
                total: true,
                amountPaid: true,
                balance: true,
                status: true,
                issueDate: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      }
    });
    if (!payment) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ payment });
  })
  .post("/payments", authRequired, requireRole(...CAN_EDIT), async (c) => {
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

      const paymentDate = parseDate(body.paymentDate) ?? new Date();
      const method = parseMethod(body.method) ?? PaymentMethod.cash;
      const amount = round2(Number(body.amount ?? 0));
      if (!(amount > 0)) {
        return c.json({ error: "amount must be greater than zero." }, 400);
      }

      const depositAccountId = String(body.depositAccountId ?? "").trim();
      if (!depositAccountId) {
        return c.json({ error: "depositAccountId is required." }, 400);
      }
      const depositAccount = await prisma.account.findUnique({ where: { id: depositAccountId } });
      if (!depositAccount) {
        return c.json({ error: "depositAccountId not found." }, 400);
      }
      if (depositAccount.type !== AccountType.asset) {
        return c.json({ error: "depositAccountId must reference an asset account." }, 400);
      }

      const rawApps = Array.isArray(body.applications)
        ? (body.applications as ApplicationInput[])
        : [];
      const applications = rawApps
        .map((a) => ({ invoiceId: String(a?.invoiceId ?? "").trim(), amount: round2(Number(a?.amount ?? 0)) }))
        .filter((a) => a.invoiceId && a.amount > 0);

      const appliedTotal = round2(applications.reduce((s, a) => s + a.amount, 0));
      if (appliedTotal - 0.005 > amount) {
        return c.json({ error: "Applied amount exceeds payment amount." }, 400);
      }

      // Validate invoices: must exist, belong to customer, status open|partial, each application <= balance
      if (applications.length > 0) {
        const ids = applications.map((a) => a.invoiceId);
        const invoices = await prisma.invoice.findMany({ where: { id: { in: ids } } });
        const invoiceById = new Map(invoices.map((i) => [i.id, i]));
        for (const app of applications) {
          const inv = invoiceById.get(app.invoiceId);
          if (!inv) {
            return c.json({ error: `Invoice ${app.invoiceId} not found.` }, 400);
          }
          if (inv.customerId !== customerId) {
            return c.json({ error: `Invoice ${inv.number} belongs to a different customer.` }, 400);
          }
          if (inv.status !== TransactionStatus.open && inv.status !== TransactionStatus.partial) {
            return c.json(
              { error: `Invoice ${inv.number} must be open or partial to accept payment (status: ${inv.status}).` },
              400
            );
          }
          if (app.amount - 0.005 > inv.balance) {
            return c.json(
              { error: `Applied amount on ${inv.number} exceeds the open balance of ${inv.balance.toFixed(2)}.` },
              400
            );
          }
        }
      }

      const unapplied = round2(amount - appliedTotal);
      const number = String(body.number ?? "").trim() || (await nextPaymentNumber());
      const existing = await prisma.payment.findUnique({ where: { number } });
      if (existing) {
        return c.json({ error: `Payment number "${number}" already exists.` }, 409);
      }

      const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            number,
            customerId,
            paymentDate,
            method,
            reference: String(body.reference ?? ""),
            memo: String(body.memo ?? ""),
            amount,
            applied: appliedTotal,
            unapplied,
            depositAccountId,
            applications: {
              create: applications.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount }))
            }
          }
        });
        for (const app of applications) {
          const inv = await tx.invoice.findUnique({ where: { id: app.invoiceId } });
          if (!inv) continue;
          const nextAmountPaid = round2(inv.amountPaid + app.amount);
          const nextBalance = round2(inv.total - nextAmountPaid);
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              amountPaid: nextAmountPaid,
              balance: nextBalance,
              status: deriveInvoiceStatus(inv.status, inv.total, nextAmountPaid)
            }
          });
        }
        return tx.payment.findUnique({
          where: { id: created.id },
          include: {
            customer: true,
            depositAccount: true,
            applications: { include: { invoice: { select: { id: true, number: true, status: true, balance: true } } } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payment.create",
        entityType: "Payment",
        entityId: payment?.id,
        after: payment
      });
      return c.json({ payment }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not record payment." }, 400);
    }
  })
  .post("/payments/:id/apply", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const id = c.req.param("id");
      const before = await prisma.payment.findUnique({
        where: { id },
        include: { applications: true }
      });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      const body = await c.req.json<Record<string, unknown>>();
      const raw = Array.isArray(body.applications)
        ? (body.applications as ApplicationInput[])
        : [];
      const applications = raw
        .map((a) => ({ invoiceId: String(a?.invoiceId ?? "").trim(), amount: round2(Number(a?.amount ?? 0)) }))
        .filter((a) => a.invoiceId && a.amount > 0);

      if (applications.length === 0) {
        return c.json({ error: "No applications supplied." }, 400);
      }
      const newTotal = round2(applications.reduce((s, a) => s + a.amount, 0));
      if (newTotal - 0.005 > before.unapplied) {
        return c.json({ error: `Applied amount exceeds unapplied ${before.unapplied.toFixed(2)}.` }, 400);
      }

      // Reject if any app duplicates an existing invoice on this payment
      const alreadyAppliedTo = new Set(before.applications.map((a) => a.invoiceId));
      for (const app of applications) {
        if (alreadyAppliedTo.has(app.invoiceId)) {
          return c.json(
            { error: "Invoice already has a prior application on this payment; unapply first." },
            400
          );
        }
      }

      const ids = applications.map((a) => a.invoiceId);
      const invoices = await prisma.invoice.findMany({ where: { id: { in: ids } } });
      const invoiceById = new Map(invoices.map((i) => [i.id, i]));
      for (const app of applications) {
        const inv = invoiceById.get(app.invoiceId);
        if (!inv) {
          return c.json({ error: `Invoice ${app.invoiceId} not found.` }, 400);
        }
        if (inv.customerId !== before.customerId) {
          return c.json({ error: `Invoice ${inv.number} belongs to a different customer.` }, 400);
        }
        if (inv.status !== TransactionStatus.open && inv.status !== TransactionStatus.partial) {
          return c.json(
            { error: `Invoice ${inv.number} must be open or partial to accept payment.` },
            400
          );
        }
        if (app.amount - 0.005 > inv.balance) {
          return c.json(
            { error: `Applied amount on ${inv.number} exceeds the open balance.` },
            400
          );
        }
      }

      const payment = await prisma.$transaction(async (tx) => {
        for (const app of applications) {
          await tx.paymentApplication.create({
            data: { paymentId: id, invoiceId: app.invoiceId, amount: app.amount }
          });
          const inv = invoiceById.get(app.invoiceId)!;
          const nextAmountPaid = round2(inv.amountPaid + app.amount);
          const nextBalance = round2(inv.total - nextAmountPaid);
          await tx.invoice.update({
            where: { id: inv.id },
            data: {
              amountPaid: nextAmountPaid,
              balance: nextBalance,
              status: deriveInvoiceStatus(inv.status, inv.total, nextAmountPaid)
            }
          });
        }
        const newApplied = round2(before.applied + newTotal);
        await tx.payment.update({
          where: { id },
          data: { applied: newApplied, unapplied: round2(before.amount - newApplied) }
        });
        return tx.payment.findUnique({
          where: { id },
          include: {
            customer: true,
            depositAccount: true,
            applications: { include: { invoice: { select: { id: true, number: true, status: true, balance: true } } } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payment.apply",
        entityType: "Payment",
        entityId: id,
        before,
        after: payment
      });
      return c.json({ payment });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not apply payment." }, 400);
    }
  })
  .post(
    "/payments/:id/unapply/:applicationId",
    authRequired,
    requireRole(...CAN_EDIT),
    async (c) => {
      const id = c.req.param("id");
      const applicationId = c.req.param("applicationId");
      const before = await prisma.payment.findUnique({ where: { id } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      if (before.depositedAt) {
        return c.json(
          { error: "Payment is part of a deposit; reverse the deposit before unapplying." },
          409
        );
      }
      const application = await prisma.paymentApplication.findUnique({
        where: { id: applicationId },
        include: { invoice: true }
      });
      if (!application || application.paymentId !== id) {
        return c.json({ error: "Application not found on this payment." }, 404);
      }

      const payment = await prisma.$transaction(async (tx) => {
        await tx.paymentApplication.delete({ where: { id: applicationId } });
        const nextAmountPaid = round2(application.invoice.amountPaid - application.amount);
        const nextBalance = round2(application.invoice.total - nextAmountPaid);
        await tx.invoice.update({
          where: { id: application.invoiceId },
          data: {
            amountPaid: nextAmountPaid,
            balance: nextBalance,
            status: deriveInvoiceStatus(
              application.invoice.status,
              application.invoice.total,
              nextAmountPaid
            )
          }
        });
        const nextApplied = round2(before.applied - application.amount);
        await tx.payment.update({
          where: { id },
          data: { applied: nextApplied, unapplied: round2(before.amount - nextApplied) }
        });
        return tx.payment.findUnique({
          where: { id },
          include: {
            customer: true,
            depositAccount: true,
            applications: { include: { invoice: { select: { id: true, number: true, status: true, balance: true } } } }
          }
        });
      });

      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payment.unapply",
        entityType: "Payment",
        entityId: id,
        before,
        after: payment,
        metadata: { applicationId }
      });
      return c.json({ payment });
    }
  )
  .delete("/payments/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.payment.findUnique({
      where: { id },
      include: { applications: { include: { invoice: true } } }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.depositedAt) {
      return c.json(
        { error: "Payment is part of a deposit; reverse the deposit before deleting." },
        409
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const app of before.applications) {
        const nextAmountPaid = round2(app.invoice.amountPaid - app.amount);
        const nextBalance = round2(app.invoice.total - nextAmountPaid);
        await tx.invoice.update({
          where: { id: app.invoiceId },
          data: {
            amountPaid: nextAmountPaid,
            balance: nextBalance,
            status: deriveInvoiceStatus(app.invoice.status, app.invoice.total, nextAmountPaid)
          }
        });
      }
      await tx.payment.delete({ where: { id } });
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "payment.delete",
      entityType: "Payment",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
