// Batch 19 — HR structure routes: masters CRUD, effective-dated contracts,
// assets, reminders, reports, backfill, archived-file promotion.
import { prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  addContract,
  backfillHrStructure,
  hrReminders,
  masterModel,
  masterUsage,
  parseEmploymentType,
  patternHoursPerWeek,
  promoteArchivedFile,
  structureReport,
  validateSchedulePattern,
  MASTER_MODELS,
  type ContractInput,
  type MasterKind
} from "../lib/hr-structure.js";
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

const audit = (
  c: { get(key: "userId"): string },
  action: string,
  entityType: string,
  entityId: string,
  extra: { before?: unknown; after?: unknown } = {}
) => writeAudit({ actorUserId: c.get("userId"), action, entityType, entityId, before: extra.before, after: extra.after });

function parseDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const MASTER_KINDS = Object.keys(MASTER_MODELS) as MasterKind[];

export const hrStructureRoutes = new Hono<{ Variables: AuthVariables }>()
  // -- masters CRUD ----------------------------------------------------------
  .get("/masters/:kind", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const kind = c.req.param("kind") as MasterKind;
    if (!MASTER_KINDS.includes(kind)) return c.json({ error: "Unknown master type." }, 404);
    const rows = await masterModel(kind).findMany({ orderBy: { code: "asc" } });
    return c.json({ rows });
  })
  .post("/masters/:kind", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const kind = c.req.param("kind") as MasterKind;
    if (!MASTER_KINDS.includes(kind)) return c.json({ error: "Unknown master type." }, 404);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const orgId = c.get("orgId");
    const code = String(body.code ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!code || !name) return c.json({ error: "Code and name are required." }, 400);
    const model = masterModel(kind);
    if (await model.findFirst({ where: { OR: [{ code }, { name: { equals: name, mode: "insensitive" } }] } })) {
      return c.json({ error: `A ${kind.replace(/-/g, " ")} with that code or name already exists.` }, 409);
    }
    const data: Record<string, unknown> = { orgId, code, name };
    if (kind === "departments" && body.parentId) {
      const parent = await prisma.department.findFirst({ where: { id: String(body.parentId) }, select: { id: true } });
      if (!parent) return c.json({ error: "Parent department not found in this organization." }, 400);
      data.parentId = parent.id;
    }
    if (kind === "locations") data.address = String(body.address ?? "");
    if (kind === "cost-centres" && body.glAccountId) {
      const account = await prisma.account.findFirst({ where: { id: String(body.glAccountId) }, select: { id: true } });
      if (!account) return c.json({ error: "GL account not found in this organization." }, 400);
      data.glAccountId = account.id;
    }
    if (kind === "work-schedules") {
      try {
        const pattern = validateSchedulePattern(body.pattern ?? []);
        data.pattern = pattern;
        data.standardHoursPerWeek = patternHoursPerWeek(pattern);
        data.description = String(body.description ?? "");
      } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : "Invalid schedule pattern." }, 400);
      }
    }
    const created = await model.create({ data });
    await audit(c, "hr_structure.master_created", MASTER_MODELS[kind], String(created.id), {
      after: { kind, code, name }
    });
    return c.json({ row: created }, 201);
  })
  .patch("/masters/:kind/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const kind = c.req.param("kind") as MasterKind;
    if (!MASTER_KINDS.includes(kind)) return c.json({ error: "Unknown master type." }, 404);
    const model = masterModel(kind);
    const existing = await model.findFirst({ where: { id: c.req.param("id") } });
    if (!existing) return c.json({ error: "Record not found." }, 404);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const data: Record<string, unknown> = {};
    if (body.name != null) data.name = String(body.name).trim();
    if (body.active != null) data.active = Boolean(body.active);
    if (kind === "departments" && body.parentId !== undefined) {
      if (body.parentId && String(body.parentId) === String(existing.id)) {
        return c.json({ error: "A department cannot be its own parent." }, 400);
      }
      if (body.parentId) {
        const parent = await prisma.department.findFirst({ where: { id: String(body.parentId) }, select: { id: true } });
        if (!parent) return c.json({ error: "Parent department not found in this organization." }, 400);
        data.parentId = parent.id;
      } else {
        data.parentId = null;
      }
    }
    if (kind === "locations" && body.address !== undefined) data.address = String(body.address ?? "");
    if (kind === "cost-centres" && body.glAccountId !== undefined) {
      if (body.glAccountId) {
        const account = await prisma.account.findFirst({ where: { id: String(body.glAccountId) }, select: { id: true } });
        if (!account) return c.json({ error: "GL account not found in this organization." }, 400);
        data.glAccountId = account.id;
      } else {
        data.glAccountId = null;
      }
    }
    if (kind === "work-schedules" && body.pattern !== undefined) {
      try {
        const pattern = validateSchedulePattern(body.pattern);
        data.pattern = pattern;
        data.standardHoursPerWeek = patternHoursPerWeek(pattern);
      } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : "Invalid schedule pattern." }, 400);
      }
    }
    if (kind === "work-schedules" && body.description !== undefined) data.description = String(body.description ?? "");
    const updated = await model.update({ where: { id: existing.id }, data });
    await audit(c, "hr_structure.master_updated", MASTER_MODELS[kind], String(existing.id), {
      before: existing,
      after: data
    });
    return c.json({ row: updated });
  })
  .delete("/masters/:kind/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const kind = c.req.param("kind") as MasterKind;
    if (!MASTER_KINDS.includes(kind)) return c.json({ error: "Unknown master type." }, 404);
    const model = masterModel(kind);
    const existing = await model.findFirst({ where: { id: c.req.param("id") } });
    if (!existing) return c.json({ error: "Record not found." }, 404);
    const usage = await masterUsage(kind, String(existing.id));
    if (usage > 0) {
      return c.json({ error: `In use by ${usage} employee/contract record(s) — archive it instead (active = false).` }, 409);
    }
    await model.delete({ where: { id: existing.id } });
    await audit(c, "hr_structure.master_deleted", MASTER_MODELS[kind], String(existing.id), { before: existing });
    return c.json({ ok: true });
  })

  // -- effective-dated contracts ----------------------------------------------
  .get("/employees/:id/contracts", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const rows = await prisma.employmentContract.findMany({
      where: { employeeId: c.req.param("id") },
      orderBy: { effectiveFrom: "desc" },
      include: {
        department: { select: { id: true, code: true, name: true } },
        position: { select: { id: true, code: true, name: true } },
        costCentre: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        workSchedule: { select: { id: true, name: true } },
        manager: { select: { id: true, fullName: true } }
      }
    });
    return c.json({ rows });
  })
  .post("/employees/:id/contracts", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const effectiveFrom = parseDate(body.effectiveFrom);
    if (!effectiveFrom) return c.json({ error: "effectiveFrom is required." }, 400);
    const input: ContractInput = {
      effectiveFrom,
      effectiveTo: parseDate(body.effectiveTo),
      employmentType: parseEmploymentType(body.employmentType),
      departmentId: body.departmentId ? String(body.departmentId) : null,
      positionId: body.positionId ? String(body.positionId) : null,
      costCentreId: body.costCentreId ? String(body.costCentreId) : null,
      locationId: body.locationId ? String(body.locationId) : null,
      workScheduleId: body.workScheduleId ? String(body.workScheduleId) : null,
      managerId: body.managerId ? String(body.managerId) : null,
      basePayType: body.basePayType === "daily" || body.basePayType === "hourly" || body.basePayType === "fixed" ? body.basePayType : null,
      dailyRate: parseNum(body.dailyRate),
      hourlyRate: parseNum(body.hourlyRate),
      fixedPay: parseNum(body.fixedPay),
      notes: String(body.notes ?? "")
    };
    try {
      const contract = await addContract(c.req.param("id"), input, c.get("userId"));
      await audit(c, "hr_structure.contract_added", "EmploymentContract", contract.id, {
        after: { employeeId: contract.employeeId, effectiveFrom: contract.effectiveFrom, employmentType: contract.employmentType }
      });
      return c.json({ contract }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not add contract." }, 400);
    }
  })
  // History is immutable: only future-dated records may be removed (they have
  // not taken effect yet); anything already effective stays as evidence.
  .delete("/contracts/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const contract = await prisma.employmentContract.findFirst({ where: { id: c.req.param("id") } });
    if (!contract) return c.json({ error: "Contract not found." }, 404);
    if (contract.effectiveFrom <= new Date()) {
      return c.json({ error: "Effective records are immutable — add a correcting contract instead." }, 409);
    }
    await prisma.employmentContract.delete({ where: { id: contract.id } });
    await audit(c, "hr_structure.contract_withdrawn", "EmploymentContract", contract.id, {
      before: { employeeId: contract.employeeId, effectiveFrom: contract.effectiveFrom }
    });
    return c.json({ ok: true });
  })

  // -- assets -------------------------------------------------------------------
  .get("/employees/:id/assets", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const rows = await prisma.employeeAsset.findMany({
      where: { employeeId: c.req.param("id") },
      orderBy: { issuedAt: "desc" }
    });
    return c.json({ rows });
  })
  .post("/employees/:id/assets", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const employee = await prisma.employee.findFirst({ where: { id: c.req.param("id") }, select: { id: true } });
    if (!employee) return c.json({ error: "Employee not found." }, 404);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const name = String(body.name ?? "").trim();
    if (!name) return c.json({ error: "Asset name is required." }, 400);
    const asset = await prisma.employeeAsset.create({
      data: {
        orgId: c.get("orgId"),
        employeeId: employee.id,
        name,
        assetTag: String(body.assetTag ?? ""),
        serialNumber: String(body.serialNumber ?? ""),
        condition: String(body.condition ?? ""),
        issuedAt: parseDate(body.issuedAt) ?? new Date(),
        notes: String(body.notes ?? "")
      }
    });
    await audit(c, "hr_structure.asset_issued", "EmployeeAsset", asset.id, { after: { employeeId: employee.id, name } });
    return c.json({ asset }, 201);
  })
  .patch("/assets/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const asset = await prisma.employeeAsset.findFirst({ where: { id: c.req.param("id") } });
    if (!asset) return c.json({ error: "Asset not found." }, 404);
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
    const updated = await prisma.employeeAsset.update({
      where: { id: asset.id },
      data: {
        ...(body.name != null ? { name: String(body.name).trim() } : {}),
        ...(body.condition !== undefined ? { condition: String(body.condition ?? "") } : {}),
        ...(body.notes !== undefined ? { notes: String(body.notes ?? "") } : {}),
        ...(body.returnedAt !== undefined ? { returnedAt: parseDate(body.returnedAt) } : {})
      }
    });
    await audit(c, "hr_structure.asset_updated", "EmployeeAsset", asset.id, { before: asset, after: updated });
    return c.json({ asset: updated });
  })

  // -- reminders + reports -------------------------------------------------------
  .get("/reminders", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const days = Math.min(Math.max(Number(c.req.query("days") ?? 30) || 30, 1), 365);
    const rows = await hrReminders(days);
    return c.json({ days, rows });
  })
  .get("/reports/departments", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      return c.json({ report: await structureReport("department", c.req.query("payRunId") || undefined) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Report failed." }, 400);
    }
  })
  .get("/reports/cost-centres", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      return c.json({ report: await structureReport("costCentre", c.req.query("payRunId") || undefined) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Report failed." }, 400);
    }
  })

  // -- backfill + archived-file promotion -----------------------------------------
  .post("/backfill", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const result = await backfillHrStructure(c.get("userId"));
    await audit(c, "hr_structure.backfill", "Organization", c.get("orgId"), { after: result });
    return c.json({ result });
  })
  .post("/imports/files/:fileId/promote", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const result = await promoteArchivedFile(c.req.param("fileId"), c.get("userId"));
      return c.json({ result });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Promotion failed." }, 400);
    }
  });
