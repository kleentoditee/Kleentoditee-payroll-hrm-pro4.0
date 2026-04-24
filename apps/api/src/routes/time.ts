import { prisma, Role, TimeEntryStatus } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { computeEntryPreview } from "../lib/payroll-calc.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.hr_admin, Role.payroll_admin] as const;

/** Submit → approve without full timesheet edit rights (manager queue). */
const CAN_APPROVE_ENTRIES = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const SELF_TIME = [Role.employee_tracker_user] as const;

async function resolveLinkedEmployeeId(
  c: { json: (body: { error: string }, status: number) => Response; get: (k: "userId") => string }
): Promise<string | Response> {
  const userId = c.get("userId");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true }
  });
  if (!user?.employeeId) {
    return c.json(
      { error: "This account is not linked to an employee. Ask your administrator to connect your profile." },
      403
    );
  }
  return user.employeeId;
}

function parseStatus(v: unknown): TimeEntryStatus | null {
  if (v === "draft" || v === "submitted" || v === "approved" || v === "paid") {
    return v;
  }
  return null;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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

export const timeRoutes = new Hono<{ Variables: AuthVariables }>()
  .post("/preview", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const employeeId = String(body.employeeId ?? "");
    if (!employeeId) {
      return c.json({ error: "employeeId is required" }, 400);
    }
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { template: true }
    });
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    const templateId = String(body.templateId ?? employee.templateId);
    const template =
      templateId === employee.templateId
        ? employee.template
        : await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return c.json({ error: "Template not found" }, 400);
    }
    const preview = computeEntryPreview(
      {
        basePayType: employee.basePayType,
        dailyRate: employee.dailyRate,
        hourlyRate: employee.hourlyRate,
        overtimeRate: employee.overtimeRate,
        fixedPay: employee.fixedPay
      },
      {
        nhiRate: template.nhiRate,
        ssbRate: template.ssbRate,
        incomeTaxRate: template.incomeTaxRate
      },
      {
        daysWorked: Number(body.daysWorked ?? 0),
        hoursWorked: Number(body.hoursWorked ?? 0),
        overtimeHours: Number(body.overtimeHours ?? 0),
        flatGross: Number(body.flatGross ?? 0),
        bonus: Number(body.bonus ?? 0),
        allowance: Number(body.allowance ?? 0),
        advanceDeduction: Number(body.advanceDeduction ?? 0),
        withdrawalDeduction: Number(body.withdrawalDeduction ?? 0),
        loanDeduction: Number(body.loanDeduction ?? 0),
        otherDeduction: Number(body.otherDeduction ?? 0),
        applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : template.applyNhi,
        applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : template.applySsb,
        applyIncomeTax:
          body.applyIncomeTax !== undefined ? Boolean(body.applyIncomeTax) : template.applyIncomeTax
      }
    );
    return c.json({ preview });
  })
  .get("/entries", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const queueAll = c.req.query("queue") === "all";
    const month = c.req.query("month")?.trim() || monthKey(new Date());
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const statusFilter = c.req.query("status")?.trim();

    const items = await prisma.timeEntry.findMany({
      where: {
        ...(queueAll ? {} : { month }),
        ...(statusFilter && parseStatus(statusFilter) ? { status: parseStatus(statusFilter)! } : {}),
        ...(q
          ? {
              OR: [
                { site: { contains: q } },
                { notes: { contains: q } },
                { employee: { fullName: { contains: q } } }
              ]
            }
          : {})
      },
      include: { employee: true, template: true },
      orderBy: queueAll
        ? [{ updatedAt: "desc" }]
        : [{ employee: { fullName: "asc" } }, { site: "asc" }],
      take: queueAll ? 500 : undefined
    });
    return c.json({ month: queueAll ? null : month, queueAll, items });
  })
  .post("/entries/bulk-approve", authRequired, requireRole(...CAN_APPROVE_ENTRIES), async (c) => {
    const body = await c.req.json<{ ids?: unknown }>();
    const raw = Array.isArray(body.ids) ? body.ids : [];
    const ids = [...new Set(raw.map((id) => String(id).trim()).filter(Boolean))];
    if (ids.length === 0) {
      return c.json({ error: "ids array is required" }, 400);
    }
    if (ids.length > 100) {
      return c.json({ error: "At most 100 entries per request" }, 400);
    }

    const found = await prisma.timeEntry.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true }
    });
    const submittedIds = found
      .filter((row) => row.status === TimeEntryStatus.submitted)
      .map((row) => row.id);
    if (submittedIds.length === 0) {
      return c.json(
        { error: "No submitted entries in selection (wrong id or status).", updated: 0 },
        400
      );
    }

    await prisma.timeEntry.updateMany({
      where: { id: { in: submittedIds }, status: TimeEntryStatus.submitted },
      data: { status: TimeEntryStatus.approved }
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.bulk_approve",
      entityType: "TimeEntry",
      metadata: { entryIds: submittedIds, count: submittedIds.length }
    });

    return c.json({
      updated: submittedIds.length,
      skipped: ids.filter((id) => !submittedIds.includes(id))
    });
  })
  .get("/entries/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.timeEntry.findUnique({
      where: { id },
      include: { employee: true, template: true }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ entry: row });
  })
  .post("/entries", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const employeeId = String(body.employeeId ?? "");
    const month = String(body.month ?? "").trim();
    if (!employeeId || !month) {
      return c.json({ error: "employeeId and month (YYYY-MM) are required" }, 400);
    }
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    const templateId = String(body.templateId ?? employee.templateId);
    const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) {
      return c.json({ error: "templateId not found" }, 400);
    }
    const status = parseStatus(body.status) ?? TimeEntryStatus.draft;
    const periodStart = parseDateInput(body.periodStart);
    const periodEnd = parseDateInput(body.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }

    const row = await prisma.timeEntry.create({
      data: {
        employeeId,
        month,
        periodStart,
        periodEnd,
        site: String(body.site ?? employee.defaultSite ?? ""),
        status,
        daysWorked: Number(body.daysWorked ?? 0),
        hoursWorked: Number(body.hoursWorked ?? 0),
        overtimeHours: Number(body.overtimeHours ?? 0),
        flatGross: Number(body.flatGross ?? 0),
        bonus: Number(body.bonus ?? 0),
        allowance: Number(body.allowance ?? 0),
        advanceDeduction: Number(body.advanceDeduction ?? 0),
        withdrawalDeduction: Number(body.withdrawalDeduction ?? 0),
        loanDeduction: Number(body.loanDeduction ?? 0),
        otherDeduction: Number(body.otherDeduction ?? 0),
        templateId,
        applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : tpl.applyNhi,
        applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : tpl.applySsb,
        applyIncomeTax:
          body.applyIncomeTax !== undefined ? Boolean(body.applyIncomeTax) : tpl.applyIncomeTax,
        notes: String(body.notes ?? "")
      },
      include: { employee: true, template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.create",
      entityType: "TimeEntry",
      entityId: row.id,
      after: { id: row.id, employeeId, month }
    });
    return c.json({ entry: row }, 201);
  })
  .patch("/entries/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.month !== undefined) {
      data.month = String(body.month).trim();
    }
    if (body.site !== undefined) {
      data.site = String(body.site);
    }
    if (body.periodStart !== undefined) {
      const periodStart = body.periodStart ? parseDateInput(body.periodStart) : null;
      if (body.periodStart && !periodStart) {
        return c.json({ error: "Invalid periodStart" }, 400);
      }
      data.periodStart = periodStart;
    }
    if (body.periodEnd !== undefined) {
      const periodEnd = body.periodEnd ? parseDateInput(body.periodEnd) : null;
      if (body.periodEnd && !periodEnd) {
        return c.json({ error: "Invalid periodEnd" }, 400);
      }
      data.periodEnd = periodEnd;
    }
    const nextPeriodStart =
      data.periodStart !== undefined ? (data.periodStart as Date | null) : before.periodStart;
    const nextPeriodEnd =
      data.periodEnd !== undefined ? (data.periodEnd as Date | null) : before.periodEnd;
    if (nextPeriodStart && nextPeriodEnd && nextPeriodStart > nextPeriodEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }
    if (body.status !== undefined) {
      const s = parseStatus(body.status);
      if (!s) {
        return c.json({ error: "Invalid status" }, 400);
      }
      data.status = s;
    }
    if (body.daysWorked !== undefined) {
      data.daysWorked = Number(body.daysWorked);
    }
    if (body.hoursWorked !== undefined) {
      data.hoursWorked = Number(body.hoursWorked);
    }
    if (body.overtimeHours !== undefined) {
      data.overtimeHours = Number(body.overtimeHours);
    }
    if (body.flatGross !== undefined) {
      data.flatGross = Number(body.flatGross);
    }
    if (body.bonus !== undefined) {
      data.bonus = Number(body.bonus);
    }
    if (body.allowance !== undefined) {
      data.allowance = Number(body.allowance);
    }
    if (body.advanceDeduction !== undefined) {
      data.advanceDeduction = Number(body.advanceDeduction);
    }
    if (body.withdrawalDeduction !== undefined) {
      data.withdrawalDeduction = Number(body.withdrawalDeduction);
    }
    if (body.loanDeduction !== undefined) {
      data.loanDeduction = Number(body.loanDeduction);
    }
    if (body.otherDeduction !== undefined) {
      data.otherDeduction = Number(body.otherDeduction);
    }
    if (body.applyNhi !== undefined) {
      data.applyNhi = Boolean(body.applyNhi);
    }
    if (body.applySsb !== undefined) {
      data.applySsb = Boolean(body.applySsb);
    }
    if (body.applyIncomeTax !== undefined) {
      data.applyIncomeTax = Boolean(body.applyIncomeTax);
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes);
    }
    if (body.templateId !== undefined) {
      const tid = String(body.templateId);
      const ok = await prisma.deductionTemplate.findUnique({ where: { id: tid } });
      if (!ok) {
        return c.json({ error: "templateId not found" }, 400);
      }
      data.templateId = tid;
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    const row = await prisma.timeEntry.update({
      where: { id },
      data: data as never,
      include: { employee: true, template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.update",
      entityType: "TimeEntry",
      entityId: id,
      before,
      after: row
    });
    return c.json({ entry: row });
  })
  .delete("/entries/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.timeEntry.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.delete",
      entityType: "TimeEntry",
      entityId: id,
      before
    });
    return c.body(null, 204);
  })
  .get("/self/profile", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const row = await prisma.employee.findUnique({
      where: { id: eid },
      include: { template: true }
    });
    if (!row) {
      return c.json({ error: "Employee record missing" }, 404);
    }
    return c.json({ employee: row });
  })
  .get("/self/entries", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const month = c.req.query("month")?.trim() || monthKey(new Date());
    const items = await prisma.timeEntry.findMany({
      where: { employeeId: eid, month },
      include: { employee: true, template: true },
      orderBy: [{ site: "asc" }, { updatedAt: "desc" }]
    });
    return c.json({ month, items });
  })
  .post("/self/entries", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const body = await c.req.json<Record<string, unknown>>();
    const month = String(body.month ?? "").trim();
    if (!month) {
      return c.json({ error: "month (YYYY-MM) is required" }, 400);
    }
    const employee = await prisma.employee.findUnique({ where: { id: eid } });
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    const templateId = String(body.templateId ?? employee.templateId);
    const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) {
      return c.json({ error: "templateId not found" }, 400);
    }
    const periodStart = parseDateInput(body.periodStart);
    const periodEnd = parseDateInput(body.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }

    const row = await prisma.timeEntry.create({
      data: {
        employeeId: eid,
        month,
        periodStart,
        periodEnd,
        site: String(body.site ?? employee.defaultSite ?? ""),
        status: TimeEntryStatus.draft,
        daysWorked: Number(body.daysWorked ?? 0),
        hoursWorked: Number(body.hoursWorked ?? 0),
        overtimeHours: Number(body.overtimeHours ?? 0),
        flatGross: Number(body.flatGross ?? 0),
        bonus: Number(body.bonus ?? 0),
        allowance: Number(body.allowance ?? 0),
        advanceDeduction: Number(body.advanceDeduction ?? 0),
        withdrawalDeduction: Number(body.withdrawalDeduction ?? 0),
        loanDeduction: Number(body.loanDeduction ?? 0),
        otherDeduction: Number(body.otherDeduction ?? 0),
        templateId,
        applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : tpl.applyNhi,
        applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : tpl.applySsb,
        applyIncomeTax:
          body.applyIncomeTax !== undefined ? Boolean(body.applyIncomeTax) : tpl.applyIncomeTax,
        notes: String(body.notes ?? "")
      },
      include: { employee: true, template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.self_create",
      entityType: "TimeEntry",
      entityId: row.id,
      after: { id: row.id, employeeId: eid, month }
    });
    return c.json({ entry: row }, 201);
  })
  .patch("/self/entries/:id", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before || before.employeeId !== eid) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TimeEntryStatus.draft) {
      return c.json({ error: "Only draft entries can be edited in the app" }, 400);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};
    if (body.month !== undefined) {
      data.month = String(body.month).trim();
    }
    if (body.site !== undefined) {
      data.site = String(body.site);
    }
    if (body.periodStart !== undefined) {
      const periodStart = body.periodStart ? parseDateInput(body.periodStart) : null;
      if (body.periodStart && !periodStart) {
        return c.json({ error: "Invalid periodStart" }, 400);
      }
      data.periodStart = periodStart;
    }
    if (body.periodEnd !== undefined) {
      const periodEnd = body.periodEnd ? parseDateInput(body.periodEnd) : null;
      if (body.periodEnd && !periodEnd) {
        return c.json({ error: "Invalid periodEnd" }, 400);
      }
      data.periodEnd = periodEnd;
    }
    if (body.daysWorked !== undefined) {
      data.daysWorked = Number(body.daysWorked);
    }
    if (body.hoursWorked !== undefined) {
      data.hoursWorked = Number(body.hoursWorked);
    }
    if (body.overtimeHours !== undefined) {
      data.overtimeHours = Number(body.overtimeHours);
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes);
    }
    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const nextStart =
      data.periodStart !== undefined ? (data.periodStart as Date | null) : before.periodStart;
    const nextEnd = data.periodEnd !== undefined ? (data.periodEnd as Date | null) : before.periodEnd;
    if (nextStart && nextEnd && nextStart > nextEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }
    const row = await prisma.timeEntry.update({
      where: { id },
      data: data as never,
      include: { employee: true, template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.self_update",
      entityType: "TimeEntry",
      entityId: id,
      before,
      after: row
    });
    return c.json({ entry: row });
  })
  .post("/self/entries/:id/submit", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before || before.employeeId !== eid) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TimeEntryStatus.draft) {
      return c.json({ error: "Only draft entries can be submitted" }, 400);
    }
    const row = await prisma.timeEntry.update({
      where: { id },
      data: { status: TimeEntryStatus.submitted },
      include: { employee: true, template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.self_submit",
      entityType: "TimeEntry",
      entityId: id,
      before,
      after: row
    });
    return c.json({ entry: row });
  })
  .delete("/self/entries/:id", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before || before.employeeId !== eid) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== TimeEntryStatus.draft) {
      return c.json({ error: "Only draft entries can be deleted" }, 400);
    }
    await prisma.timeEntry.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "time_entry.self_delete",
      entityType: "TimeEntry",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
