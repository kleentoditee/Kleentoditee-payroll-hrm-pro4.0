import { Role, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import {
  MIGRATION_IMPORT_TYPES,
  acceptBatch,
  approveBatch,
  buildErrorReportCsv,
  buildExceptionReportCsv,
  commitBatch,
  createMigrationBatch,
  inventoryFile,
  inventoryZip,
  mappingTemplateCsv,
  reverseBatch,
  signExceptionReport,
  validateBatch,
  type MigrationImportType
} from "../lib/migration-import.js";
import { normalizeDate } from "../lib/quickbooks-accounting-import.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_IMPORT = [Role.platform_owner, Role.finance_admin] as const;

function parseType(value: string): MigrationImportType | null {
  return MIGRATION_IMPORT_TYPES.includes(value as MigrationImportType) ? (value as MigrationImportType) : null;
}

function readUploadBuffer(body: Record<string, unknown>): Buffer {
  const fileName = String(body.fileName ?? "");
  if (fileName.toLowerCase().endsWith(".csv")) {
    const csv = String(body.csv ?? body.fileContent ?? "");
    if (!csv.trim()) throw new Error("File is empty.");
    return Buffer.from(csv, "utf8");
  }
  const b64 = String(body.fileContent ?? "");
  if (!b64.trim()) throw new Error("File is empty.");
  return Buffer.from(b64, "base64");
}

export const migrationImportRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/templates/:importType", authRequired, requireRole(...CAN_IMPORT), (c) => {
    const type = parseType(c.req.param("importType"));
    if (!type) return c.json({ error: "Unsupported import type." }, 400);
    return new Response(mappingTemplateCsv(type), {
      headers: { "content-type": "text/csv", "content-disposition": `attachment; filename="migration-template-${type}.csv"` }
    });
  })
  .get("/batches", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    const batches = await prisma.accountingImportBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: { files: { select: { id: true, fileName: true, importType: true, rowCount: true, validCount: true, invalidCount: true, committedCount: true } } }
    });
    return c.json({ batches });
  })
  .post("/batches", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const batch = await createMigrationBatch(
        {
          sourceSystem: String(body.sourceSystem ?? "excel_generic"),
          label: String(body.label ?? ""),
          migrationMode: String(body.migrationMode ?? "full_detail"),
          asOfDate: normalizeDate(body.asOfDate) ?? undefined
        },
        c.get("userId")
      );
      return c.json({ batch }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not create batch." }, 400);
    }
  })
  .get("/batches/:id", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    const batch = await prisma.accountingImportBatch.findFirst({
      where: { id: c.req.param("id") },
      include: {
        files: { include: { _count: { select: { rows: true } } }, orderBy: { createdAt: "asc" } },
        reconciliations: { orderBy: { createdAt: "asc" } }
      }
    });
    if (!batch) return c.json({ error: "Not found" }, 404);
    return c.json({ batch });
  })
  .post("/batches/:id/files", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const fileName = String(body.fileName ?? "").trim();
      if (!fileName) return c.json({ error: "fileName is required." }, 400);
      if (fileName.toLowerCase().endsWith(".zip")) {
        const buffer = readUploadBuffer({ ...body, fileName: "package.zip" });
        const result = await inventoryZip(c.req.param("id"), { fileName, buffer }, c.get("userId"));
        return c.json({ zip: result }, 201);
      }
      const importType = parseType(String(body.importType ?? ""));
      if (!importType) return c.json({ error: "Unsupported import type." }, 400);
      const buffer = readUploadBuffer(body);
      const file = await inventoryFile(
        c.req.param("id"),
        {
          fileName,
          importType,
          buffer,
          mappings: body.mappings && typeof body.mappings === "object" ? (body.mappings as Record<string, string>) : undefined
        },
        c.get("userId")
      );
      return c.json({ file }, 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not inventory file." }, 400);
    }
  })
  .get("/batches/:id/exception-report.csv", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const csv = await buildExceptionReportCsv(c.req.param("id"));
      return new Response(csv, {
        headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=\"migration-exception-report.csv\"" }
      });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not build exception report." }, 400);
    }
  })
  .post("/batches/:id/sign-exceptions", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
      const batch = await signExceptionReport(c.req.param("id"), String(body.signatureText ?? ""), c.get("userId"));
      return c.json({ batch });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Sign-off failed." }, 400);
    }
  })
  .get("/batches/:id/rows", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    const status = c.req.query("status");
    const fileId = c.req.query("fileId");
    const rows = await prisma.accountingImportRow.findMany({
      where: {
        file: { batchId: c.req.param("id") },
        ...(fileId ? { fileId } : {}),
        ...(status ? { status } : {})
      },
      orderBy: [{ fileId: "asc" }, { rowIndex: "asc" }],
      take: 500
    });
    return c.json({ rows });
  })
  .get("/batches/:id/errors.csv", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    const rows = await prisma.accountingImportRow.findMany({
      where: { file: { batchId: c.req.param("id") }, status: "invalid" },
      include: { file: { select: { fileName: true } } },
      orderBy: [{ fileId: "asc" }, { rowIndex: "asc" }]
    });
    const csv = buildErrorReportCsv(
      rows.map((r) => ({ fileName: r.file.fileName, rowIndex: r.rowIndex, errorMessage: r.errorMessage, payloadJson: r.payloadJson }))
    );
    return new Response(csv, {
      headers: { "content-type": "text/csv", "content-disposition": "attachment; filename=\"migration-errors.csv\"" }
    });
  })
  .post("/batches/:id/validate", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      return c.json(await validateBatch(c.req.param("id")));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Validation failed." }, 400);
    }
  })
  .post("/batches/:id/approve", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      return c.json({ batch: await approveBatch(c.req.param("id"), c.get("userId")) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Approve failed." }, 400);
    }
  })
  .post("/batches/:id/commit", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      return c.json(await commitBatch(c.req.param("id"), c.get("userId")));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Commit failed — the batch rolled back with no partial data." }, 400);
    }
  })
  .post("/batches/:id/reverse", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>));
      return c.json(await reverseBatch(c.req.param("id"), c.get("userId"), String(body.reason ?? "")));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Reversal failed." }, 400);
    }
  })
  .post("/batches/:id/accept", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      return c.json({ batch: await acceptBatch(c.req.param("id"), c.get("userId")) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Accept failed." }, 400);
    }
  });
