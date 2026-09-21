import { randomUUID } from "node:crypto";
import { requireOrgId, EmployeeDocumentType, PayBasis, prisma, Role, UserStatus, WorkAuthorizationStatus } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { documentStorage, safeDocumentKeyForEmployee } from "../lib/document-storage.js";
import { canViewFullEmployeePii, redactEmployeeSnapshot, toDetailPayload, toListEmployee } from "../lib/employee-privacy.js";
import { minimumWageWarning } from "../lib/min-wage.js";
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

const SEES_ALL_STAFF = [Role.platform_owner, Role.hr_admin, Role.payroll_admin, Role.finance_admin] as const;

/**
 * Batch 19: operations/site managers see only authorized staff — their direct
 * reports plus themselves. Returns null when the caller is unrestricted; an
 * empty set fails closed (manager login with no linked employee record).
 */
async function managerScopeIds(c: { get(key: "roles"): Role[]; get(key: "userId"): string }): Promise<Set<string> | null> {
  const roles = c.get("roles");
  if (roles.some((r) => (SEES_ALL_STAFF as readonly Role[]).includes(r))) return null;
  if (!roles.includes(Role.operations_manager) && !roles.includes(Role.site_supervisor)) return null;
  const user = await prisma.user.findUnique({ where: { id: c.get("userId") }, select: { employeeId: true } });
  if (!user?.employeeId) return new Set<string>();
  const reports = await prisma.employee.findMany({
    where: { OR: [{ managerId: user.employeeId }, { id: user.employeeId }] },
    select: { id: true }
  });
  return new Set(reports.map((r) => r.id));
}

