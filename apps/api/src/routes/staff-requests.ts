import { prisma, Role, StaffRequestStatus, StaffRequestType, type Prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const SELF_ROLES = [Role.employee_tracker_user] as const;

/**
 * Roles allowed to view and review staff requests in the admin queue.
 * Mirrors the broader manager group used by the time approvals queue so
 * site supervisors and operations managers can act on time off / supplies
 * requests without requiring HR-level access.
 */
const REVIEW_ROLES = [
  Role.platform_owner,
  Role.hr_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

/**
 * Payroll admin gets read access to time-off and sick-leave requests so
 * payroll can plan around approved leave; they cannot review/approve.
 */
const PAYROLL_VIEW_ROLES = [Role.payroll_admin] as const;

const ALL_REVIEW_OR_VIEW_ROLES = [...REVIEW_ROLES, ...PAYROLL_VIEW_ROLES] as const;

const REQUEST_TYPES: readonly StaffRequestType[] = [
  StaffRequestType.JOB_LETTER,
  StaffRequestType.TIME_OFF,
  StaffRequestType.SICK_LEAVE,
  StaffRequestType.PROFILE_UPDATE,
  StaffRequestType.SUPPLIES_REQUEST,
  StaffRequestType.EQUIPMENT_UNIFORM_REQUEST,
  StaffRequestType.INCIDENT_REPORT,
  StaffRequestType.DAMAGE_REPORT
];

const REQUEST_STATUSES: readonly StaffRequestStatus[] = [
  StaffRequestStatus.SUBMITTED,
  StaffRequestStatus.UNDER_REVIEW,
  StaffRequestStatus.APPROVED,
  StaffRequestStatus.DENIED,
  StaffRequestStatus.COMPLETED,
  StaffRequestStatus.CANCELLED
];

const ACTIVE_STATUSES = [StaffRequestStatus.SUBMITTED, StaffRequestStatus.UNDER_REVIEW] as const;
const CLOSED_STATUSES = [
  StaffRequestStatus.APPROVED,
  StaffRequestStatus.DENIED,
  StaffRequestStatus.COMPLETED,
  StaffRequestStatus.CANCELLED
] as const;

/**
 * Allowed contact-update keys. Sensitive HR fields (SSN, NHI, IRD, work
 * permit, pay rates) are intentionally excluded — those changes go through
 * HR admin paths, not the self-service request form.
 */
const ALLOWED_CONTACT_KEYS = new Set<string>([
  "phone",
  "personalEmail",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelationship",
  "uniformSize"
]);

const TYPES_VIEWABLE_BY_PAYROLL = new Set<StaffRequestType>([
  StaffRequestType.TIME_OFF,
  StaffRequestType.SICK_LEAVE
]);

function isStaffRequestType(v: unknown): v is StaffRequestType {
  return typeof v === "string" && (REQUEST_TYPES as readonly string[]).includes(v);
}

function isStaffRequestStatus(v: unknown): v is StaffRequestStatus {
  return typeof v === "string" && (REQUEST_STATUSES as readonly string[]).includes(v);
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

function trimOrNull(value: unknown, max = 2000): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  return text.length > max ? text.slice(0, max) : text;
}

function sanitizeContactUpdate(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!ALLOWED_CONTACT_KEYS.has(k)) {
      continue;
    }
    if (v === undefined || v === null) {
      continue;
    }
    const text = String(v).trim();
    if (!text) {
      continue;
    }
    out[k] = text.length > 200 ? text.slice(0, 200) : text;
  }
  return Object.keys(out).length > 0 ? out : null;
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

type StaffRequestForResponse = {
  id: string;
  employeeId: string;
  type: StaffRequestType;
  status: StaffRequestStatus;
  subject: string | null;
  startDate: Date | null;
  endDate: Date | null;
  reason: string | null;
  details: string | null;
  requestedContactUpdate: Prisma.JsonValue | null;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee?: { id: string; fullName: string; defaultSite: string; role: string } | null;
  reviewedBy?: { id: string; name: string; email: string } | null;
};

function publicShape(row: StaffRequestForResponse) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    type: row.type,
    status: row.status,
    subject: row.subject,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    details: row.details,
    requestedContactUpdate: row.requestedContactUpdate,
    reviewNote: row.reviewNote,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    employee: row.employee ?? null,
    reviewedBy: row.reviewedBy ?? null
  };
}

