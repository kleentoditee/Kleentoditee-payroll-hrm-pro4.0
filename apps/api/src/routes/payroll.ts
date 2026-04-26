import { PayRunStatus, Role, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  createDraftRun,
  createRunExport,
  finalizeRun,
  getPaystubDetail,
  getRunDetail,
  markRunPaid,
  rebuildDraftRun
} from "../lib/payroll-service.js";
import { buildPeriodLabel } from "../lib/payroll-utils.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.hr_admin, Role.payroll_admin, Role.finance_admin] as const;

function parseSchedule(v: unknown): "weekly" | "biweekly" | "monthly" | null {
  if (v === "weekly" || v === "biweekly" || v === "monthly") {
    return v;
  }
  return null;
}

function parseRunStatus(v: unknown): PayRunStatus | null {
  if (v === "draft" || v === "finalized" || v === "exported" || v === "paid") {
    return v;
  }
  return null;
}

function parseDateInput(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function listSummary(
  items: Array<{ gross: number; totalDeductions: number; net: number }>
): { gross: number; totalDeductions: number; net: number } {
  return items.reduce(
    (acc, item) => ({
      gross: Math.round((acc.gross + item.gross + Number.EPSILON) * 100) / 100,
      totalDeductions:
        Math.round((acc.totalDeductions + item.totalDeductions + Number.EPSILON) * 100) / 100,
      net: Math.round((acc.net + item.net + Number.EPSILON) * 100) / 100
    }),
    { gross: 0, totalDeductions: 0, net: 0 }
  );
}

export const payrollRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/periods", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const schedule = parseSchedule(c.req.query("schedule"));
    const periods = await prisma.payPeriod.findMany({
      where: schedule ? { schedule } : undefined,
      include: {
        runs: {
          include: { items: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ endDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({
      items: periods.map((period) => ({
        ...period,
        label: period.label || buildPeriodLabel(period),
        runs: period.runs.map((run) => ({
          ...run,
          itemCount: run.items.length,
          summary: listSummary(run.items)
        }))
      }))
    });
  })
  .post("/periods", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const schedule = parseSchedule(body.schedule);
    const startDate = parseDateInput(body.startDate);
    const endDate = parseDateInput(body.endDate);
    const payDate = parseDateInput(body.payDate);

    if (!schedule || !startDate || !endDate) {
      return c.json({ error: "schedule, startDate, and endDate are required." }, 400);
    }
    if (startDate > endDate) {
      return c.json({ error: "startDate must be on or before endDate." }, 400);
    }

    const row = await prisma.payPeriod.create({
      data: {
        schedule,
        startDate,
        endDate,
        payDate,
        notes: String(body.notes ?? ""),
        label: String(body.label ?? "").trim() || buildPeriodLabel({ schedule, startDate, endDate })
      }
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "pay_period.create",
      entityType: "PayPeriod",
      entityId: row.id,
      after: row
    });

    return c.json({ period: row }, 201);
  })
  .get("/periods/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        runs: {
          include: {
            items: {
              include: { paystub: true },
              orderBy: { employeeName: "asc" }
            },
            exports: {
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({
      period: {
        ...row,
        label: row.label || buildPeriodLabel(row),
        runs: row.runs.map((run) => ({
          ...run,
          summary: listSummary(run.items)
        }))
      }
    });
  })
  .patch("/periods/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.payPeriod.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }

    const lockedRuns = await prisma.payRun.count({
      where: {
        periodId: id,
        status: {
          not: PayRunStatus.draft
        }
      }
    });
    if (lockedRuns > 0) {
      return c.json({ error: "This pay period has a finalized run and can no longer be edited." }, 409);
    }

    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    let nextSchedule = before.schedule;
    let nextStartDate = before.startDate;
    let nextEndDate = before.endDate;

    if (body.schedule !== undefined) {
      const schedule = parseSchedule(body.schedule);
      if (!schedule) {
        return c.json({ error: "Invalid schedule." }, 400);
      }
      data.schedule = schedule;
      nextSchedule = schedule;
    }
    if (body.startDate !== undefined) {
      const startDate = parseDateInput(body.startDate);
      if (!startDate) {
        return c.json({ error: "Invalid startDate." }, 400);
      }
      data.startDate = startDate;
      nextStartDate = startDate;
    }
    if (body.endDate !== undefined) {
      const endDate = parseDateInput(body.endDate);
      if (!endDate) {
        return c.json({ error: "Invalid endDate." }, 400);
      }
      data.endDate = endDate;
      nextEndDate = endDate;
    }
    if (nextStartDate > nextEndDate) {
      return c.json({ error: "startDate must be on or before endDate." }, 400);
    }
    if (body.payDate !== undefined) {
      const payDate = body.payDate ? parseDateInput(body.payDate) : null;
      if (body.payDate && !payDate) {
        return c.json({ error: "Invalid payDate." }, 400);
      }
      data.payDate = payDate;
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes ?? "");
    }
    if (body.label !== undefined) {
      const label = String(body.label ?? "").trim();
      data.label = label || buildPeriodLabel({ schedule: nextSchedule, startDate: nextStartDate, endDate: nextEndDate });
    } else if (body.schedule !== undefined || body.startDate !== undefined || body.endDate !== undefined) {
      data.label = buildPeriodLabel({ schedule: nextSchedule, startDate: nextStartDate, endDate: nextEndDate });
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.payPeriod.update({
      where: { id },
      data: data as never
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "pay_period.update",
      entityType: "PayPeriod",
      entityId: id,
      before,
      after: row
    });

    return c.json({ period: row });
  })
  .get("/runs", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = parseRunStatus(c.req.query("status"));
    const schedule = parseSchedule(c.req.query("schedule"));
    const items = await prisma.payRun.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(schedule ? { period: { schedule } } : {})
      },
      include: {
        period: true,
        items: {
          include: { paystub: true }
        },
        exports: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return c.json({
      items: items.map((run) => ({
        ...run,
        period: {
          ...run.period,
          label: run.period.label || buildPeriodLabel(run.period)
        },
        summary: listSummary(run.items),
        itemCount: run.items.length
      }))
    });
  })
  .post("/runs", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const periodId = String(body.periodId ?? "").trim();
      if (!periodId) {
        return c.json({ error: "periodId is required." }, 400);
      }
      const run = await createDraftRun(periodId, String(body.notes ?? ""));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.create",
        entityType: "PayRun",
        entityId: run?.id,
        after: run
      });
      return c.json({ run }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not create pay run." }, 400);
    }
  })
  .get("/runs/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const run = await getRunDetail(c.req.param("id"));
      return c.json({
        run: {
          ...run,
          period: {
            ...run.period,
            label: run.period.label || buildPeriodLabel(run.period)
          }
        }
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Not found" }, 404);
    }
  })
  .post("/runs/:id/rebuild", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await rebuildDraftRun(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.rebuild",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not rebuild pay run." }, 400);
    }
  })
  .post("/runs/:id/finalize", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await finalizeRun(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.finalize",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not finalize pay run." }, 400);
    }
  })
  .post("/runs/:id/export", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const result = await createRunExport(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.export",
        entityType: "PayRun",
        entityId: result.run?.id,
        before,
        after: result.run,
        metadata: {
          exportId: result.exportRow.id,
          fileName: result.fileName
        }
      });
      return c.json({
        run: result.run,
        export: result.exportRow,
        fileName: result.fileName,
        csv: result.csv
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not export pay run." }, 400);
    }
  })
  .post("/runs/:id/mark-paid", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await markRunPaid(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.mark_paid",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not mark pay run paid." }, 400);
    }
  })
  .get("/paystubs/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const paystub = await getPaystubDetail(c.req.param("id"));
      return c.json({ paystub });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Not found" }, 404);
    }
  });
