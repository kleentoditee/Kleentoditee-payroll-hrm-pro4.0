// Batch 20 — Leave Policy v2 routes: holidays, policy v2 fields, assignments,
// accrual/carryover posting, event-ledger balances, time-for-time.
import { prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  backfillLeaveEvents,
  convertOvertimeToLeave,
  leaveBalancesV2,
  postAccruals,
  postCarryovers,
  seedBviHolidays
} from "../lib/leave-v2.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;
const CAN_EDIT = [Role.platform_owner, Role.hr_admin] as const;

function parseDateInput(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYear(value: unknown): number | null {
  const y = Number(value);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null;
}

export const leaveV2Routes = new Hono<{ Variables: AuthVariables }>()
  // -- BVI public holidays ------------------------------------------------------
  .get("/leave/v2/holidays", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const year = parseYear(c.req.query("year")) ?? new Date().getUTCFullYear();
    const rows = await prisma.publicHoliday.findMany({
      where: { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      orderBy: { date: "asc" }
    });
    return c.json({ year, rows });
  })
  .post("/leave/v2/holidays/seed", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const year = parseYear(body.year) ?? new Date().getUTCFullYear();
    const result = await seedBviHolidays(year);
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "leave.holidays_seeded",
      entityType: "PublicHoliday",
      after: result
    });
    return c.json({ result });
  })
  .post("/leave/v2/holidays", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const date = parseDateInput(body.date);
    const name = String(body.name ?? "").trim();
    if (!date || !name) return c.json({ error: "date and name are required." }, 400);
    const existing = await prisma.publicHoliday.findFirst({ where: { date } });
    if (existing) return c.json({ error: "A holiday already exists on that date." }, 409);
    const row = await prisma.publicHoliday.create({ data: { orgId: c.get("orgId"), date, name } });
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.holiday_created", entityType: "PublicHoliday", entityId: row.id, after: row });
    return c.json({ row }, 201);
  })
  .delete("/leave/v2/holidays/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const row = await prisma.publicHoliday.findFirst({ where: { id: c.req.param("id") } });
    if (!row) return c.json({ error: "Not found." }, 404);
    await prisma.publicHoliday.delete({ where: { id: row.id } });
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.holiday_deleted", entityType: "PublicHoliday", entityId: row.id, before: row });
    return c.json({ ok: true });
  })

  // -- policy v2 fields ----------------------------------------------------------
  .patch("/leave/v2/policies/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const existing = await prisma.leavePolicy.findFirst({ where: { id: c.req.param("id") } });
    if (!existing) return c.json({ error: "Leave policy not found." }, 404);
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};
    if (body.basis !== undefined) {
      if (body.basis !== "days" && body.basis !== "hours") return c.json({ error: "basis must be days or hours." }, 400);
      data.basis = body.basis;
    }
    for (const f of ["accrualPerMonth", "carryoverCap", "maxBalance"] as const) {
      if (body[f] !== undefined) {
        const v = Number(body[f]);
        if (!Number.isFinite(v) || v < 0 || v > 1000) return c.json({ error: `${f} must be between 0 and 1000.` }, 400);
        data[f] = v;
      }
    }
    if (body.excludePublicHolidays !== undefined) data.excludePublicHolidays = Boolean(body.excludePublicHolidays);
    if (!Object.keys(data).length) return c.json({ error: "Nothing to update." }, 400);
    const updated = await prisma.leavePolicy.update({ where: { id: existing.id }, data });
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.policy_v2_update", entityType: "LeavePolicy", entityId: existing.id, before: existing, after: updated });
    return c.json({ item: updated });
  })

  // -- assignments -----------------------------------------------------------------
  .get("/leave/v2/policies/:id/assignments", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const rows = await prisma.leavePolicyAssignment.findMany({
      where: { policyId: c.req.param("id") },
      include: { employee: { select: { id: true, fullName: true } } },
      orderBy: { effectiveFrom: "desc" }
    });
    return c.json({ rows });
  })
  .post("/leave/v2/policies/:id/assignments", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const policy = await prisma.leavePolicy.findFirst({ where: { id: c.req.param("id") } });
    if (!policy) return c.json({ error: "Leave policy not found." }, 404);
    const body = await c.req.json<Record<string, unknown>>();
    const employeeId = String(body.employeeId ?? "");
    const effectiveFrom = parseDateInput(body.effectiveFrom);
    const effectiveTo = parseDateInput(body.effectiveTo);
    if (!employeeId || !effectiveFrom) return c.json({ error: "employeeId and effectiveFrom are required." }, 400);
    if (effectiveTo && effectiveTo < effectiveFrom) return c.json({ error: "effectiveTo is before effectiveFrom." }, 400);
    const employee = await prisma.employee.findFirst({ where: { id: employeeId }, select: { id: true } });
    if (!employee) return c.json({ error: "Employee not found." }, 400);
    const dup = await prisma.leavePolicyAssignment.findFirst({ where: { policyId: policy.id, employeeId, effectiveFrom } });
    if (dup) return c.json({ error: "An assignment with that start date already exists." }, 409);
    const row = await prisma.leavePolicyAssignment.create({
      data: { orgId: c.get("orgId"), policyId: policy.id, employeeId, effectiveFrom, effectiveTo }
    });
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.assignment_created", entityType: "LeavePolicyAssignment", entityId: row.id, after: row });
    return c.json({ row }, 201);
  })
  .delete("/leave/v2/assignments/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const row = await prisma.leavePolicyAssignment.findFirst({ where: { id: c.req.param("id") } });
    if (!row) return c.json({ error: "Not found." }, 404);
    await prisma.leavePolicyAssignment.delete({ where: { id: row.id } });
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.assignment_deleted", entityType: "LeavePolicyAssignment", entityId: row.id, before: row });
    return c.json({ ok: true });
  })

  // -- accrual / carryover / backfill posting ---------------------------------------
  .post("/leave/v2/accruals/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const year = parseYear(body.year) ?? new Date().getUTCFullYear();
    const result = await postAccruals(year);
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.accruals_posted", entityType: "LeaveEvent", after: result });
    return c.json({ result });
  })
  .post("/leave/v2/carryovers/post", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const year = parseYear(body.year) ?? new Date().getUTCFullYear();
    const result = await postCarryovers(year);
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.carryovers_posted", entityType: "LeaveEvent", after: result });
    return c.json({ result });
  })
  .post("/leave/v2/backfill", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const result = await backfillLeaveEvents();
    await writeAudit({ actorUserId: c.get("userId"), action: "leave.events_backfilled", entityType: "LeaveEvent", after: result });
    return c.json({ result });
  })

  // -- balances + events --------------------------------------------------------------
  .get("/leave/v2/balances", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const year = parseYear(c.req.query("year")) ?? new Date().getUTCFullYear();
    const employeeId = String(c.req.query("employeeId") ?? "").trim() || undefined;
    return c.json(await leaveBalancesV2(year, employeeId));
  })
  .get("/leave/v2/events", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const year = parseYear(c.req.query("year"));
    const employeeId = String(c.req.query("employeeId") ?? "").trim() || undefined;
    const policyId = String(c.req.query("policyId") ?? "").trim() || undefined;
    const rows = await prisma.leaveEvent.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(policyId ? { policyId } : {}),
        ...(year ? { eventDate: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } } : {})
      },
      include: { employee: { select: { id: true, fullName: true } }, policy: { select: { id: true, code: true, name: true } } },
      orderBy: [{ eventDate: "desc" }],
      take: 500
    });
    return c.json({ rows });
  })

  // -- time-for-time ----------------------------------------------------------------------
  .post("/leave/v2/time-for-time", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    try {
      const event = await convertOvertimeToLeave(
        String(body.employeeId ?? ""),
        String(body.policyId ?? ""),
        Number(body.hours),
        String(body.note ?? ""),
        c.get("userId")
      );
      await writeAudit({ actorUserId: c.get("userId"), action: "leave.time_for_time", entityType: "LeaveEvent", entityId: event.id, after: event });
      return c.json({ event }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Conversion failed." }, 400);
    }
  });
