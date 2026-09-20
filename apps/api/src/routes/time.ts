import { prisma, Role, TimeEntryStatus } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { employeeForNestedTimeContextSelect } from "../lib/employee-privacy.js";
import { computeEntryPreview } from "../lib/payroll-calc.js";
import { getEmployeePaystub, listEmployeePaystubs } from "../lib/payroll-service.js";
import { calculatedShiftHours } from "../lib/work-time.js";
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

const ADMIN_ONLY_PAY_FIELDS = [
  "flatGross",
  "bonus",
  "allowance",
  "advanceDeduction",
  "withdrawalDeduction",
  "loanDeduction",
  "otherDeduction",
  "templateId",
  "applyNhi",
  "applySsb",
  "applyIncomeTax"
] as const;

function containsAdminOnlyPayFields(body: Record<string, unknown>): boolean {
  return ADMIN_ONLY_PAY_FIELDS.some((field) => body[field] !== undefined);
}

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
        applyIncomeTax: false
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
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true },
      orderBy: queueAll
        ? [{ updatedAt: "desc" }]
        : [{ employee: { fullName: "asc" } }, { site: "asc" }],
      take: queueAll ? 500 : undefined
    });
    return c.json({ month: queueAll ? null : month, queueAll, items });
  })
  .get("/entries/count", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const queueAll = c.req.query("queue") === "all";
    const month = c.req.query("month")?.trim() || monthKey(new Date());
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const statusFilter = c.req.query("status")?.trim();

    const count = await prisma.timeEntry.count({
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
      }
    });
    return c.json({ month: queueAll ? null : month, queueAll, count });
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
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
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
    if (status !== TimeEntryStatus.draft && status !== TimeEntryStatus.submitted) {
      return c.json(
        { error: "New time entries can only be created as draft or submitted. Use the submit/approve workflow to advance them." },
        400
      );
    }
    const periodStart = parseDateInput(body.periodStart);
    const periodEnd = parseDateInput(body.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }
    const rawLocations = Array.isArray(body.locations) ? body.locations : null;
    if (rawLocations && (rawLocations.length === 0 || rawLocations.length > 20)) {
      return c.json({ error: "Add between 1 and 20 work locations." }, 400);
    }
    const locationBodies: Record<string, unknown>[] = rawLocations
      ? rawLocations.filter(
          (location): location is Record<string, unknown> =>
            typeof location === "object" && location !== null && !Array.isArray(location)
        )
      : [body];
    if (rawLocations && locationBodies.length !== rawLocations.length) {
      return c.json({ error: "Each work location must be a valid row." }, 400);
    }
    const locations = locationBodies.map((location) => {
      const site = String(location.site ?? employee.defaultSite ?? "").trim();
      const startTime = String(location.startTime ?? "").trim();
      const endTime = String(location.endTime ?? "").trim();
      const breakMinutes = Number(location.breakMinutes ?? 0);
      const shiftHours = startTime || endTime ? calculatedShiftHours(startTime, endTime, breakMinutes) : null;
      return { site, startTime, endTime, breakMinutes, shiftHours };
    });
    if (rawLocations && locations.some((location) => !location.site || !location.startTime || !location.endTime)) {
      return c.json({ error: "Enter a location, start time, and finish time for every row." }, 400);
    }
    if (locations.some((location) => (location.startTime || location.endTime) && location.shiftHours === null)) {
      return c.json({ error: "Enter valid start and finish times and a non-negative break." }, 400);
    }

    const rows = await prisma.$transaction(
      locations.map((location, index) => prisma.timeEntry.create({
        data: {
        employeeId,
        month,
        periodStart,
        periodEnd,
        site: location.site,
        startTime: location.startTime,
        endTime: location.endTime,
        breakMinutes: location.breakMinutes,
        status,
        daysWorked: location.shiftHours !== null ? (location.shiftHours > 0 ? 1 : 0) : Number(body.daysWorked ?? 0),
        hoursWorked: location.shiftHours ?? Number(body.hoursWorked ?? 0),
        overtimeHours: index === 0 ? Number(body.overtimeHours ?? 0) : 0,
        flatGross: index === 0 ? Number(body.flatGross ?? 0) : 0,
        bonus: index === 0 ? Number(body.bonus ?? 0) : 0,
        allowance: index === 0 ? Number(body.allowance ?? 0) : 0,
        advanceDeduction: index === 0 ? Number(body.advanceDeduction ?? 0) : 0,
        withdrawalDeduction: index === 0 ? Number(body.withdrawalDeduction ?? 0) : 0,
        loanDeduction: index === 0 ? Number(body.loanDeduction ?? 0) : 0,
        otherDeduction: index === 0 ? Number(body.otherDeduction ?? 0) : 0,
        templateId,
        applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : tpl.applyNhi,
        applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : tpl.applySsb,
        applyIncomeTax: false,
        notes: String(body.notes ?? "")
        },
        include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
      }))
    );
    await writeAudit({
      actorUserId: c.get("userId"),
      action: rows.length > 1 ? "time_entry.create_multiple_locations" : "time_entry.create",
      entityType: "TimeEntry",
      entityId: rows[0].id,
      after: { ids: rows.map((row) => row.id), employeeId, month, locationCount: rows.length }
    });
    return c.json({ entry: rows[0], entries: rows }, 201);
  })
  .put("/entries/:id/locations", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before) return c.json({ error: "Not found" }, 404);
    if (before.status === TimeEntryStatus.approved || before.status === TimeEntryStatus.paid) {
      return c.json({ error: "Approved or paid work time is locked." }, 400);
    }

    const body = await c.req.json<Record<string, unknown>>();
    const rawLocations = Array.isArray(body.locations) ? body.locations : [];
    if (rawLocations.length === 0 || rawLocations.length > 20) {
      return c.json({ error: "Add between 1 and 20 work locations." }, 400);
    }
    const locationBodies = rawLocations.filter(
      (location): location is Record<string, unknown> =>
        typeof location === "object" && location !== null && !Array.isArray(location)
    );
    if (locationBodies.length !== rawLocations.length) {
      return c.json({ error: "Each work location must be a valid row." }, 400);
    }
    const locations = locationBodies.map((location) => {
      const site = String(location.site ?? "").trim();
      const startTime = String(location.startTime ?? "").trim();
      const endTime = String(location.endTime ?? "").trim();
      const breakMinutes = Number(location.breakMinutes ?? 0);
      return { site, startTime, endTime, breakMinutes, shiftHours: calculatedShiftHours(startTime, endTime, breakMinutes) };
    });
    if (locations.some((location) => !location.site || location.shiftHours === null)) {
      return c.json({ error: "Enter a location, valid start and finish times, and a non-negative break for every row." }, 400);
    }

    const month = String(body.month ?? before.month).trim();
    const periodStart = parseDateInput(body.periodStart);
    const periodEnd = parseDateInput(body.periodEnd);
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      return c.json({ error: "Enter a valid work date." }, 400);
    }
    const status = body.status === undefined ? before.status : parseStatus(body.status);
    if (!status || (status !== TimeEntryStatus.draft && status !== TimeEntryStatus.submitted)) {
      return c.json({ error: "Work time can be saved as draft or submitted." }, 400);
    }
    const templateId = String(body.templateId ?? before.templateId);
    const template = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!template) return c.json({ error: "Template not found" }, 400);

    const rows = await prisma.$transaction(async (tx) => {
      const first = locations[0];
      const updated = await tx.timeEntry.update({
        where: { id },
        data: {
          month, periodStart, periodEnd, site: first.site, startTime: first.startTime, endTime: first.endTime,
          breakMinutes: first.breakMinutes, status,
          daysWorked: (first.shiftHours ?? 0) > 0 ? 1 : 0, hoursWorked: first.shiftHours ?? 0,
          overtimeHours: Number(body.overtimeHours ?? before.overtimeHours),
          flatGross: Number(body.flatGross ?? before.flatGross), bonus: Number(body.bonus ?? before.bonus),
          allowance: Number(body.allowance ?? before.allowance),
          advanceDeduction: Number(body.advanceDeduction ?? before.advanceDeduction),
          withdrawalDeduction: Number(body.withdrawalDeduction ?? before.withdrawalDeduction),
          loanDeduction: Number(body.loanDeduction ?? before.loanDeduction),
          otherDeduction: Number(body.otherDeduction ?? before.otherDeduction), templateId,
          applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : before.applyNhi,
          applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : before.applySsb,
          applyIncomeTax: false, notes: String(body.notes ?? before.notes)
        },
        include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
      });
      const created = [];
      for (const location of locations.slice(1)) {
        created.push(await tx.timeEntry.create({
          data: {
            employeeId: before.employeeId, month, periodStart, periodEnd, site: location.site,
            startTime: location.startTime, endTime: location.endTime, breakMinutes: location.breakMinutes,
            status, daysWorked: (location.shiftHours ?? 0) > 0 ? 1 : 0, hoursWorked: location.shiftHours ?? 0,
            overtimeHours: 0, flatGross: 0, bonus: 0, allowance: 0, advanceDeduction: 0,
            withdrawalDeduction: 0, loanDeduction: 0, otherDeduction: 0, templateId,
            applyNhi: body.applyNhi !== undefined ? Boolean(body.applyNhi) : before.applyNhi,
            applySsb: body.applySsb !== undefined ? Boolean(body.applySsb) : before.applySsb,
            applyIncomeTax: false, notes: String(body.notes ?? before.notes)
          },
          include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
        }));
      }
      return [updated, ...created];
    });

    await writeAudit({
      actorUserId: c.get("userId"), action: "time_entry.update_multiple_locations",
      entityType: "TimeEntry", entityId: id,
      before: { id: before.id, site: before.site },
      after: { ids: rows.map((row) => row.id), locationCount: rows.length }
    });
    return c.json({ entry: rows[0], entries: rows });
  })
  .patch("/entries/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.timeEntry.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const locked =
      before.status === TimeEntryStatus.approved || before.status === TimeEntryStatus.paid;
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.month !== undefined) {
      data.month = String(body.month).trim();
    }
    if (body.site !== undefined) {
      data.site = String(body.site);
    }
    if (body.startTime !== undefined) data.startTime = String(body.startTime).trim();
    if (body.endTime !== undefined) data.endTime = String(body.endTime).trim();
    if (body.breakMinutes !== undefined) data.breakMinutes = Number(body.breakMinutes);
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
    if (body.startTime !== undefined || body.endTime !== undefined || body.breakMinutes !== undefined) {
      const nextStartTime = String(data.startTime ?? before.startTime);
      const nextEndTime = String(data.endTime ?? before.endTime);
      const nextBreakMinutes = Number(data.breakMinutes ?? before.breakMinutes);
      if (nextStartTime || nextEndTime) {
        const shiftHours = calculatedShiftHours(nextStartTime, nextEndTime, nextBreakMinutes);
        if (shiftHours === null) {
          return c.json({ error: "Enter valid start and finish times and a non-negative break." }, 400);
        }
        data.hoursWorked = shiftHours;
        data.daysWorked = shiftHours > 0 ? 1 : 0;
      }
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
      data.applyIncomeTax = false;
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

    // Approved/paid entries are locked (they may already be part of a finalized
    // pay run). Block any amount/status/period change; only notes may be edited.
    if (locked) {
      const editableKeys = Object.keys(data).filter((key) => key !== "notes");
      if (editableKeys.length > 0) {
        return c.json(
          {
            error:
              "This time entry is approved or paid and is locked. Only notes can be edited; reverse the pay run to make further changes."
          },
          409
        );
      }
    }

    const row = await prisma.timeEntry.update({
      where: { id },
      data: data as never,
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
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
    if (before.status === TimeEntryStatus.approved || before.status === TimeEntryStatus.paid) {
      return c.json(
        {
          error:
            "Approved or paid time entries cannot be deleted. Reverse the related pay run before making payroll corrections."
        },
        409
      );
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
      select: {
        id: true,
        fullName: true,
        defaultSite: true,
        paySchedule: true,
        basePayType: true,
        dailyRate: true,
        hourlyRate: true,
        overtimeRate: true,
        fixedPay: true,
        standardDays: true,
        standardHours: true,
        active: true,
        phone: true,
        role: true,
        template: true
      }
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
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true },
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
    if (containsAdminOnlyPayFields(body)) {
      return c.json(
        {
          error:
            "Employees can submit work time only. Pay adjustments and deductions must be entered by an authorized payroll administrator."
        },
        403
      );
    }
    const month = String(body.month ?? "").trim();
    if (!month) {
      return c.json({ error: "month (YYYY-MM) is required" }, 400);
    }
    const employee = await prisma.employee.findUnique({ where: { id: eid } });
    if (!employee) {
      return c.json({ error: "Employee not found" }, 404);
    }
    const templateId = employee.templateId;
    const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) {
      return c.json({ error: "templateId not found" }, 400);
    }
    const periodStart = parseDateInput(body.periodStart);
    const periodEnd = parseDateInput(body.periodEnd);
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return c.json({ error: "periodStart must be on or before periodEnd" }, 400);
    }
    const rawLocations = Array.isArray(body.locations) ? body.locations : null;
    if (rawLocations && (rawLocations.length === 0 || rawLocations.length > 20)) {
      return c.json({ error: "Add between 1 and 20 work locations." }, 400);
    }
    const locationBodies: Record<string, unknown>[] = rawLocations
      ? rawLocations.filter(
          (location): location is Record<string, unknown> =>
            typeof location === "object" && location !== null && !Array.isArray(location)
        )
      : [body];
    if (rawLocations && locationBodies.length !== rawLocations.length) {
      return c.json({ error: "Each work location must be a valid row." }, 400);
    }
    const locations = locationBodies.map((location) => {
      const site = String(location.site ?? employee.defaultSite ?? "").trim();
      const startTime = String(location.startTime ?? "").trim();
      const endTime = String(location.endTime ?? "").trim();
      const breakMinutes = Number(location.breakMinutes ?? 0);
      return { site, startTime, endTime, breakMinutes, shiftHours: calculatedShiftHours(startTime, endTime, breakMinutes) };
    });
    if (locations.some((location) => !location.site || location.shiftHours === null)) {
      return c.json({ error: "Enter a location, valid start and finish times, and a non-negative break for every row." }, 400);
    }

    const rows = await prisma.$transaction(
      locations.map((location) => prisma.timeEntry.create({
        data: {
        employeeId: eid,
        month,
        periodStart,
        periodEnd,
        site: location.site,
        startTime: location.startTime,
        endTime: location.endTime,
        breakMinutes: location.breakMinutes,
        status: body.submit === true ? TimeEntryStatus.submitted : TimeEntryStatus.draft,
        daysWorked: (location.shiftHours ?? 0) > 0 ? 1 : 0,
        hoursWorked: location.shiftHours ?? 0,
        overtimeHours: Number(body.overtimeHours ?? 0),
        flatGross: 0,
        bonus: 0,
        allowance: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0,
        templateId,
        applyNhi: tpl.applyNhi,
        applySsb: tpl.applySsb,
        applyIncomeTax: false,
        notes: String(body.notes ?? "")
        },
        include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
      }))
    );
    await writeAudit({
      actorUserId: c.get("userId"),
      action: rows.length > 1 ? "time_entry.self_create_multiple_locations" : "time_entry.self_create",
      entityType: "TimeEntry",
      entityId: rows[0].id,
      after: { ids: rows.map((row) => row.id), employeeId: eid, month, locationCount: rows.length }
    });
    return c.json({ entry: rows[0], entries: rows }, 201);
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
    if (containsAdminOnlyPayFields(body)) {
      return c.json(
        {
          error:
            "Employees can update work time only. Pay adjustments and deductions must be entered by an authorized payroll administrator."
        },
        403
      );
    }
    const data: Record<string, unknown> = {};
    if (body.month !== undefined) {
      data.month = String(body.month).trim();
    }
    if (body.site !== undefined) {
      data.site = String(body.site);
    }
    if (body.startTime !== undefined) data.startTime = String(body.startTime).trim();
    if (body.endTime !== undefined) data.endTime = String(body.endTime).trim();
    if (body.breakMinutes !== undefined) data.breakMinutes = Number(body.breakMinutes);
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
    if (body.startTime !== undefined || body.endTime !== undefined || body.breakMinutes !== undefined) {
      const nextStartTime = String(data.startTime ?? before.startTime);
      const nextEndTime = String(data.endTime ?? before.endTime);
      const nextBreakMinutes = Number(data.breakMinutes ?? before.breakMinutes);
      if (nextStartTime || nextEndTime) {
        const shiftHours = calculatedShiftHours(nextStartTime, nextEndTime, nextBreakMinutes);
        if (shiftHours === null) {
          return c.json({ error: "Enter valid start and finish times and a non-negative break." }, 400);
        }
        data.hoursWorked = shiftHours;
        data.daysWorked = shiftHours > 0 ? 1 : 0;
      }
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
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
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
      include: { employee: { select: employeeForNestedTimeContextSelect }, template: true }
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
  })
  .get("/self/paystubs", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const items = await listEmployeePaystubs(eid);
    return c.json({ items });
  })
  .get("/self/paystubs/:id", authRequired, requireRole(...SELF_TIME), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const paystub = await getEmployeePaystub(eid, c.req.param("id"));
    if (!paystub) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ paystub });
  });
