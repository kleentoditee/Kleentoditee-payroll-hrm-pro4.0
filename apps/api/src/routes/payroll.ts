import { PayRunStatus, Role, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  createDraftRun,
  createRunExport,
  deleteDraftRun,
  finalizeRun,
  remitRunStatutory,
  getPaystubDetail,
  getRunDetail,
  getRunExport,
  markRunPaid,
  previewPaystubs,
  rebuildDraftRun,
  voidRun
} from "../lib/payroll-service.js";
import { buildPeriodLabel } from "../lib/payroll-utils.js";
import { buildPayrollRegister, buildPayrollYearSummary, buildRegisterCsv } from "../lib/payroll-reports.js";
import {
  commitYtdImport,
  parseYearInput,
  previewYtdImport
} from "../lib/payroll-ytd-import.js";
  import { buildOfficialStatutoryPdf, buildOfficialStatutoryPreview } from "../lib/official-statutory-pdf.js";
import { buildStatutoryForms } from "../lib/statutory-forms.js";
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
const CAN_VIEW_STATUTORY_FORMS = [Role.platform_owner, Role.hr_admin, Role.payroll_admin] as const;

function parseSchedule(v: unknown): "weekly" | "biweekly" | "monthly" | null {
  if (v === "weekly" || v === "biweekly" || v === "monthly") {
    return v;
  }
  return null;
}

