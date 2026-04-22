import { PayBasis, prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
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

function parsePayBasis(v: unknown): PayBasis | null {
  if (v === "daily" || v === "hourly" || v === "fixed") {
    return v;
  }
  return null;
}

export const peopleRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/templates", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const items = await prisma.deductionTemplate.findMany({ orderBy: { name: "asc" } });
    return c.json({ items });
  })
  .post("/templates", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const name = String(body.name ?? "").trim();
    if (!name) {
      return c.json({ error: "name is required" }, 400);
    }
    const row = await prisma.deductionTemplate.create({
      data: {
        name,
        nhiRate: Number(body.nhiRate ?? 0),
        ssbRate: Number(body.ssbRate ?? 0),
        incomeTaxRate: Number(body.incomeTaxRate ?? 0),
        applyNhi: Boolean(body.applyNhi ?? true),
        applySsb: Boolean(body.applySsb ?? true),
        applyIncomeTax: Boolean(body.applyIncomeTax ?? false)
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deduction_template.create",
      entityType: "DeductionTemplate",
      entityId: row.id,
      after: row
    });
    return c.json({ template: row }, 201);
  })
  .patch("/templates/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.deductionTemplate.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      data.name = String(body.name).trim();
    }
    if (body.nhiRate !== undefined) {
      data.nhiRate = Number(body.nhiRate);
    }
    if (body.ssbRate !== undefined) {
      data.ssbRate = Number(body.ssbRate);
    }
    if (body.incomeTaxRate !== undefined) {
      data.incomeTaxRate = Number(body.incomeTaxRate);
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
    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const row = await prisma.deductionTemplate.update({ where: { id }, data: data as never });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deduction_template.update",
      entityType: "DeductionTemplate",
      entityId: id,
      before,
      after: row
    });
    return c.json({ template: row });
  })
  .delete("/templates/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const inUse = await prisma.employee.count({ where: { templateId: id } });
    if (inUse > 0) {
      return c.json({ error: "Template is assigned to employees; reassign them first." }, 409);
    }
    const before = await prisma.deductionTemplate.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.deductionTemplate.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "deduction_template.delete",
      entityType: "DeductionTemplate",
      entityId: id,
      before
    });
    return c.body(null, 204);
  })
  .get("/employees", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const items = await prisma.employee.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { role: { contains: q } },
              { defaultSite: { contains: q } }
            ]
          }
        : undefined,
      include: { template: true },
      orderBy: { fullName: "asc" }
    });
    return c.json({ items });
  })
  .get("/employees/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.employee.findUnique({
      where: { id },
      include: { template: true }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ employee: row });
  })
  .post("/employees", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const fullName = String(body.fullName ?? "").trim();
    if (!fullName) {
      return c.json({ error: "fullName is required" }, 400);
    }
    const templateId = String(body.templateId ?? "");
    if (!templateId) {
      return c.json({ error: "templateId is required" }, 400);
    }
    const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) {
      return c.json({ error: "templateId not found" }, 400);
    }
    const basis = parsePayBasis(body.basePayType);
    if (!basis) {
      return c.json({ error: "basePayType must be daily, hourly, or fixed" }, 400);
    }
    const row = await prisma.employee.create({
      data: {
        fullName,
        role: String(body.role ?? ""),
        defaultSite: String(body.defaultSite ?? ""),
        phone: String(body.phone ?? ""),
        basePayType: basis,
        dailyRate: Number(body.dailyRate ?? 0),
        hourlyRate: Number(body.hourlyRate ?? 0),
        overtimeRate: Number(body.overtimeRate ?? 0),
        fixedPay: Number(body.fixedPay ?? 0),
        standardDays: Number(body.standardDays ?? 0),
        standardHours: Number(body.standardHours ?? 0),
        active: body.active !== undefined ? Boolean(body.active) : true,
        notes: String(body.notes ?? ""),
        templateId
      },
      include: { template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.create",
      entityType: "Employee",
      entityId: row.id,
      after: row
    });
    return c.json({ employee: row }, 201);
  })
  .patch("/employees/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};
    if (body.fullName !== undefined) {
      data.fullName = String(body.fullName).trim();
    }
    if (body.role !== undefined) {
      data.role = String(body.role);
    }
    if (body.defaultSite !== undefined) {
      data.defaultSite = String(body.defaultSite);
    }
    if (body.phone !== undefined) {
      data.phone = String(body.phone);
    }
    if (body.basePayType !== undefined) {
      const basis = parsePayBasis(body.basePayType);
      if (!basis) {
        return c.json({ error: "basePayType must be daily, hourly, or fixed" }, 400);
      }
      data.basePayType = basis;
    }
    if (body.dailyRate !== undefined) {
      data.dailyRate = Number(body.dailyRate);
    }
    if (body.hourlyRate !== undefined) {
      data.hourlyRate = Number(body.hourlyRate);
    }
    if (body.overtimeRate !== undefined) {
      data.overtimeRate = Number(body.overtimeRate);
    }
    if (body.fixedPay !== undefined) {
      data.fixedPay = Number(body.fixedPay);
    }
    if (body.standardDays !== undefined) {
      data.standardDays = Number(body.standardDays);
    }
    if (body.standardHours !== undefined) {
      data.standardHours = Number(body.standardHours);
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes);
    }
    if (body.templateId !== undefined) {
      const templateId = String(body.templateId);
      const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
      if (!tpl) {
        return c.json({ error: "templateId not found" }, 400);
      }
      data.templateId = templateId;
    }
    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const row = await prisma.employee.update({
      where: { id },
      data: data as never,
      include: { template: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.update",
      entityType: "Employee",
      entityId: id,
      before,
      after: row
    });
    return c.json({ employee: row });
  })
  .delete("/employees/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.employee.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.delete",
      entityType: "Employee",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
