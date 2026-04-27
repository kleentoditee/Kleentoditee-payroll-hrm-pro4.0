import { randomUUID } from "node:crypto";
import { EmployeeDocumentType, PayBasis, prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  fileExtensionFromName,
  fileStreamFromRelative,
  safeRelativeForEmployee,
  writeBufferToRelative
} from "../lib/employee-files.js";
import { canViewFullEmployeePii, redactEmployeeSnapshot, toDetailPayload, toListEmployee } from "../lib/employee-privacy.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const MAX_DOC_BYTES = 20 * 1024 * 1024;

const SENSITIVE_KEYS = [
  "socialSecurityNumber",
  "nationalHealthInsuranceNumber",
  "inlandRevenueDepartmentNumber",
  "workPermitNumber",
  "profilePhotoPath",
  "notes"
] as const;

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.hr_admin, Role.payroll_admin] as const;

/** Public base URL of the employee-tracker app (no trailing slash). Used for share links only. */
function employeeTrackerPublicBase(): string {
  return (process.env.EMPLOYEE_TRACKER_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

function parsePayBasis(v: unknown): PayBasis | null {
  if (v === "daily" || v === "hourly" || v === "fixed") {
    return v;
  }
  return null;
}

function parsePaySchedule(v: unknown): "weekly" | "biweekly" | "monthly" | null {
  if (v === "weekly" || v === "biweekly" || v === "monthly") {
    return v;
  }
  return null;
}

function parseDocumentType(v: unknown): EmployeeDocumentType | null {
  const s = String(v ?? "");
  for (const t of Object.values(EmployeeDocumentType) as string[]) {
    if (t === s) {
      return t as EmployeeDocumentType;
    }
  }
  return null;
}

function parseOptionalDateInput(value: unknown): Date | null {
  if (value == null || value === "") {
    return null;
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function contentTypeForPath(p: string): string {
  const ext = p.toLowerCase();
  if (ext.endsWith(".png")) {
    return "image/png";
  }
  if (ext.endsWith(".jpg") || ext.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (ext.endsWith(".webp")) {
    return "image/webp";
  }
  if (ext.endsWith(".gif")) {
    return "image/gif";
  }
  if (ext.endsWith(".pdf")) {
    return "application/pdf";
  }
  return "application/octet-stream";
}

function bodyHasNonEmptySensitivePii(body: Record<string, unknown>): boolean {
  const keys = [
    "socialSecurityNumber",
    "nationalHealthInsuranceNumber",
    "inlandRevenueDepartmentNumber",
    "workPermitNumber"
  ];
  for (const k of keys) {
    if (body[k] !== undefined) {
      const t = String(body[k] ?? "").trim();
      if (t.length > 0) {
        return true;
      }
    }
  }
  return false;
}

function canDownloadDocumentByType(roles: Role[], t: EmployeeDocumentType): boolean {
  if (t === "NHI_CARD" || t === "WORK_PERMIT_CARD" || t === "ID_CARD") {
    return canViewFullEmployeePii(roles);
  }
  return true;
}

export const peopleRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/templates", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const items = await prisma.deductionTemplate.findMany({ orderBy: { name: "asc" } });
    return c.json({ items });
  })
  .get("/templates/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const template = await prisma.deductionTemplate.findUnique({ where: { id } });
    if (!template) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ template });
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
    const q = (c.req.query("q") ?? "").trim();
    const items = await prisma.employee.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { role: { contains: q } },
              { defaultSite: { contains: q } },
              { phone: { contains: q } },
              { linkedUser: { email: { contains: q } } }
            ]
          }
        : undefined,
      include: { template: true, linkedUser: { select: { email: true, status: true } } },
      orderBy: { fullName: "asc" }
    });
    return c.json({ items: items.map((e) => toListEmployee(e)) });
  })
  .get("/employees/:id/tracker-share", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const base = employeeTrackerPublicBase();
    const loginUrl = `${base}/login`;
    const appHomeUrl = `${base}/`;
    const linked = await prisma.user.findFirst({
      where: { employeeId: id },
      select: { email: true, status: true }
    });
    return c.json({
      employeeId: id,
      loginUrl,
      appHomeUrl,
      linkedUser: linked
        ? {
            email: linked.email,
            status: linked.status
          }
        : null
    });
  })
  .get("/employees/:id/documents", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const docs = await prisma.employeeDocument.findMany({
      where: { employeeId: id, deletedAt: null }
    });
    return c.json({ items: docs });
  })
  .post("/employees/:id/documents", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.parseBody();
    const tRaw = body["type"] ?? body["documentType"];
    const file = body["file"] ?? body["upload"];
    const docType = parseDocumentType(tRaw);
    if (!docType) {
      return c.json({ error: "type is required (PHOTO, WORK_PERMIT_CARD, NHI_CARD, ID_CARD, CONTRACT, OTHER)" }, 400);
    }
    if (typeof file === "string" || !(file instanceof File)) {
      return c.json({ error: "file (multipart) is required" }, 400);
    }
    if (file.size > MAX_DOC_BYTES) {
      return c.json({ error: "File too large (max 20MB)" }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = fileExtensionFromName(file.name) || ".bin";
    const relative = `doc-${randomUUID()}${ext}`;
    const sub = safeRelativeForEmployee(employee.id, relative);
    const { relative: relPath } = writeBufferToRelative(sub, buf);
    const userId = c.get("userId");
    const created = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        type: docType,
        fileName: file.name || "upload",
        mimeType: file.type || contentTypeForPath(file.name),
        sizeBytes: buf.length,
        storagePath: relPath,
        uploadedByUserId: userId
      }
    });
    if (docType === "PHOTO") {
      await prisma.employee.update({
        where: { id: employee.id },
        data: { profilePhotoPath: relPath }
      });
    }
    await writeAudit({
      actorUserId: userId,
      action: "employee.document.upload",
      entityType: "EmployeeDocument",
      entityId: created.id,
      metadata: {
        employeeId: employee.id,
        documentId: created.id,
        type: created.type,
        fileName: created.fileName,
        sizeBytes: created.sizeBytes
      }
    });
    return c.json({ document: { ...created, downloadUrl: `/people/employees/${id}/documents/${created.id}/file` } }, 201);
  })
  .get("/employees/:id/documents/:docId/file", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const eid = c.req.param("id");
    const docId = c.req.param("docId");
    const doc = await prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: eid, deletedAt: null }
    });
    if (!doc) {
      return c.json({ error: "Not found" }, 404);
    }
    const roles = c.get("roles");
    if (!canDownloadDocumentByType(roles, doc.type)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const stream = fileStreamFromRelative(doc.storagePath);
    return new Response(stream as never, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || contentTypeForPath(doc.fileName),
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`
      }
    });
  })
  .get("/employees/:id/profile-photo", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const eid = c.req.param("id");
    const employee = await prisma.employee.findUnique({ where: { id: eid }, select: { profilePhotoPath: true } });
    if (!employee?.profilePhotoPath) {
      return c.json({ error: "No profile photo" }, 404);
    }
    const stream = fileStreamFromRelative(employee.profilePhotoPath);
    const ct = contentTypeForPath(employee.profilePhotoPath);
    return new Response(stream as never, { status: 200, headers: { "Content-Type": ct, "Cache-Control": "private, max-age=3600" } });
  })
  .delete("/employees/:id/documents/:docId", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const eid = c.req.param("id");
    const docId = c.req.param("docId");
    const doc = await prisma.employeeDocument.findFirst({ where: { id: docId, employeeId: eid, deletedAt: null } });
    if (!doc) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.employeeDocument.update({
      where: { id: docId },
      data: { deletedAt: new Date() }
    });
    if (doc.type === "PHOTO") {
      const emp = await prisma.employee.findUnique({ where: { id: eid }, select: { profilePhotoPath: true } });
      if (emp?.profilePhotoPath === doc.storagePath) {
        await prisma.employee.update({ where: { id: eid }, data: { profilePhotoPath: null } });
      }
    }
    const userId = c.get("userId");
    await writeAudit({
      actorUserId: userId,
      action: "employee.document.soft_delete",
      entityType: "EmployeeDocument",
      entityId: docId,
      metadata: { employeeId: eid, documentId: docId, type: doc.type }
    });
    return c.body(null, 204);
  })
  .get("/employees/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.employee.findUnique({
      where: { id },
      include: {
        template: true,
        documents: { where: { deletedAt: null } },
        linkedUser: { select: { email: true, status: true } }
      }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const roles = c.get("roles");
    return c.json({ employee: toDetailPayload(row, roles) });
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
    const roles = c.get("roles");
    if (bodyHasNonEmptySensitivePii(body) && !canViewFullEmployeePii(roles)) {
      return c.json({ error: "Storing SSN, NHI, IRD, or work permit number requires platform owner, hr_admin, or payroll_admin." }, 403);
    }
    const tpl = await prisma.deductionTemplate.findUnique({ where: { id: templateId } });
    if (!tpl) {
      return c.json({ error: "templateId not found" }, 400);
    }
    const basis = parsePayBasis(body.basePayType);
    if (!basis) {
      return c.json({ error: "basePayType must be daily, hourly, or fixed" }, 400);
    }
    const paySchedule = parsePaySchedule(body.paySchedule) ?? "monthly";
    const row = await prisma.employee.create({
      data: {
        fullName,
        role: String(body.role ?? ""),
        defaultSite: String(body.defaultSite ?? ""),
        phone: String(body.phone ?? ""),
        socialSecurityNumber: String(body.socialSecurityNumber ?? ""),
        nationalHealthInsuranceNumber: String(body.nationalHealthInsuranceNumber ?? ""),
        inlandRevenueDepartmentNumber: String(body.inlandRevenueDepartmentNumber ?? ""),
        employmentStartDate: parseOptionalDateInput(body.employmentStartDate),
        employmentEndDate: parseOptionalDateInput(body.employmentEndDate),
        workPermitNumber: String(body.workPermitNumber ?? ""),
        workPermitExpiryDate: parseOptionalDateInput(body.workPermitExpiryDate),
        basePayType: basis,
        dailyRate: Number(body.dailyRate ?? 0),
        hourlyRate: Number(body.hourlyRate ?? 0),
        overtimeRate: Number(body.overtimeRate ?? 0),
        fixedPay: Number(body.fixedPay ?? 0),
        standardDays: Number(body.standardDays ?? 0),
        standardHours: Number(body.standardHours ?? 0),
        paySchedule,
        active: body.active !== undefined ? Boolean(body.active) : true,
        notes: String(body.notes ?? ""),
        templateId
      },
      include: { template: true, documents: true, linkedUser: { select: { email: true, status: true } } }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.create",
      entityType: "Employee",
      entityId: row.id,
      after: redactEmployeeSnapshot(row as unknown as Record<string, unknown>)
    });
    return c.json({ employee: toDetailPayload(row, roles) }, 201);
  })
  .patch("/employees/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const roles = c.get("roles");
    if (bodyHasNonEmptySensitivePii(body) && !canViewFullEmployeePii(roles)) {
      return c.json({ error: "Updating SSN, NHI, IRD, or work permit number requires platform owner, hr_admin, or payroll_admin." }, 403);
    }
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
    if (body.paySchedule !== undefined) {
      const paySchedule = parsePaySchedule(body.paySchedule);
      if (!paySchedule) {
        return c.json({ error: "paySchedule must be weekly, biweekly, or monthly" }, 400);
      }
      data.paySchedule = paySchedule;
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
    if (body.socialSecurityNumber !== undefined) {
      data.socialSecurityNumber = String(body.socialSecurityNumber);
    }
    if (body.nationalHealthInsuranceNumber !== undefined) {
      data.nationalHealthInsuranceNumber = String(body.nationalHealthInsuranceNumber);
    }
    if (body.inlandRevenueDepartmentNumber !== undefined) {
      data.inlandRevenueDepartmentNumber = String(body.inlandRevenueDepartmentNumber);
    }
    if (body.workPermitNumber !== undefined) {
      data.workPermitNumber = String(body.workPermitNumber);
    }
    if (body.employmentStartDate !== undefined) {
      data.employmentStartDate = parseOptionalDateInput(body.employmentStartDate);
    }
    if (body.employmentEndDate !== undefined) {
      data.employmentEndDate = parseOptionalDateInput(body.employmentEndDate);
    }
    if (body.workPermitExpiryDate !== undefined) {
      data.workPermitExpiryDate = parseOptionalDateInput(body.workPermitExpiryDate);
    }
    if (body.profilePhotoPath !== undefined) {
      const v = body.profilePhotoPath;
      data.profilePhotoPath = v === null ? null : String(v) === "" ? null : String(v);
    }
    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const row = await prisma.employee.update({
      where: { id },
      data: data as never,
      include: { template: true, documents: { where: { deletedAt: null } }, linkedUser: { select: { email: true, status: true } } }
    });
    const meta: Record<string, unknown> = { fields: Object.keys(data) };
    const sk = SENSITIVE_KEYS as readonly string[];
    if (Object.keys(data).some((k) => sk.includes(k))) {
      meta.sensitiveFieldNames = Object.keys(data).filter((k) => sk.includes(k));
    }
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.update",
      entityType: "Employee",
      entityId: id,
      before: redactEmployeeSnapshot(before as unknown as Record<string, unknown>),
      after: redactEmployeeSnapshot(row as unknown as Record<string, unknown>),
      metadata: meta
    });
    return c.json({ employee: toDetailPayload(row, roles) });
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
      before: redactEmployeeSnapshot(before as unknown as Record<string, unknown>)
    });
    return c.body(null, 204);
  });