function parseRunStatus(v: unknown): PayRunStatus | null {
  if (v === "draft" || v === "finalized" || v === "exported" || v === "paid" || v === "void") {
    return v;
  }
  return null;
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

function listSummary(
  items: Array<{
    gross: number;
    totalDeductions: number;
    net: number;
    employerNhi: number;
    employerSsb: number;
    employerPayrollTax: number;
  }>
): { gross: number; totalDeductions: number; net: number; employerCost: number } {
  return items.reduce(
    (acc, item) => ({
      gross: Math.round((acc.gross + item.gross + Number.EPSILON) * 100) / 100,
      totalDeductions:
        Math.round((acc.totalDeductions + item.totalDeductions + Number.EPSILON) * 100) / 100,
      net: Math.round((acc.net + item.net + Number.EPSILON) * 100) / 100,
      employerCost: Math.round(
        (acc.employerCost + item.employerNhi + item.employerSsb + item.employerPayrollTax + Number.EPSILON) * 100
      ) / 100
    }),
    { gross: 0, totalDeductions: 0, net: 0, employerCost: 0 }
  );
}

function validFormMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

function validSignedDate(value: string): boolean {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function loadStatutoryForms(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));

    const [settings, runs, currentEmployees] = await Promise.all([
    prisma.orgSettings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } }),
    prisma.payRun.findMany({
      where: {
        status: { in: [PayRunStatus.finalized, PayRunStatus.exported, PayRunStatus.paid] },
        OR: [
          { period: { payDate: { gte: monthStart, lt: nextMonth } } },
          { period: { payDate: null, endDate: { gte: monthStart, lt: nextMonth } } }
        ]
      },
      select: {
        id: true,
        period: { select: { schedule: true, endDate: true, payDate: true } },
        items: {
          select: {
            employeeId: true,
            employeeName: true,
            gross: true,
            nhi: true,
            ssb: true,
            employerNhi: true,
            employerSsb: true,
            daysWorked: true,
            employee: {
              select: {
                fullName: true,
                sex: true,
                socialSecurityNumber: true,
                nationalHealthInsuranceNumber: true,
                nhiUnemployedSpouse: true
              }
            }
          }
        }
      },
        orderBy: { period: { endDate: "asc" } }
      }),
      prisma.employee.findMany({
        where: { active: true },
        select: {
          id: true,
          fullName: true,
          sex: true,
          socialSecurityNumber: true,
          nationalHealthInsuranceNumber: true,
          nhiUnemployedSpouse: true
        },
        orderBy: { fullName: "asc" }
      })
    ]);
  
    return buildStatutoryForms(settings, runs, month, currentEmployees);
  }

  export const payrollRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/statutory-forms", authRequired, requireRole(...CAN_VIEW_STATUTORY_FORMS), async (c) => {
    const month = String(c.req.query("month") ?? "").trim();
    if (!validFormMonth(month)) {
      return c.json({ error: "month must use YYYY-MM format." }, 400);
      }
      return c.json(await loadStatutoryForms(month));
    })
    .get("/statutory-forms/:kind/preview.svg", authRequired, requireRole(...CAN_VIEW_STATUTORY_FORMS), async (c) => {
      const kind = String(c.req.param("kind") ?? "");
      const month = String(c.req.query("month") ?? "").trim();
      const signedDate = String(c.req.query("signedDate") ?? "").trim();
      if (kind !== "nhi" && kind !== "ssb") return c.json({ error: "Form must be nhi or ssb." }, 404);
      if (!validFormMonth(month)) return c.json({ error: "month must use YYYY-MM format." }, 400);
      if (!validSignedDate(signedDate)) return c.json({ error: "signedDate must use YYYY-MM-DD format." }, 400);

      const data = await loadStatutoryForms(month);
      const preview = await buildOfficialStatutoryPreview(kind, data, signedDate);
      return c.body(preview, 200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store"
      });
    })
  .get("/statutory-forms/:file", authRequired, requireRole(...CAN_VIEW_STATUTORY_FORMS), async (c) => {
    const kind = String(c.req.param("file") ?? "").replace(/\.pdf$/i, "");
    const month = String(c.req.query("month") ?? "").trim();
    const signedDate = String(c.req.query("signedDate") ?? "").trim();
    if (kind !== "nhi" && kind !== "ssb") return c.json({ error: "Form must be nhi or ssb." }, 404);
    if (!validFormMonth(month)) return c.json({ error: "month must use YYYY-MM format." }, 400);
    if (!validSignedDate(signedDate)) return c.json({ error: "signedDate must use YYYY-MM-DD format." }, 400);

    const data = await loadStatutoryForms(month);
    const pdf = await buildOfficialStatutoryPdf(kind, data, signedDate);
    const filename = kind === "nhi" ? `NHI-Form-K-${month}.pdf` : `SSB-Forms-I-II-${month}.pdf`;
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return c.body(body, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    });
  })
  .get("/periods", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const schedule = parseSchedule(c.req.query("schedule"));
    const periods = await prisma.payPeriod.findMany({
      where: schedule ? { schedule } : undefined,
      include: {
        runs: {
          include: { items: true },
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ endDate: "desc" }, { createdAt: "desc" }]
    });
    return c.json({
      items: periods.map((period) => ({
        ...period,
        label: period.label || buildPeriodLabel(period),
        runs: period.runs.map((run) => ({
          ...run,
          itemCount: run.items.length,
          summary: listSummary(run.items)
        }))
      }))
    });
  })
  .post("/periods", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const schedule = parseSchedule(body.schedule);
    const startDate = parseDateInput(body.startDate);
    const endDate = parseDateInput(body.endDate);
    const payDate = parseDateInput(body.payDate);

    if (!schedule || !startDate || !endDate) {
      return c.json({ error: "schedule, startDate, and endDate are required." }, 400);
    }
    if (startDate > endDate) {
      return c.json({ error: "startDate must be on or before endDate." }, 400);
    }

    const row = await prisma.payPeriod.create({
      data: {
        schedule,
        startDate,
        endDate,
        payDate,
        notes: String(body.notes ?? ""),
        label: String(body.label ?? "").trim() || buildPeriodLabel({ schedule, startDate, endDate })
      }
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "pay_period.create",
      entityType: "PayPeriod",
      entityId: row.id,
      after: row
    });

    return c.json({ period: row }, 201);
  })
  .get("/periods/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.payPeriod.findUnique({
      where: { id },
      include: {
        runs: {
          include: {
            items: {
              include: { paystub: true },
              orderBy: { employeeName: "asc" }
            },
            exports: {
              orderBy: { createdAt: "desc" }
            }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({
      period: {
        ...row,
        label: row.label || buildPeriodLabel(row),
        runs: row.runs.map((run) => ({
          ...run,
          summary: listSummary(run.items)
        }))
      }
    });
  })
  .patch("/periods/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.payPeriod.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }

    const lockedRuns = await prisma.payRun.count({
      where: {
        periodId: id,
        status: {
          not: PayRunStatus.draft
        }
      }
    });
    if (lockedRuns > 0) {
      return c.json({ error: "This pay period has a finalized run and can no longer be edited." }, 409);
    }

    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    let nextSchedule = before.schedule;
    let nextStartDate = before.startDate;
    let nextEndDate = before.endDate;

    if (body.schedule !== undefined) {
      const schedule = parseSchedule(body.schedule);
      if (!schedule) {
        return c.json({ error: "Invalid schedule." }, 400);
      }
      data.schedule = schedule;
      nextSchedule = schedule;
    }
    if (body.startDate !== undefined) {
      const startDate = parseDateInput(body.startDate);
      if (!startDate) {
        return c.json({ error: "Invalid startDate." }, 400);
      }
      data.startDate = startDate;
      nextStartDate = startDate;
    }
    if (body.endDate !== undefined) {
      const endDate = parseDateInput(body.endDate);
      if (!endDate) {
        return c.json({ error: "Invalid endDate." }, 400);
      }
      data.endDate = endDate;
      nextEndDate = endDate;
    }
    if (nextStartDate > nextEndDate) {
      return c.json({ error: "startDate must be on or before endDate." }, 400);
    }
    if (body.payDate !== undefined) {
      const payDate = body.payDate ? parseDateInput(body.payDate) : null;
      if (body.payDate && !payDate) {
        return c.json({ error: "Invalid payDate." }, 400);
      }
      data.payDate = payDate;
    }
    if (body.notes !== undefined) {
      data.notes = String(body.notes ?? "");
    }
    if (body.label !== undefined) {
      const label = String(body.label ?? "").trim();
      data.label = label || buildPeriodLabel({ schedule: nextSchedule, startDate: nextStartDate, endDate: nextEndDate });
    } else if (body.schedule !== undefined || body.startDate !== undefined || body.endDate !== undefined) {
      data.label = buildPeriodLabel({ schedule: nextSchedule, startDate: nextStartDate, endDate: nextEndDate });
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.payPeriod.update({
      where: { id },
      data: data as never
    });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "pay_period.update",
      entityType: "PayPeriod",
      entityId: id,
      before,
      after: row
    });

    return c.json({ period: row });
  })
  .delete("/periods/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.payPeriod.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }

    const blockingRuns = await prisma.payRun.count({
      where: {
        periodId: id,
        status: { not: PayRunStatus.draft }
      }
    });
    if (blockingRuns > 0) {
      return c.json(
        { error: "This pay period has a finalized, exported, paid, or voided run and cannot be deleted." },
        409
      );
    }

    await prisma.payPeriod.delete({ where: { id } });

    await writeAudit({
      actorUserId: c.get("userId"),
      action: "pay_period.delete",
      entityType: "PayPeriod",
      entityId: id,
      before
    });

    return c.json({ ok: true });
  })
  .get("/runs", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = parseRunStatus(c.req.query("status"));
    const schedule = parseSchedule(c.req.query("schedule"));
    const items = await prisma.payRun.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(schedule ? { period: { schedule } } : {})
      },
      include: {
        period: true,
        items: {
          include: { paystub: true }
        },
        exports: {
          orderBy: { createdAt: "desc" }
        }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return c.json({
      items: items.map((run) => ({
        ...run,
        period: {
          ...run.period,
          label: run.period.label || buildPeriodLabel(run.period)
        },
        summary: listSummary(run.items),
        itemCount: run.items.length
      }))
    });
  })
  .post("/runs", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const periodId = String(body.periodId ?? "").trim();
      if (!periodId) {
        return c.json({ error: "periodId is required." }, 400);
      }
      const run = await createDraftRun(periodId, String(body.notes ?? ""));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.create",
        entityType: "PayRun",
        entityId: run?.id,
        after: run
      });
      return c.json({ run }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not create pay run." }, 400);
    }
  })
  .get("/runs/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const run = await getRunDetail(c.req.param("id"));
      return c.json({
        run: {
          ...run,
          period: {
            ...run.period,
            label: run.period.label || buildPeriodLabel(run.period)
          }
        }
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Not found" }, 404);
    }
  })
  .post("/runs/:id/rebuild", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await rebuildDraftRun(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.rebuild",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not rebuild pay run." }, 400);
    }
  })
  .post("/runs/:id/finalize", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await finalizeRun(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.finalize",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not finalize pay run." }, 400);
    }
  })
  .post("/runs/:id/export", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const result = await createRunExport(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.export",
        entityType: "PayRun",
        entityId: result.run?.id,
        before,
        after: result.run,
        metadata: {
          exportId: result.exportRow.id,
          fileName: result.fileName
        }
      });
      return c.json({
        run: result.run,
        export: result.exportRow,
        fileName: result.fileName,
        csv: result.csv
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not export pay run." }, 400);
    }
  })
  .post("/runs/:id/mark-paid", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await markRunPaid(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.mark_paid",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not mark pay run paid." }, 400);
    }
  })
  .post("/runs/:id/remit-statutory", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await remitRunStatutory(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.remit_statutory",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not record statutory remittance." }, 400);
    }
  })
  .post("/runs/:id/void", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
      const before = await prisma.payRun.findUnique({ where: { id: c.req.param("id") } });
      const run = await voidRun(c.req.param("id"), { reversePaid: body.reversePaid === true });
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.void",
        entityType: "PayRun",
        entityId: run?.id,
        before,
        after: run
      });
      return c.json({ run });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not void pay run." }, 400);
    }
  })
  .delete("/runs/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const before = await deleteDraftRun(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.delete",
        entityType: "PayRun",
        entityId: before.id,
        before
      });
      return c.json({ ok: true });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not delete pay run." }, 400);
    }
  })
  .get("/runs/:id/exports/:exportId", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const exportRow = await getRunExport(c.req.param("id"), c.req.param("exportId"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "pay_run.export_download",
        entityType: "PayrollExport",
        entityId: exportRow.id,
        metadata: { runId: exportRow.runId, fileName: exportRow.fileName }
      });
      c.header("Content-Type", "text/csv; charset=utf-8");
      c.header("Content-Disposition", `attachment; filename="${exportRow.fileName}"`);
      return c.body(exportRow.contents);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Export not found." }, 404);
    }
  })
  .get("/paystubs/preview", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const periodId = String(c.req.query("periodId") ?? "").trim();
      if (!periodId) {
        return c.json({ error: "periodId is required." }, 400);
      }
      return c.json(await previewPaystubs(periodId));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not preview paystubs." }, 400);
    }
  })
  .get("/paystubs/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    try {
      const paystub = await getPaystubDetail(c.req.param("id"));
      return c.json({ paystub });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Not found" }, 404);
    }
  });


