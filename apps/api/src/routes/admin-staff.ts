import {
  prisma,
  Role,
  WorkAssignmentStatus,
  StaffAnnouncementCategory,
  StaffAnnouncementAudience
} from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW_STAFF = [
  Role.platform_owner,
  Role.hr_admin,
  Role.operations_manager,
  Role.site_supervisor,
  Role.payroll_admin
] as const;

const CAN_MANAGE_SCHEDULE = [
  Role.platform_owner,
  Role.hr_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_MANAGE_ANNOUNCEMENTS = [
  Role.platform_owner,
  Role.hr_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

function parseYmd(ymd: string | undefined): Date | null {
  const s = (ymd ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return null;
  }
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function isCategory(s: string): s is StaffAnnouncementCategory {
  return (Object.values(StaffAnnouncementCategory) as string[]).includes(s);
}

function isAudience(s: string): s is StaffAnnouncementAudience {
  return (Object.values(StaffAnnouncementAudience) as string[]).includes(s);
}

export const adminStaffRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/schedules", authRequired, requireRole(...CAN_VIEW_STAFF), async (c) => {
    const fromQ = c.req.query("from");
    const toQ = c.req.query("to");
    const employeeId = c.req.query("employeeId")?.trim() || undefined;
    if (!fromQ || !toQ) {
      return c.json({ error: "from and to query params are required (YYYY-MM-DD)" }, 400);
    }
    const from = parseYmd(fromQ);
    const to = parseYmd(toQ);
    if (!from || !to || from > to) {
      return c.json({ error: "Invalid from/to" }, 400);
    }
    const toEnd = addUtcDays(to, 1);
    const items = await prisma.workAssignment.findMany({
      where: {
        date: { gte: from, lt: toEnd },
        ...(employeeId ? { employeeId } : {})
      },
      orderBy: [{ date: "asc" }, { locationName: "asc" }],
      include: { employee: { select: { id: true, fullName: true } } }
    });
    return c.json({
      items: items.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        employeeName: r.employee.fullName,
        date: r.date.toISOString().slice(0, 10),
        startTime: r.startTime,
        endTime: r.endTime,
        locationName: r.locationName,
        locationAddress: r.locationAddress,
        notes: r.notes,
        status: r.status,
        createdByUserId: r.createdByUserId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }))
    });
  })
  .post("/schedules", authRequired, requireRole(...CAN_MANAGE_SCHEDULE), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const employeeId = String(body.employeeId ?? "").trim();
    const dateKey = String(body.date ?? "").trim();
    if (!employeeId) {
      return c.json({ error: "employeeId is required" }, 400);
    }
    const date = parseYmd(dateKey);
    if (!date) {
      return c.json({ error: "date is required (YYYY-MM-DD)" }, 400);
    }
    const locationName = String(body.locationName ?? "").trim();
    if (!locationName) {
      return c.json({ error: "locationName is required" }, 400);
    }
    const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) {
      return c.json({ error: "Employee not found" }, 400);
    }
    const st = String(body.startTime ?? "").trim() || null;
    const en = String(body.endTime ?? "").trim() || null;
    const locAddr = String(body.locationAddress ?? "").trim() || null;
    const notes = String(body.notes ?? "").trim() || null;
    let status: WorkAssignmentStatus = WorkAssignmentStatus.SCHEDULED;
    if (body.status === "COMPLETED") {
      status = WorkAssignmentStatus.COMPLETED;
    } else if (body.status === "CANCELLED") {
      return c.json({ error: "Use cancel endpoint to cancel" }, 400);
    }
    const createdBy = c.get("userId");
    const row = await prisma.workAssignment.create({
      data: {
        employeeId,
        date,
        startTime: st,
        endTime: en,
        locationName,
        locationAddress: locAddr,
        notes,
        status,
        createdByUserId: createdBy
      }
    });
    await writeAudit({
      actorUserId: createdBy,
      action: "work_assignment.create",
      entityType: "WorkAssignment",
      entityId: row.id,
      after: { employeeId, date: dateKey, locationName }
    });
    return c.json(
      { assignment: { id: row.id, date: row.date.toISOString().slice(0, 10), status: row.status } },
      201
    );
  })
  .patch("/schedules/:id", authRequired, requireRole(...CAN_MANAGE_SCHEDULE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.workAssignment.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === WorkAssignmentStatus.CANCELLED) {
      return c.json({ error: "Cannot edit a cancelled assignment" }, 400);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: {
      date?: Date;
      startTime?: string | null;
      endTime?: string | null;
      locationName?: string;
      locationAddress?: string | null;
      notes?: string | null;
      status?: WorkAssignmentStatus;
    } = {};
    if (body.date !== undefined) {
      const d = parseYmd(String(body.date));
      if (!d) {
        return c.json({ error: "Invalid date" }, 400);
      }
      data.date = d;
    }
    if (body.startTime !== undefined) {
      data.startTime = String(body.startTime).trim() || null;
    }
    if (body.endTime !== undefined) {
      data.endTime = String(body.endTime).trim() || null;
    }
    if (body.locationName !== undefined) {
      const ln = String(body.locationName).trim();
      if (!ln) {
        return c.json({ error: "locationName cannot be empty" }, 400);
      }
      data.locationName = ln;
    }
    if (body.locationAddress !== undefined) {
      data.locationAddress = String(body.locationAddress).trim() || null;
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes).trim() || null;
    }
    if (body.status !== undefined) {
      const s = String(body.status);
      if (s === "SCHEDULED" || s === "COMPLETED" || s === "CANCELLED") {
        if (s === "CANCELLED") {
          return c.json({ error: "Use cancel endpoint to cancel" }, 400);
        }
        data.status = s as WorkAssignmentStatus;
      } else {
        return c.json({ error: "Invalid status" }, 400);
      }
    }
    const row = await prisma.workAssignment.update({ where: { id }, data });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "work_assignment.update",
      entityType: "WorkAssignment",
      entityId: id,
      before: { status: before.status },
      after: { status: row.status, date: row.date.toISOString().slice(0, 10) }
    });
    return c.json({ assignment: { id: row.id, date: row.date.toISOString().slice(0, 10), status: row.status } });
  })
  .post("/schedules/:id/cancel", authRequired, requireRole(...CAN_MANAGE_SCHEDULE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.workAssignment.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === WorkAssignmentStatus.CANCELLED) {
      return c.json({ error: "Already cancelled" }, 400);
    }
    const row = await prisma.workAssignment.update({
      where: { id },
      data: { status: WorkAssignmentStatus.CANCELLED }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "work_assignment.cancel",
      entityType: "WorkAssignment",
      entityId: id,
      after: { status: row.status }
    });
    return c.json({ assignment: { id: row.id, status: row.status } });
  })
  .get("/announcements", authRequired, requireRole(...CAN_VIEW_STAFF), async (c) => {
    const items = await prisma.staffAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return c.json({
      items: items.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        audience: a.audience,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        active: a.active,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      }))
    });
  })
  .post("/announcements", authRequired, requireRole(...CAN_MANAGE_ANNOUNCEMENTS), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const title = String(body.title ?? "").trim();
    const tBody = String(body.body ?? "").trim();
    if (!title) {
      return c.json({ error: "title is required" }, 400);
    }
    if (!tBody) {
      return c.json({ error: "body is required" }, 400);
    }
    const cat = String(body.category ?? "GENERAL");
    if (!isCategory(cat)) {
      return c.json({ error: "Invalid category" }, 400);
    }
    const aud = String(body.audience ?? "ALL");
    if (!isAudience(aud)) {
      return c.json({ error: "Invalid audience" }, 400);
    }
    const startsAt = body.startsAt != null && String(body.startsAt) !== "" ? parseYmd(String(body.startsAt)) : null;
    const endsAt = body.endsAt != null && String(body.endsAt) !== "" ? parseYmd(String(body.endsAt)) : null;
    if (body.startsAt && !startsAt) {
      return c.json({ error: "Invalid startsAt" }, 400);
    }
    if (body.endsAt && !endsAt) {
      return c.json({ error: "Invalid endsAt" }, 400);
    }
    const row = await prisma.staffAnnouncement.create({
      data: {
        title,
        body: tBody,
        category: cat,
        audience: aud,
        startsAt: startsAt,
        endsAt: endsAt ? addUtcDays(endsAt, 1) : null,
        active: body.active !== false,
        createdByUserId: c.get("userId")
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "staff_announcement.create",
      entityType: "StaffAnnouncement",
      entityId: row.id,
      after: { title, category: cat, audience: aud }
    });
    return c.json({ item: { id: row.id, title: row.title, active: row.active } }, 201);
  })
  .patch("/announcements/:id", authRequired, requireRole(...CAN_MANAGE_ANNOUNCEMENTS), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.staffAnnouncement.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: {
      title?: string;
      body?: string;
      category?: StaffAnnouncementCategory;
      audience?: StaffAnnouncementAudience;
      startsAt?: Date | null;
      endsAt?: Date | null;
      active?: boolean;
    } = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (!t) {
        return c.json({ error: "title cannot be empty" }, 400);
      }
      data.title = t;
    }
    if (body.body !== undefined) {
      const t = String(body.body).trim();
      if (!t) {
        return c.json({ error: "body cannot be empty" }, 400);
      }
      data.body = t;
    }
    if (body.category !== undefined) {
      const cstr = String(body.category);
      if (!isCategory(cstr)) {
        return c.json({ error: "Invalid category" }, 400);
      }
      data.category = cstr;
    }
    if (body.audience !== undefined) {
      const astr = String(body.audience);
      if (!isAudience(astr)) {
        return c.json({ error: "Invalid audience" }, 400);
      }
      data.audience = astr;
    }
    if (body.startsAt !== undefined) {
      if (body.startsAt === null) {
        data.startsAt = null;
      } else {
        const d = parseYmd(String(body.startsAt));
        if (!d) {
          return c.json({ error: "Invalid startsAt" }, 400);
        }
        data.startsAt = d;
      }
    }
    if (body.endsAt !== undefined) {
      if (body.endsAt === null) {
        data.endsAt = null;
      } else {
        const d = parseYmd(String(body.endsAt));
        if (!d) {
          return c.json({ error: "Invalid endsAt" }, 400);
        }
        data.endsAt = addUtcDays(d, 1);
      }
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }
    const row = await prisma.staffAnnouncement.update({ where: { id }, data });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "staff_announcement.update",
      entityType: "StaffAnnouncement",
      entityId: id,
      after: { active: row.active, title: row.title }
    });
    return c.json({ item: { id: row.id, title: row.title, active: row.active } });
  });
