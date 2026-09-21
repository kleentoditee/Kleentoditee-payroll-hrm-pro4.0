import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient: PrismaClient | undefined };

function createClient(): PrismaClient {
  // Prisma 7: the client is Rust-free and requires a driver adapter; the
  // connection string moved out of the schema (datasource.url removed).
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set; cannot create Prisma client.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  // Cache on globalThis so tsx watch / hot reloads reuse one pg pool.
  if (!globalForPrisma.prismaClient) {
    globalForPrisma.prismaClient = createClient();
  }
  return globalForPrisma.prismaClient;
}

// ---------------------------------------------------------------------------
// Multi-tenant scoping (Batch 12)
//
// Every business row carries orgId. Request handlers run inside an
// AsyncLocalStorage org scope (installed by the API auth middleware); the
// exported `prisma` proxy resolves to an org-scoped extended client whenever
// a scope is active, so existing call sites are automatically tenant-safe.
// Code that runs outside a request scope (login, token verification, rate
// limiting, ops scripts) gets the unscoped base client.
// ---------------------------------------------------------------------------

export interface OrgScope {
  orgId: string;
  /** True when the scope came from audited platform-support access. */
  supportAccess?: boolean;
}

const orgScopeStorage = new AsyncLocalStorage<OrgScope>();

export function runWithOrgScope<T>(scope: OrgScope, fn: () => T): T {
  return orgScopeStorage.run(scope, fn);
}

export function currentOrgId(): string | null {
  return orgScopeStorage.getStore()?.orgId ?? null;
}

export function currentOrgScope(): OrgScope | null {
  return orgScopeStorage.getStore() ?? null;
}

/**
 * Org id for create payloads at call sites that run inside a request scope.
 * Throws when no scope is active — a programmer error (seed/ops scripts must
 * pass the org id explicitly instead).
 */
export function requireOrgId(): string {
  const orgId = currentOrgId();
  if (!orgId) {
    throw new Error("No organization scope is active; pass orgId explicitly outside request handlers.");
  }
  return orgId;
}

/** Models that carry an orgId column and must be tenant-scoped. */
const TENANT_MODELS = new Set([
  "AuditLog",
  "DeductionTemplate",
  "Employee",
  "StaffRequest",
  "EmployeeDocument",
  "TimeEntry",
  "PayPeriod",
  "PayRun",
  "PayRunItem",
  "Paystub",
  "PayrollExport",
  "OrgSettings",
  "Account",
  "Customer",
  "Supplier",
  "Product",
  "Invoice",
  "InvoiceLine",
  "Bill",
  "BillLine",
  "Payment",
  "PaymentApplication",
  "BillPayment",
  "BillPaymentApplication",
  "Expense",
  "ExpenseLine",
  "WorkAssignment",
  "StaffAnnouncement",
  "NotificationLog",
  "StaffQuizQuestion",
  "StaffQuizAttempt",
  "RewardLedger",
  "Deposit",
  "DepositLine",
  "JournalEntry",
  "JournalLine",
  "FiscalYear",
  "FiscalPeriod",
  "BankStatementImport",
  "BankStatementLine",
  "BankReconciliation",
  "BankReconciliationLine",
  "ReportSnapshot",
  "YearEndClose",
  "StatutoryRateVersion",
  "PayrollYtdOpeningBalance",
  "LeavePolicy",
  "UserInvitation",
  "OrganizationMembership",
  "AccountingImportBatch",
  "AccountingImportFile",
  "AccountingImportRow",
  "ExternalSourceRef",
  "MigrationReconciliation",
  "LegacyDocument",
  "Department",
  "Position",
  "CostCentre",
  "Location",
  "WorkSchedule",
  "EmploymentContract",
  "EmployeeAsset"
]);

type Args = Record<string, unknown>;

function withOrgWhere(args: Args | undefined, orgId: string): Args {
  const next: Args = { ...(args ?? {}) };
  next.where = { ...((next.where as Args | undefined) ?? {}), orgId };
  return next;
}

/**
 * Recursively injects orgId into create payloads, including nested relation
 * creates (`lines: { create: [...] }`, `createMany`, `connectOrCreate`).
 */
function injectCreate(data: unknown, orgId: string): void {
  if (Array.isArray(data)) {
    for (const item of data) injectCreate(item, orgId);
    return;
  }
  if (!data || typeof data !== "object") return;
  const record = data as Args;
  record.orgId = orgId;
  for (const value of Object.values(record)) {
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) continue; // scalar arrays, not relation writes
    const rel = value as Args;
    if (rel.create) injectCreate(rel.create, orgId);
    if (rel.createMany) {
      const cm = rel.createMany as Args;
      injectCreate(cm.data, orgId);
    }
    if (rel.connectOrCreate) {
      const coc = rel.connectOrCreate as Args;
      injectCreate(coc.create, orgId);
    }
  }
}

/**
 * Rewrites Prisma operation args so every read/write is constrained to orgId.
 * findUnique/update/delete accept extra non-unique where fields since Prisma 5
 * (extendedWhereUnique), so a mismatched org simply yields not-found.
 */
export function applyOrgScope(operation: string, args: Args | undefined, orgId: string): Args | undefined {
  switch (operation) {
    case "findUnique":
    case "findUniqueOrThrow":
    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "count":
    case "aggregate":
    case "groupBy":
    case "update":
    case "updateMany":
    case "delete":
    case "deleteMany":
      return withOrgWhere(args, orgId);
    case "create": {
      const next: Args = { ...(args ?? {}) };
      injectCreate(next.data, orgId);
      return next;
    }
    case "createMany": {
      const next: Args = { ...(args ?? {}) };
      injectCreate(next.data, orgId);
      return next;
    }
    case "createManyAndReturn": {
      const next: Args = { ...(args ?? {}) };
      injectCreate(next.data, orgId);
      return next;
    }
    case "upsert": {
      const next = withOrgWhere(args, orgId);
      injectCreate(next.create, orgId);
      return next;
    }
    default:
      return args;
  }
}

const scopedClients = new Map<string, PrismaClient>();

function getScopedClient(orgId: string): PrismaClient {
  let client = scopedClients.get(orgId);
  if (!client) {
    client = getClient().$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_MODELS.has(model)) {
              return query(args);
            }
            // Runtime arg rewriting is checked by applyOrgScope's own contract;
            // the generic extension signature cannot express it.
            return query(applyOrgScope(operation, args as Args, orgId) as never);
          }
        }
      }
    }) as unknown as PrismaClient;
    scopedClients.set(orgId, client);
  }
  return client;
}

// Lazy singleton: constructing the client requires DATABASE_URL, and many
// consumers import this module only for types/enums. Defer construction (and
// the missing-env error) to first actual use. The proxy itself must never be
// cached on globalThis â€” only the real client is.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const orgId = currentOrgId();
    const client = orgId ? getScopedClient(orgId) : getClient();
    const value = Reflect.get(client as object, prop, client);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  }
});

export * from "@prisma/client";