const employeeSummarySelect = {
  id: true,
  fullName: true,
  defaultSite: true,
  role: true
} as const;

const reviewerSummarySelect = {
  id: true,
  name: true,
  email: true
} as const;

/**
 * Validate creation payload by request type. Each type has a slightly
 * different "expected" set of optional fields; we accept what makes sense
 * and ignore the rest.
 */
function buildCreateData(
  employeeId: string,
  body: Record<string, unknown>
): { data: Prisma.StaffRequestUncheckedCreateInput; error: string | null } {
  const type = body.type;
  if (!isStaffRequestType(type)) {
    return { data: {} as Prisma.StaffRequestUncheckedCreateInput, error: "Invalid request type" };
  }

  const subject = trimOrNull(body.subject, 200);
  const reason = trimOrNull(body.reason, 1000);
  const details = trimOrNull(body.details, 4000);
  const startDate = body.startDate !== undefined ? parseDateInput(body.startDate) : null;
  const endDate = body.endDate !== undefined ? parseDateInput(body.endDate) : null;

  if (body.startDate && !startDate) {
    return {
      data: {} as Prisma.StaffRequestUncheckedCreateInput,
      error: "Invalid startDate (expected YYYY-MM-DD)"
    };
  }
  if (body.endDate && !endDate) {
    return {
      data: {} as Prisma.StaffRequestUncheckedCreateInput,
      error: "Invalid endDate (expected YYYY-MM-DD)"
    };
  }
  if (startDate && endDate && startDate > endDate) {
    return {
      data: {} as Prisma.StaffRequestUncheckedCreateInput,
      error: "startDate must be on or before endDate"
    };
  }

  let requestedContactUpdate: Prisma.InputJsonValue | undefined;

  if (type === StaffRequestType.TIME_OFF || type === StaffRequestType.SICK_LEAVE) {
    if (!startDate || !endDate) {
      return {
        data: {} as Prisma.StaffRequestUncheckedCreateInput,
        error: "startDate and endDate are required for time off / sick leave"
      };
    }
  }

  if (type === StaffRequestType.JOB_LETTER) {
    if (!reason && !details) {
      return {
        data: {} as Prisma.StaffRequestUncheckedCreateInput,
        error: "Please describe the purpose of the job letter (reason or details)"
      };
    }
  }

  if (
    type === StaffRequestType.SUPPLIES_REQUEST ||
    type === StaffRequestType.EQUIPMENT_UNIFORM_REQUEST ||
    type === StaffRequestType.INCIDENT_REPORT ||
    type === StaffRequestType.DAMAGE_REPORT
  ) {
    if (!details) {
      return {
        data: {} as Prisma.StaffRequestUncheckedCreateInput,
        error: "Please describe the request in the details field"
      };
    }
  }

  if (type === StaffRequestType.PROFILE_UPDATE) {
    const sanitized = sanitizeContactUpdate(body.requestedContactUpdate);
    if (!sanitized) {
      return {
        data: {} as Prisma.StaffRequestUncheckedCreateInput,
        error:
          "PROFILE_UPDATE requires requestedContactUpdate with at least one allowed field (phone, address, emergency contact, uniform size, etc.)"
      };
    }
    requestedContactUpdate = sanitized as Prisma.InputJsonValue;
  }

  const data: Prisma.StaffRequestUncheckedCreateInput = {
    employeeId,
    type,
    status: StaffRequestStatus.SUBMITTED,
    subject,
    reason,
    details,
    startDate,
    endDate,
    ...(requestedContactUpdate !== undefined ? { requestedContactUpdate } : {})
  };

  return { data, error: null };
}