// --- Historical / YTD opening-balance import (research R5) ---

payrollRoutes.get("/ytd-opening-balances", authRequired, requireRole(...CAN_VIEW), async (c) => {
  const yearParam = c.req.query("year");
  const year = yearParam ? parseYearInput(yearParam) : new Date().getUTCFullYear();
  if (year === null) {
    return c.json({ error: "year must be an integer between 2000 and 2100." }, 400);
  }
  const [balances, employees] = await Promise.all([
    prisma.payrollYtdOpeningBalance.findMany({
      where: { year },
      include: { employee: { select: { id: true, fullName: true, email: true, paySchedule: true, active: true } } },
      orderBy: { employee: { fullName: "asc" } }
    }),
    prisma.employee.findMany({
      where: { active: true },
      select: { id: true, fullName: true, email: true, paySchedule: true },
      orderBy: { fullName: "asc" }
    })
  ]);
  const covered = new Set(balances.map((row) => row.employeeId));
  return c.json({
    year,
    balances,
    employeesWithoutBalance: employees.filter((employee) => !covered.has(employee.id))
  });
});

payrollRoutes.post("/ytd-opening-balances/preview", authRequired, requireRole(...CAN_EDIT), async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const year = parseYearInput(body.year);
    if (year === null) {
      return c.json({ error: "year must be an integer between 2000 and 2100." }, 400);
    }
    const csv = String(body.csv ?? "");
    return c.json({ plan: await previewYtdImport(csv, year) });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Could not preview import." }, 400);
  }
});