/** Validate Batch 19 assignment FKs from a create/update body (org-scoped). */
async function assignmentData(body: Record<string, unknown>): Promise<{ data: Record<string, unknown>; error?: string }> {
  const data: Record<string, unknown> = {};
  const fields = [
    ["departmentId", "department", "Department"],
    ["positionId", "position", "Position"],
    ["costCentreId", "costCentre", "Cost centre"],
    ["locationId", "location", "Location"],
    ["workScheduleId", "workSchedule", "Work schedule"],
    ["managerId", "employee", "Manager"]
  ] as const;
  for (const [field, model, label] of fields) {
    const raw = body[field];
    if (raw === undefined) continue;
    if (raw === null || raw === "") {
      data[field] = null;
      continue;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = await (prisma as any)[model].findFirst({ where: { id: String(raw) }, select: { id: true } });
    if (!found) return { data, error: `${label} not found in this organization.` };
    data[field] = String(raw);
  }
  return { data };
}

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

function parseWorkAuthorizationStatus(v: unknown): WorkAuthorizationStatus | null {
  const value = String(v ?? "");
  return Object.values(WorkAuthorizationStatus).includes(value as WorkAuthorizationStatus)
    ? (value as WorkAuthorizationStatus)
    : null;
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

function parseOptionalDateField(value: unknown): { valid: boolean; value: Date | null } {
  if (value == null || value === "") {
    return { valid: true, value: null };
  }
  const parsed = parseOptionalDateInput(value);
  return { valid: parsed !== null, value: parsed };
}

function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const EMPLOYEE_NUMBER_FIELDS = [
  "dailyRate",
  "hourlyRate",
  "overtimeRate",
  "fixedPay",
  "standardDays",
  "standardHours"
] as const;

type SupportedUpload = { extension: string; contentType: string };

function supportedUpload(fileName: string): SupportedUpload | null {
  const lower = fileName.trim().toLowerCase();
  if (lower.endsWith(".pdf")) return { extension: ".pdf", contentType: "application/pdf" };
  if (lower.endsWith(".png")) return { extension: ".png", contentType: "image/png" };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return { extension: lower.endsWith(".jpeg") ? ".jpeg" : ".jpg", contentType: "image/jpeg" };
  }
  if (lower.endsWith(".webp")) return { extension: ".webp", contentType: "image/webp" };
  return null;
}

function hasExpectedFileSignature(buffer: Buffer, contentType: string): boolean {
  if (contentType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (contentType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function parseEmployeeEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
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
        orgId: requireOrgId(),
        name,
        nhiRate: Number(body.nhiRate ?? 0),
        ssbRate: Number(body.ssbRate ?? 0),
        incomeTaxRate: 0,
        applyNhi: Boolean(body.applyNhi ?? true),
        applySsb: Boolean(body.applySsb ?? true),
        applyIncomeTax: false
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
      data.incomeTaxRate = 0;
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
    const status = c.req.query("status") === "archived" ? "archived" : "current";
    const scope = await managerScopeIds(c);
    const items = await prisma.employee.findMany({
      where: {
        active: status === "current",
        ...(scope ? { id: { in: [...scope] } } : {}),
        ...(q
          ? {
            OR: [
              { fullName: { contains: q } },
              { role: { contains: q } },
              { defaultSite: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q, mode: "insensitive" } },
              { linkedUser: { email: { contains: q } } }
            ]
          }
          : {})
      },
      include: { template: true, linkedUser: { select: { email: true, status: true } } },
      orderBy: { fullName: "asc" }
    });
    return c.json({ items: items.map((e) => toListEmployee(e)) });
  })
  .get("/employees/:id/tracker-share", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const shareScope = await managerScopeIds(c);
    if (shareScope && !shareScope.has(id)) {
      return c.json({ error: "Not found" }, 404);
    }
    const row = await prisma.employee.findUnique({ where: { id }, select: { id: true, phone: true } });
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
      phone: row.phone || null,
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
    const docsScope = await managerScopeIds(c);
    if (docsScope && !docsScope.has(id)) {
      return c.json({ error: "Not found" }, 404);
    }
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
    const upload = supportedUpload(file.name);
    if (!upload || (docType === EmployeeDocumentType.PHOTO && !upload.contentType.startsWith("image/"))) {
      return c.json({ error: "Upload a PDF, PNG, JPG, or WebP file. Profile photos must be an image." }, 400);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedFileSignature(buf, upload.contentType)) {
      return c.json({ error: "The file contents do not match the selected file type." }, 400);
    }
    const relative = `doc-${randomUUID()}${upload.extension}`;
    const relPath = `${requireOrgId()}/${safeDocumentKeyForEmployee(employee.id, relative)}`;
    const previousPhotoDocuments = docType === EmployeeDocumentType.PHOTO
      ? await prisma.employeeDocument.findMany({
          where: { employeeId: employee.id, type: EmployeeDocumentType.PHOTO, deletedAt: null },
          select: { id: true, storagePath: true }
        })
      : [];
    await documentStorage.putObject({
      key: relPath,
      body: buf,
      contentType: upload.contentType
    });
    const userId = c.get("userId");
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        if (docType === EmployeeDocumentType.PHOTO && previousPhotoDocuments.length > 0) {
          await tx.employeeDocument.updateMany({
            where: { id: { in: previousPhotoDocuments.map((document) => document.id) } },
            data: { deletedAt: new Date() }
          });
        }
        const nextDocument = await tx.employeeDocument.create({
          data: {
            orgId: requireOrgId(),
            employeeId: employee.id,
            type: docType,
            fileName: file.name || "upload",
            mimeType: upload.contentType,
            sizeBytes: buf.length,
            storagePath: relPath,
            uploadedByUserId: userId
          }
        });
        if (docType === EmployeeDocumentType.PHOTO) {
          await tx.employee.update({
            where: { id: employee.id },
            data: { profilePhotoPath: relPath }
          });
        }
        return nextDocument;
      });
    } catch (cause) {
      await documentStorage.deleteObject(relPath).catch(() => undefined);
      throw cause;
    }
    if (docType === EmployeeDocumentType.PHOTO) {
      const replacedKeys = new Set(
        [...previousPhotoDocuments.map((document) => document.storagePath), employee.profilePhotoPath]
          .filter((key): key is string => Boolean(key) && key !== relPath)
      );
      await Promise.allSettled([...replacedKeys].map((key) => documentStorage.deleteObject(key)));
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
        sizeBytes: created.sizeBytes,
        replacedPhotoCount: previousPhotoDocuments.length
      }
    });
    return c.json({ document: { ...created, downloadUrl: `/people/employees/${id}/documents/${created.id}/file` } }, 201);
  })
  .get("/employees/:id/documents/:docId/file", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const eid = c.req.param("id");
    const docId = c.req.param("docId");
    const fileScope = await managerScopeIds(c);
    if (fileScope && !fileScope.has(eid)) {
      return c.json({ error: "Not found" }, 404);
    }
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
    // Private storage: hand out a short-lived presigned URL when the provider
    // supports it (S3/R2); otherwise stream through this authenticated route.
    const signed = await documentStorage.getSignedUrl(doc.storagePath).catch(() => null);
    if (signed) {
      return c.redirect(signed, 302);
    }
    const stored = await documentStorage.getObject(doc.storagePath);
    return new Response(stored.body as never, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || contentTypeForPath(doc.fileName),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
      }
    });
  })
  .get("/employees/:id/profile-photo", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const eid = c.req.param("id");
    const photoScope = await managerScopeIds(c);
    if (photoScope && !photoScope.has(eid)) {
      return c.json({ error: "Not found" }, 404);
    }
    const employee = await prisma.employee.findUnique({ where: { id: eid }, select: { profilePhotoPath: true } });
    if (!employee?.profilePhotoPath) {
      return c.json({ error: "No profile photo" }, 404);
    }
    const signed = await documentStorage.getSignedUrl(employee.profilePhotoPath).catch(() => null);
    if (signed) {
      return c.redirect(signed, 302);
    }
    const stored = await documentStorage.getObject(employee.profilePhotoPath);
    const ct = contentTypeForPath(employee.profilePhotoPath);
    return new Response(stored.body as never, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
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
    const scope = await managerScopeIds(c);
    if (scope && !scope.has(id)) {
      return c.json({ error: "Not found" }, 404);
    }
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
    return c.json({
      employee: toDetailPayload(row, roles),
      minimumWageWarning: minimumWageWarning({
        basePayType: row.basePayType,
        hourlyRate: row.hourlyRate,
        dailyRate: row.dailyRate,
        fixedPay: row.fixedPay,
        paySchedule: row.paySchedule
      })
    });
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
    const email = parseEmployeeEmail(body.email);
    if (!email) {
      return c.json({ error: "Employee email is required and must be valid." }, 400);
    }
    const workAuthorizationStatus =
      parseWorkAuthorizationStatus(body.workAuthorizationStatus) ?? WorkAuthorizationStatus.NOT_SPECIFIED;
    const employmentStartDate = parseOptionalDateField(body.employmentStartDate);
    const employmentEndDate = parseOptionalDateField(body.employmentEndDate);
    const workPermitExpiryDate = parseOptionalDateField(body.workPermitExpiryDate);
    if (!employmentStartDate.valid || !employmentEndDate.valid || !workPermitExpiryDate.valid) {
      return c.json({ error: "Employment and work permit dates must be valid dates." }, 400);
    }
    if (employmentStartDate.value && employmentEndDate.value && employmentEndDate.value < employmentStartDate.value) {
      return c.json({ error: "Employment end date cannot be before the start date." }, 400);
    }
    const workPermitNumber = String(body.workPermitNumber ?? "").trim();
    if (workAuthorizationStatus === WorkAuthorizationStatus.WORK_PERMIT && (!workPermitNumber || !workPermitExpiryDate.value)) {
      return c.json({ error: "Work permit number and expiry date are required for work-permit employees." }, 400);
    }
    const numericValues: Record<(typeof EMPLOYEE_NUMBER_FIELDS)[number], number> = {} as never;
    for (const field of EMPLOYEE_NUMBER_FIELDS) {
      const value = parseNonNegativeNumber(body[field] ?? 0);
      if (value === null) {
        return c.json({ error: `${field} must be a non-negative number.` }, 400);
      }
      numericValues[field] = value;
    }
    const createAssignment = await assignmentData(body);
    if (createAssignment.error) {
      return c.json({ error: createAssignment.error }, 400);
    }
    const requestedActive = body.active !== undefined ? Boolean(body.active) : true;
    const row = await prisma.employee.create({
      data: {
        orgId: requireOrgId(),
        fullName,
        sex: body.sex === "M" || body.sex === "F" ? String(body.sex) : "",
        role: String(body.role ?? ""),
        defaultSite: String(body.defaultSite ?? ""),
        phone: String(body.phone ?? ""),
        email,
        socialSecurityNumber: String(body.socialSecurityNumber ?? ""),
        nationalHealthInsuranceNumber: String(body.nationalHealthInsuranceNumber ?? ""),
        nhiUnemployedSpouse: Boolean(body.nhiUnemployedSpouse),
        inlandRevenueDepartmentNumber: String(body.inlandRevenueDepartmentNumber ?? ""),
        employmentStartDate: employmentStartDate.value,
        employmentEndDate: employmentEndDate.value,
        workAuthorizationStatus,
        workPermitNumber:
          workAuthorizationStatus === WorkAuthorizationStatus.WORK_PERMIT
            ? workPermitNumber
            : "",
        workPermitExpiryDate:
          workAuthorizationStatus === WorkAuthorizationStatus.WORK_PERMIT
            ? workPermitExpiryDate.value
            : null,
        basePayType: basis,
        dailyRate: numericValues.dailyRate,
        hourlyRate: numericValues.hourlyRate,
        overtimeRate: numericValues.overtimeRate,
        fixedPay: numericValues.fixedPay,
        standardDays: numericValues.standardDays,
        standardHours: numericValues.standardHours,
        paySchedule,
        active: employmentEndDate.value ? false : requestedActive,
        payrollTaxExemptionEnabled:
          body.payrollTaxExemptionEnabled === undefined ? true : Boolean(body.payrollTaxExemptionEnabled),
        notes: String(body.notes ?? ""),
        templateId,
        ...createAssignment.data
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
    return c.json({
      employee: toDetailPayload(row, roles),
      minimumWageWarning: minimumWageWarning({
        basePayType: row.basePayType,
        hourlyRate: row.hourlyRate,
        dailyRate: row.dailyRate,
        fixedPay: row.fixedPay,
        paySchedule: row.paySchedule
      })
    }, 201);
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
    if (body.sex !== undefined) {
      const sex = String(body.sex);
      if (sex !== "" && sex !== "M" && sex !== "F") {
        return c.json({ error: "sex must be M, F, or blank" }, 400);
      }
      data.sex = sex;
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
    if (body.email !== undefined) {
      const email = parseEmployeeEmail(body.email);
      if (!email) {
        return c.json({ error: "Employee email is required and must be valid." }, 400);
      }
      data.email = email;
    }
    if (body.basePayType !== undefined) {
      const basis = parsePayBasis(body.basePayType);
      if (!basis) {
        return c.json({ error: "basePayType must be daily, hourly, or fixed" }, 400);
      }
      data.basePayType = basis;
    }
    for (const field of EMPLOYEE_NUMBER_FIELDS) {
      if (body[field] !== undefined) {
        const value = parseNonNegativeNumber(body[field]);
        if (value === null) {
          return c.json({ error: `${field} must be a non-negative number.` }, 400);
        }
        data[field] = value;
      }
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
    if (body.payrollTaxExemptionEnabled !== undefined) {
      data.payrollTaxExemptionEnabled = Boolean(body.payrollTaxExemptionEnabled);
    }
    if (body.nhiUnemployedSpouse !== undefined) {
      data.nhiUnemployedSpouse = Boolean(body.nhiUnemployedSpouse);
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
    const assignment = await assignmentData(body);
    if (assignment.error) {
      return c.json({ error: assignment.error }, 400);
    }
    if (assignment.data.managerId === id) {
      return c.json({ error: "An employee cannot be their own manager." }, 400);
    }
    Object.assign(data, assignment.data);
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
    if (body.workAuthorizationStatus !== undefined) {
      const status = parseWorkAuthorizationStatus(body.workAuthorizationStatus);
      if (!status) {
        return c.json(
          { error: "workAuthorizationStatus must be NOT_SPECIFIED, WORK_PERMIT, BELONGER, RESIDENT, or BV_ISLANDER" },
          400
        );
      }
      data.workAuthorizationStatus = status;
    }
    if (body.employmentStartDate !== undefined) {
      const parsed = parseOptionalDateField(body.employmentStartDate);
      if (!parsed.valid) return c.json({ error: "Invalid employment start date." }, 400);
      data.employmentStartDate = parsed.value;
    }
    if (body.employmentEndDate !== undefined) {
      const parsed = parseOptionalDateField(body.employmentEndDate);
      if (!parsed.valid) return c.json({ error: "Invalid employment end date." }, 400);
      data.employmentEndDate = parsed.value;
      if (parsed.value) data.active = false;
    }
    if (body.workPermitExpiryDate !== undefined) {
      const parsed = parseOptionalDateField(body.workPermitExpiryDate);
      if (!parsed.valid) return c.json({ error: "Invalid work permit expiry date." }, 400);
      data.workPermitExpiryDate = parsed.value;
    }
    if (
      data.workAuthorizationStatus !== undefined &&
      data.workAuthorizationStatus !== WorkAuthorizationStatus.WORK_PERMIT
    ) {
      data.workPermitNumber = "";
      data.workPermitExpiryDate = null;
    }
    if (body.profilePhotoPath !== undefined) {
      const v = body.profilePhotoPath;
      data.profilePhotoPath = v === null ? null : String(v) === "" ? null : String(v);
    }
    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const nextStart = data.employmentStartDate !== undefined
      ? (data.employmentStartDate as Date | null)
      : before.employmentStartDate;
    const nextEnd = data.employmentEndDate !== undefined
      ? (data.employmentEndDate as Date | null)
      : before.employmentEndDate;
    if (nextStart && nextEnd && nextEnd < nextStart) {
      return c.json({ error: "Employment end date cannot be before the start date." }, 400);
    }
    const nextAuthorization = (data.workAuthorizationStatus as WorkAuthorizationStatus | undefined) ?? before.workAuthorizationStatus;
    const nextPermitNumber = String(data.workPermitNumber ?? before.workPermitNumber).trim();
    const nextPermitExpiry = data.workPermitExpiryDate !== undefined
      ? (data.workPermitExpiryDate as Date | null)
      : before.workPermitExpiryDate;
    if (nextAuthorization === WorkAuthorizationStatus.WORK_PERMIT && (!nextPermitNumber || !nextPermitExpiry)) {
      return c.json({ error: "Work permit number and expiry date are required for work-permit employees." }, 400);
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
    return c.json({
      employee: toDetailPayload(row, roles),
      minimumWageWarning: minimumWageWarning({
        basePayType: row.basePayType,
        hourlyRate: row.hourlyRate,
        dailyRate: row.dailyRate,
        fixedPay: row.fixedPay,
        paySchedule: row.paySchedule
      })
    });
  })
  .post("/employees/:id/archive", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.employee.findUnique({
      where: { id },
      include: { linkedUser: { select: { id: true, status: true } } }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }

    const suspendTrackerAccess =
      before.linkedUser?.status === UserStatus.active || before.linkedUser?.status === UserStatus.invited;
    const row = await prisma.$transaction(async (tx) => {
      const archived = await tx.employee.update({
        where: { id },
        data: {
          active: false,
          employmentEndDate: before.employmentEndDate ?? new Date()
        },
        include: { template: true, linkedUser: { select: { email: true, status: true } } }
      });
      if (suspendTrackerAccess && before.linkedUser) {
        await tx.user.update({
          where: { id: before.linkedUser.id },
          data: { status: UserStatus.suspended, tokenVersion: { increment: 1 } }
        });
      }
      return archived;
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.archive",
      entityType: "Employee",
      entityId: id,
      before: redactEmployeeSnapshot(before as unknown as Record<string, unknown>),
      after: redactEmployeeSnapshot(row as unknown as Record<string, unknown>),
      metadata: { trackerAccessSuspended: suspendTrackerAccess }
    });
    return c.json({ employee: toListEmployee(row), trackerAccessSuspended: suspendTrackerAccess });
  })
  .post("/employees/:id/restore", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const row = await prisma.employee.update({
      where: { id },
      data: { active: true, employmentEndDate: null },
      include: { template: true, linkedUser: { select: { email: true, status: true } } }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "employee.restore",
      entityType: "Employee",
      entityId: id,
      before: redactEmployeeSnapshot(before as unknown as Record<string, unknown>),
      after: redactEmployeeSnapshot(row as unknown as Record<string, unknown>),
      metadata: { trackerAccessRestored: false }
    });
    return c.json({ employee: toListEmployee(row), trackerAccessRestored: false });
  })
  .delete("/employees/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const exists = await prisma.employee.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(
      {
        error:
          "Employee records are retained for payroll and audit history. Set an employment end date and mark the employee inactive instead."
      },
      409
    );
  });