const STATUS_TRANSITIONS: Record<StaffRequestStatus, readonly StaffRequestStatus[]> = {
  [StaffRequestStatus.SUBMITTED]: [
    StaffRequestStatus.UNDER_REVIEW,
    StaffRequestStatus.APPROVED,
    StaffRequestStatus.DENIED,
    StaffRequestStatus.CANCELLED
  ],
  [StaffRequestStatus.UNDER_REVIEW]: [
    StaffRequestStatus.APPROVED,
    StaffRequestStatus.DENIED,
    StaffRequestStatus.COMPLETED,
    StaffRequestStatus.CANCELLED
  ],
  [StaffRequestStatus.APPROVED]: [StaffRequestStatus.COMPLETED, StaffRequestStatus.CANCELLED],
  [StaffRequestStatus.DENIED]: [],
  [StaffRequestStatus.COMPLETED]: [],
  [StaffRequestStatus.CANCELLED]: []
};

function canTransition(from: StaffRequestStatus, to: StaffRequestStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

export const staffRequestRoutes = new Hono<{ Variables: AuthVariables }>()
  /* ---------- Employee self-service ---------- */
  .get("/staff/self/requests", authRequired, requireRole(...SELF_ROLES), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const items = await prisma.staffRequest.findMany({
      where: { employeeId: eid },
      include: {
        employee: { select: employeeSummarySelect },
        reviewedBy: { select: reviewerSummarySelect }
      },
      orderBy: { createdAt: "desc" }
    });
    return c.json({ items: items.map(publicShape) });
  })
  .post("/staff/self/requests", authRequired, requireRole(...SELF_ROLES), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const body = await c.req.json<Record<string, unknown>>();
    const { data, error } = buildCreateData(eid, body);
    if (error) {
      return c.json({ error }, 400);
    }
    const row = await prisma.staffRequest.create({
      data,
      include: {
        employee: { select: employeeSummarySelect },
        reviewedBy: { select: reviewerSummarySelect }
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "staff_request.self_create",
      entityType: "StaffRequest",
      entityId: row.id,
      after: { id: row.id, employeeId: eid, type: row.type, status: row.status }
    });
    return c.json({ item: publicShape(row) }, 201);
  })
  .post("/staff/self/requests/:id/cancel", authRequired, requireRole(...SELF_ROLES), async (c) => {
    const eid = await resolveLinkedEmployeeId(c);
    if (eid instanceof Response) {
      return eid;
    }
    const id = c.req.param("id");
    const before = await prisma.staffRequest.findUnique({ where: { id } });
    if (!before || before.employeeId !== eid) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!(ACTIVE_STATUSES as readonly StaffRequestStatus[]).includes(before.status)) {
      return c.json({ error: "Only active requests can be cancelled" }, 400);
    }
    const row = await prisma.staffRequest.update({
      where: { id },
      data: {
        status: StaffRequestStatus.CANCELLED,
        cancelledAt: new Date()
      },
      include: {
        employee: { select: employeeSummarySelect },
        reviewedBy: { select: reviewerSummarySelect }
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "staff_request.self_cancel",
      entityType: "StaffRequest",
      entityId: id,
      before: { status: before.status },
      after: { status: row.status }
    });
    return c.json({ item: publicShape(row) });
  })
  /* ---------- Admin review queue ---------- */
  .get("/admin/staff-requests", authRequired, requireRole(...ALL_REVIEW_OR_VIEW_ROLES), async (c) => {
    const roles = c.get("roles");
    const isFullViewer = roles.some((r) => (REVIEW_ROLES as readonly Role[]).includes(r));

    const statusParam = c.req.query("status");
    const typeParam = c.req.query("type");
    const employeeIdParam = c.req.query("employeeId");

    const where: Prisma.StaffRequestWhereInput = {};
    if (statusParam) {
      const parts = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const validStatuses = parts.filter(isStaffRequestStatus);
      if (validStatuses.length > 0) {
        where.status = { in: validStatuses };
      }
    }
    let requestedTypes: StaffRequestType[] | null = null;
    if (typeParam) {
      const parts = typeParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const validTypes = parts.filter(isStaffRequestType);
      if (validTypes.length > 0) {
        requestedTypes = validTypes;
      }
    }
    if (employeeIdParam) {
      where.employeeId = employeeIdParam;
    }

    let effectiveTypes: StaffRequestType[] | null = requestedTypes;
    if (!isFullViewer) {
      const safe = Array.from(TYPES_VIEWABLE_BY_PAYROLL);
      effectiveTypes = effectiveTypes
        ? effectiveTypes.filter((t) => TYPES_VIEWABLE_BY_PAYROLL.has(t))
        : safe;
      if (effectiveTypes.length === 0) {
        return c.json({ items: [] });
      }
    }
    if (effectiveTypes && effectiveTypes.length > 0) {
      where.type = { in: effectiveTypes };
    }

    const items = await prisma.staffRequest.findMany({
      where,
      include: {
        employee: { select: employeeSummarySelect },
        reviewedBy: { select: reviewerSummarySelect }
      },
      orderBy: [{ createdAt: "desc" }],
      take: 500
    });

    return c.json({ items: items.map(publicShape) });
  })
  .get("/admin/staff-requests/:id", authRequired, requireRole(...ALL_REVIEW_OR_VIEW_ROLES), async (c) => {
    const roles = c.get("roles");
    const isFullViewer = roles.some((r) => (REVIEW_ROLES as readonly Role[]).includes(r));
    const id = c.req.param("id");
    const row = await prisma.staffRequest.findUnique({
      where: { id },
      include: {
        employee: { select: employeeSummarySelect },
        reviewedBy: { select: reviewerSummarySelect }
      }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!isFullViewer && !TYPES_VIEWABLE_BY_PAYROLL.has(row.type)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    return c.json({ item: publicShape(row) });
  })
  .patch(
    "/admin/staff-requests/:id/status",
    authRequired,
    requireRole(...REVIEW_ROLES),
    async (c) => {
      const id = c.req.param("id");
      const before = await prisma.staffRequest.findUnique({ where: { id } });
      if (!before) {
        return c.json({ error: "Not found" }, 404);
      }
      const body = await c.req.json<Record<string, unknown>>();
      const nextStatus = body.status;
      if (!isStaffRequestStatus(nextStatus)) {
        return c.json({ error: "Invalid status" }, 400);
      }
      if (nextStatus === before.status) {
        return c.json({ error: "Status is already " + nextStatus }, 400);
      }
      if (nextStatus === StaffRequestStatus.SUBMITTED) {
        return c.json({ error: "Cannot move a request back to SUBMITTED" }, 400);
      }
      if (!canTransition(before.status, nextStatus)) {
        return c.json(
          {
            error: `Cannot transition from ${before.status} to ${nextStatus}`
          },
          400
        );
      }

      const reviewNote = trimOrNull(body.reviewNote, 2000);
      const now = new Date();
      const data: Prisma.StaffRequestUncheckedUpdateInput = {
        status: nextStatus,
        reviewedByUserId: c.get("userId"),
        reviewedAt: now
      };
      if (reviewNote !== null) {
        data.reviewNote = reviewNote;
      }
      if (nextStatus === StaffRequestStatus.CANCELLED) {
        data.cancelledAt = now;
      }

      const row = await prisma.staffRequest.update({
        where: { id },
        data,
        include: {
          employee: { select: employeeSummarySelect },
          reviewedBy: { select: reviewerSummarySelect }
        }
      });
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "staff_request.review",
        entityType: "StaffRequest",
        entityId: id,
        before: { status: before.status, reviewNote: before.reviewNote },
        after: { status: row.status, reviewNote: row.reviewNote }
      });
      return c.json({ item: publicShape(row) });
    }
  );
