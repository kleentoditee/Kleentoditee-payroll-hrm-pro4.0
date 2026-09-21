// Batch 20 — bulk employee onboarding, payroll-mutation imports with batch
// reversal, and the BVI bank-payout export.
import { prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  BANK_PAYOUT_FORMAT,
  createBankPayoutExport,
  importEmployees,
  importPayrollMutations,
  ONBOARDING_HEADERS,
  reverseMutationBatch,
  reverseOnboardingBatch
} from "../lib/bulk-payroll.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [Role.platform_owner, Role.hr_admin, Role.payroll_admin, Role.finance_admin] as const;
const CAN_EDIT = [Role.platform_owner, Role.hr_admin, Role.payroll_admin] as const;

export const bulkPayrollRoutes = new Hono<{ Variables: AuthVariables }>()
  // -- bulk employee onboarding ---------------------------------------------------
  .get("/people/onboarding/template.csv", authRequired, requireRole(...CAN_VIEW), async (c) => {
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", 'attachment; filename="employee-onboarding-template.csv"');
    return c.body(ONBOARDING_HEADERS.join(",") + "\r\n");
  })
  .get("/people/onboarding/batches", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const rows = await prisma.onboardingBatch.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    return c.json({ rows });
  })
  .post("/people/onboarding/import", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const csv = String(body.csv ?? "");
    const fileName = String(body.fileName ?? "employees.csv");
    if (!csv.trim()) return c.json({ error: "csv content is required." }, 400);
    try {
      const result = await importEmployees(csv, fileName, c.get("userId"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "onboarding.imported",
        entityType: "OnboardingBatch",
        entityId: result.batchId,
        after: { fileName, created: result.created }
      });
      return c.json({ result }, 201);
    } catch (e) {
      const err = e as Error & { errors?: string[] };
      return c.json({ error: err.message, errors: err.errors ?? [] }, 400);
    }
  })
  .post("/people/onboarding/batches/:id/reverse", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const result = await reverseOnboardingBatch(c.req.param("id"), c.get("userId"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "onboarding.reversed",
        entityType: "OnboardingBatch",
        entityId: result.batchId,
        after: result
      });
      return c.json({ result });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Reversal failed." }, 400);
    }
  })

  // -- payroll-mutation imports -------------------------------------------------------
  .get("/payroll/runs/:id/mutations", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const batches = await prisma.payrollMutationBatch.findMany({
      where: { runId: c.req.param("id") },
      include: { mutations: true },
      orderBy: { createdAt: "desc" }
    });
    return c.json({ batches });
  })
  .post("/payroll/runs/:id/mutations/import", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const csv = String(body.csv ?? "");
    const fileName = String(body.fileName ?? "mutations.csv");
    if (!csv.trim()) return c.json({ error: "csv content is required." }, 400);
    try {
      const result = await importPayrollMutations(c.req.param("id"), csv, fileName, c.get("userId"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payroll.mutations_imported",
        entityType: "PayrollMutationBatch",
        entityId: result.batchId,
        after: { runId: c.req.param("id"), fileName, applied: result.applied }
      });
      return c.json({ result }, 201);
    } catch (e) {
      const err = e as Error & { errors?: string[] };
      return c.json({ error: err.message, errors: err.errors ?? [] }, 400);
    }
  })
  .post("/payroll/mutation-batches/:id/reverse", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const result = await reverseMutationBatch(c.req.param("id"), c.get("userId"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payroll.mutations_reversed",
        entityType: "PayrollMutationBatch",
        entityId: result.batchId,
        after: result
      });
      return c.json({ result });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Reversal failed." }, 400);
    }
  })

  // -- BVI bank-payout export ------------------------------------------------------------
  .post("/payroll/runs/:id/bank-export", authRequired, requireRole(...CAN_EDIT), async (c) => {
    try {
      const result = await createBankPayoutExport(c.req.param("id"));
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "payroll.bank_export",
        entityType: "PayrollExport",
        entityId: result.exportRow.id,
        after: { runId: c.req.param("id"), format: BANK_PAYOUT_FORMAT, fileName: result.exportRow.fileName }
      });
      return c.json({
        export: result.exportRow,
        reused: result.reused,
        totalNet: result.totalNet ?? null,
        itemCount: result.itemCount ?? null,
        downloadUrl: `/payroll/runs/${c.req.param("id")}/exports/${result.exportRow.id}`
      }, result.reused ? 200 : 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Bank export failed." }, 400);
    }
  });