payrollRoutes.post("/ytd-opening-balances/commit", authRequired, requireRole(...CAN_EDIT), async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const year = parseYearInput(body.year);
    if (year === null) {
      return c.json({ error: "year must be an integer between 2000 and 2100." }, 400);
    }
    const csv = String(body.csv ?? "");
    const result = await commitYtdImport(csv, year, c.get("userId"));
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "payroll_ytd_opening_balance.import",
      entityType: "PayrollYtdOpeningBalance",
      after: result
    });
    return c.json({ result });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Could not import opening balances." }, 400);
  }
});

payrollRoutes.delete("/ytd-opening-balances/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
  const id = c.req.param("id");
  const existing = await prisma.payrollYtdOpeningBalance.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: "Opening balance not found." }, 404);
  }
  await prisma.payrollYtdOpeningBalance.delete({ where: { id } });
  await writeAudit({
    actorUserId: c.get("userId"),
    action: "payroll_ytd_opening_balance.delete",
    entityType: "PayrollYtdOpeningBalance",
    entityId: id,
    before: existing
  });
  return c.json({ ok: true });
});


// --- Payroll reports: register, year summary, reconciliation (research R9) ---

payrollRoutes.get("/reports/register", authRequired, requireRole(...CAN_VIEW), async (c) => {
  const runId = String(c.req.query("runId") ?? "").trim();
  if (!runId) {
    return c.json({ error: "runId is required." }, 400);
  }
  try {
    const register = await buildPayrollRegister(runId);
    if (String(c.req.query("format") ?? "").toLowerCase() === "csv") {
      const csv = buildRegisterCsv(register.period, register.run.status, register.lines, register.totals);
      const fileName = `payroll-register-${register.period.schedule}-${register.period.startDate.toISOString().slice(0, 10)}.csv`;
      c.header("Content-Type", "text/csv; charset=utf-8");
      c.header("Content-Disposition", `attachment; filename="${fileName}"`);
      return c.body(csv);
    }
    return c.json({ register });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : "Could not build register." }, 404);
  }
});

payrollRoutes.get("/reports/year-summary", authRequired, requireRole(...CAN_VIEW), async (c) => {
  const yearParam = c.req.query("year");
  const year = yearParam ? parseYearInput(yearParam) : new Date().getUTCFullYear();
  if (year === null) {
    return c.json({ error: "year must be an integer between 2000 and 2100." }, 400);
  }
  const summary = await buildPayrollYearSummary(year);
  return c.json({ summary });
});
