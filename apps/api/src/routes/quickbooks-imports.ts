import { Role } from "@kleentoditee/db";
import { Hono } from "hono";
import {
  buildImportPlan,
  executeQuickBooksImport,
  parseCsv,
  parseExcel,
  QUICKBOOKS_IMPORT_TYPES,
  type QuickBooksImportType
} from "../lib/quickbooks-accounting-import.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_IMPORT = [Role.platform_owner, Role.finance_admin] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function parseImportType(value: string): QuickBooksImportType | null {
  return QUICKBOOKS_IMPORT_TYPES.includes(value as QuickBooksImportType) ? (value as QuickBooksImportType) : null;
}

async function readFilePayload(body: Record<string, unknown>) {
  const fileName = String(body.fileName ?? "").trim();
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    throw new Error("Only .xlsx or .csv accounting export files are accepted.");
  }
  if (lower.endsWith(".csv")) {
    const csv = String(body.csv ?? body.fileContent ?? "");
    if (Buffer.byteLength(csv, "utf8") > MAX_FILE_BYTES) {
      throw new Error("Accounting export file is too large. Maximum size is 5 MB.");
    }
    if (!csv.trim()) {
      throw new Error("Accounting export file is empty.");
    }
    return parseCsv(csv);
  }
  const fileContent = String(body.fileContent ?? "");
  if (!fileContent.trim()) {
    throw new Error("Accounting export file is empty.");
  }
  const buffer = Buffer.from(fileContent, "base64");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Accounting export file is too large. Maximum size is 5 MB.");
  }
  return parseExcel(buffer);
}

export const quickBooksImportRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/quickbooks/import-types", authRequired, requireRole(...CAN_IMPORT), (c) => {
    return c.json({
      items: QUICKBOOKS_IMPORT_TYPES.map((id) => ({ id }))
    });
  })
  .post("/quickbooks/preview", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const importType = parseImportType(String(body.importType ?? ""));
      if (!importType) {
        return c.json({ error: "Unsupported accounting import type." }, 400);
      }
      const parsed = await readFilePayload(body);
      const mappings =
        body.mappings && typeof body.mappings === "object"
          ? (body.mappings as Record<string, string>)
          : undefined;
      return c.json({ plan: buildImportPlan(importType, parsed.headers, parsed.rows, mappings, parsed.warnings) });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not preview import." }, 400);
    }
  })
  .post("/quickbooks/commit", authRequired, requireRole(...CAN_IMPORT), async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const importType = parseImportType(String(body.importType ?? ""));
      if (!importType) {
        return c.json({ error: "Unsupported accounting import type." }, 400);
      }
      const mappings =
        body.mappings && typeof body.mappings === "object"
          ? (body.mappings as Record<string, string>)
          : {};
      const parsed = await readFilePayload(body);
      const result = await executeQuickBooksImport(importType, parsed.headers, parsed.rows, mappings, c.get("userId"));
      if (result.validationErrors.length) {
        return c.json({ result, error: "Fix validation errors before importing." }, 400);
      }
      return c.json({ result });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : "Could not import accounting data." }, 400);
    }
  });
