import { requireOrgId, PaySchedule, Role, prisma } from "@kleentoditee/db";
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

const CAN_EDIT = [Role.platform_owner, Role.hr_admin, Role.payroll_admin, Role.finance_admin] as const;

async function loadOrgSettings() {
  return prisma.orgSettings.upsert({
    where: { orgId: requireOrgId() },
    create: { orgId: requireOrgId() },
    update: {}
  });
}

function parseSchedule(v: unknown): PaySchedule | null {
  if (v === "weekly" || v === "biweekly" || v === "monthly") {
    return v;
  }
  return null;
}

/** Finite number >= 0, or null when the value is invalid. */
function parseNonNegativeNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

export const settingsRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/org", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const org = await loadOrgSettings();
    const version = await prisma.statutoryRateVersion.findFirst({
      where: { effectiveYear: org.statutoryEffectiveYear },
      orderBy: { updatedAt: "desc" }
    });
    const statutoryVerification = {
      effectiveYear: org.statutoryEffectiveYear,
      hasVersion: Boolean(version),
      verified: Boolean(version?.sourceUrl && version.verifiedAt),
      approved: Boolean(version?.approvedAt),
      sourceUrl: version?.sourceUrl ?? "",
      verifiedAt: version?.verifiedAt ?? null,
      verifiedBy: version?.verifiedBy ?? "",
      approvedAt: version?.approvedAt ?? null,
      approvedBy: version?.approvedBy ?? ""
    };
    return c.json({ settings: org, statutoryVerification });
  })
  .put("/org", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const before = await loadOrgSettings();
    const body = await c.req.json<Record<string, unknown>>().catch(() => null);
    if (!body) {
      return c.json({ error: "Invalid JSON body." }, 400);
    }

    const data: Record<string, unknown> = {};

    if (body.companyLegalName !== undefined) {
      data.companyLegalName = String(body.companyLegalName ?? "").trim();
    }
    if (body.companyAddress !== undefined) {
      data.companyAddress = String(body.companyAddress ?? "").trim();
    }
    if (body.ssbEmployerNumber !== undefined) {
      data.ssbEmployerNumber = String(body.ssbEmployerNumber ?? "").trim();
    }
    if (body.nhiEmployerNumber !== undefined) {
      data.nhiEmployerNumber = String(body.nhiEmployerNumber ?? "").trim();
    }
    if (body.statutorySignatureDataUrl !== undefined) {
      const value = String(body.statutorySignatureDataUrl ?? "");
      if (value && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)) {
        return c.json({ error: "Signature must be a PNG image." }, 400);
      }
      if (value.length > 500_000) {
        return c.json({ error: "Signature image is too large." }, 400);
      }
      data.statutorySignatureDataUrl = value;
    }

    // Filing identity + applicability (Batch 15).
    if (body.companyRegistrationNumber !== undefined) {
      data.companyRegistrationNumber = String(body.companyRegistrationNumber ?? "").trim();
    }
    if (body.registeredAgentName !== undefined) {
      data.registeredAgentName = String(body.registeredAgentName ?? "").trim();
    }
    if (body.registeredOfficeAddress !== undefined) {
      data.registeredOfficeAddress = String(body.registeredOfficeAddress ?? "").trim();
    }
    if (body.annualReturnExemptionBasis !== undefined) {
      data.annualReturnExemptionBasis = String(body.annualReturnExemptionBasis ?? "").trim();
    }
    if (body.incorporationDate !== undefined) {
      const raw = String(body.incorporationDate ?? "").trim();
      const d = raw ? new Date(raw.length === 10 ? `${raw}T00:00:00.000Z` : raw) : null;
      if (raw && (!d || Number.isNaN(d.getTime()))) {
        return c.json({ error: "incorporationDate must be a valid date." }, 400);
      }
      data.incorporationDate = d;
    }
    if (body.fiscalYearEndMonth !== undefined) {
      const m = Number(body.fiscalYearEndMonth);
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        return c.json({ error: "fiscalYearEndMonth must be an integer between 1 and 12." }, 400);
      }
      data.fiscalYearEndMonth = m;
    }
    if (body.filesIrFinancialStatements !== undefined) {
      data.filesIrFinancialStatements = Boolean(body.filesIrFinancialStatements);
    }

    if (body.defaultPaySchedule !== undefined) {
      const schedule = parseSchedule(body.defaultPaySchedule);
      if (!schedule) {
        return c.json({ error: "defaultPaySchedule must be weekly, biweekly, or monthly." }, 400);
      }
      data.defaultPaySchedule = schedule;
    }

    if (body.defaultPayDayOfMonth !== undefined) {
      const day = parseNonNegativeNumber(body.defaultPayDayOfMonth);
      if (day === null || !Number.isInteger(day) || day > 31) {
        return c.json({ error: "defaultPayDayOfMonth must be an integer between 0 and 31." }, 400);
      }
      data.defaultPayDayOfMonth = day;
    }

    const numericFields = [
      "ssbEmployeeRate",
      "ssbEmployerRate",
      "ssbAnnualCeiling",
      "nhiEmployeeRate",
      "nhiEmployerRate",
      "nhiAnnualCeiling",
      "payrollTaxEmployeeRate",
      "payrollTaxAnnualExemption"
    ] as const;
    for (const field of numericFields) {
      if (body[field] !== undefined) {
        const value = parseNonNegativeNumber(body[field]);
        if (value === null) {
          return c.json({ error: `${field} must be a finite number >= 0.` }, 400);
        }
        if (field.endsWith("Rate") && value > 1) {
          return c.json({ error: `${field} must be a decimal rate between 0 and 1.` }, 400);
        }
        data[field] = value;
      }
    }

    for (const field of ["ssbEnabled", "nhiEnabled", "payrollTaxEnabled"] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "boolean") {
          return c.json({ error: `${field} must be a boolean.` }, 400);
        }
        data[field] = body[field];
      }
    }

    if (body.payrollTaxEmployerClass !== undefined) {
      const value = String(body.payrollTaxEmployerClass);
      if (value !== "NOT_SET" && value !== "CLASS_1" && value !== "CLASS_2") {
        return c.json({ error: "payrollTaxEmployerClass must be NOT_SET, CLASS_1, or CLASS_2." }, 400);
      }
      data.payrollTaxEmployerClass = value;
    }

    if (body.statutoryEffectiveYear !== undefined) {
      const value = parseNonNegativeNumber(body.statutoryEffectiveYear);
      if (value === null || !Number.isInteger(value) || value < 2020 || value > 2100) {
        return c.json({ error: "statutoryEffectiveYear must be a valid four-digit year." }, 400);
      }
      data.statutoryEffectiveYear = value;
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const settings = await prisma.orgSettings.update({
      where: { orgId: requireOrgId() },
      data
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "org_settings.update",
      entityType: "OrgSettings",
      entityId: settings.id,
      before: { ...before, statutorySignatureDataUrl: before.statutorySignatureDataUrl ? "[saved signature]" : "" },
      after: { ...settings, statutorySignatureDataUrl: settings.statutorySignatureDataUrl ? "[saved signature]" : "" }
    });

    return c.json({ settings });
  });
