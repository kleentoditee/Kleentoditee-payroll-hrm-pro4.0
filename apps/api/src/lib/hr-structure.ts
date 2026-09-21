// Batch 19 — HR structure: masters, effective-dated contracts (career ledger),
// assets, expiry reminders, department/cost-centre reports, string backfill,
// and promotion of archived migration classes/locations into live masters.
import { PayBasis, prisma, requireOrgId, EmploymentType, Prisma } from "@kleentoditee/db";
import { parseCsv } from "./quickbooks-accounting-import.js";
import { documentStorage } from "./document-storage.js";

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested without a DB)
// ---------------------------------------------------------------------------

/** Master code from a display name: uppercase alnum, max 12 chars. */
export function slugCode(name: string): string {
  const code = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12)
    .replace(/-+$/g, "");
  return code || "MISC";
}

const SCHEDULE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];
export type SchedulePattern = Array<{ day: ScheduleDay; hours: number }>;

/** Validate + normalize a weekly work pattern. Throws on bad input. */
export function validateSchedulePattern(input: unknown): SchedulePattern {
  if (!Array.isArray(input)) throw new Error("Schedule pattern must be an array of { day, hours }.");
  const seen = new Set<string>();
  const out: SchedulePattern = [];
  for (const entry of input) {
    const day = String((entry as Record<string, unknown>)?.day ?? "").toLowerCase();
    const hours = Number((entry as Record<string, unknown>)?.hours);
    if (!(SCHEDULE_DAYS as readonly string[]).includes(day)) {
      throw new Error(`Invalid schedule day "${day}" (use mon..sun).`);
    }
    if (seen.has(day)) throw new Error(`Schedule day "${day}" appears twice.`);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      throw new Error(`Schedule hours for "${day}" must be between 0 and 24.`);
    }
    seen.add(day);
    out.push({ day: day as ScheduleDay, hours });
  }
  return out;
}

export function patternHoursPerWeek(pattern: SchedulePattern): number {
  return Math.round(pattern.reduce((s, d) => s + d.hours, 0) * 100) / 100;
}

/** The contract in force on a date: latest effectiveFrom <= date, open-ended wins ties. */
export function currentContract<T extends { effectiveFrom: Date; effectiveTo: Date | null }>(
  contracts: T[],
  asOf: Date
): T | null {
  const eligible = contracts
    .filter((c) => c.effectiveFrom <= asOf)
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());
  return eligible[0] ?? null;
}

export type ReminderKind = "contract_end" | "work_permit" | "document_expiry";
export type Reminder = {
  kind: ReminderKind;
  employeeId: string;
  employeeName: string;
  label: string;
  date: Date;
  daysUntil: number;
};

/** Sort reminders by urgency; anything already past due sorts first. */
export function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function parseEmploymentType(value: unknown): EmploymentType {
  const v = String(value ?? "").trim();
  return (Object.values(EmploymentType) as string[]).includes(v) ? (v as EmploymentType) : EmploymentType.full_time;
}

// ---------------------------------------------------------------------------
// Masters CRUD helpers (shared by routes)
// ---------------------------------------------------------------------------

export const MASTER_MODELS = {
  departments: "department",
  positions: "position",
  "cost-centres": "costCentre",
  locations: "location",
  "work-schedules": "workSchedule"
} as const;
export type MasterKind = keyof typeof MASTER_MODELS;

export function masterModel(kind: MasterKind) {
  const model = MASTER_MODELS[kind];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (prisma as any)[model] as {
    findMany(args?: unknown): Promise<Array<Record<string, unknown>>>;
    findFirst(args: unknown): Promise<Record<string, unknown> | null>;
    create(args: unknown): Promise<Record<string, unknown>>;
    update(args: unknown): Promise<Record<string, unknown>>;
    delete(args: unknown): Promise<Record<string, unknown>>;
  };
}

/** Reference counts that block a hard delete of a master record. */
export async function masterUsage(kind: MasterKind, id: string): Promise<number> {
  const where =
    kind === "departments"
      ? { departmentId: id }
      : kind === "positions"
        ? { positionId: id }
        : kind === "cost-centres"
          ? { costCentreId: id }
          : kind === "locations"
            ? { locationId: id }
            : { workScheduleId: id };
  const employees = await prisma.employee.count({ where });
  const contracts = await prisma.employmentContract.count({ where });
  return employees + contracts;
}

// ---------------------------------------------------------------------------
// Effective-dated contracts (career ledger — immutable history)
// ---------------------------------------------------------------------------

export type ContractInput = {
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  employmentType?: EmploymentType;
  departmentId?: string | null;
  positionId?: string | null;
  costCentreId?: string | null;
  locationId?: string | null;
  workScheduleId?: string | null;
  managerId?: string | null;
  basePayType?: PayBasis | null;
  dailyRate?: number | null;
  hourlyRate?: number | null;
  fixedPay?: number | null;
  notes?: string;
};

async function assertRefsExist(orgId: string, input: ContractInput) {
  const checks: Array<[string, Promise<number>]> = [];
  if (input.departmentId) checks.push(["Department", prisma.department.count({ where: { id: input.departmentId } })]);
  if (input.positionId) checks.push(["Position", prisma.position.count({ where: { id: input.positionId } })]);
  if (input.costCentreId) checks.push(["Cost centre", prisma.costCentre.count({ where: { id: input.costCentreId } })]);
  if (input.locationId) checks.push(["Location", prisma.location.count({ where: { id: input.locationId } })]);
  if (input.workScheduleId) checks.push(["Work schedule", prisma.workSchedule.count({ where: { id: input.workScheduleId } })]);
  if (input.managerId) checks.push(["Manager", prisma.employee.count({ where: { id: input.managerId } })]);
  for (const [label, pending] of checks) {
    if ((await pending) === 0) throw new Error(`${label} not found in this organization.`);
  }
}

/**
 * Append a contract record and re-sync the employee's current assignment from
 * the contract in force today. History is never rewritten — corrections are
 * new effective-dated records.
 */
export async function addContract(employeeId: string, input: ContractInput, actorUserId?: string) {
  const orgId = requireOrgId();
  const employee = await prisma.employee.findFirst({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found.");
  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new Error("Contract end date is before its start date.");
  }
  await assertRefsExist(orgId, input);

  return prisma.$transaction(async (tx) => {
    const contract = await tx.employmentContract.create({
      data: {
        orgId,
        employeeId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        employmentType: input.employmentType ?? EmploymentType.full_time,
        departmentId: input.departmentId ?? null,
        positionId: input.positionId ?? null,
        costCentreId: input.costCentreId ?? null,
        locationId: input.locationId ?? null,
        workScheduleId: input.workScheduleId ?? null,
        managerId: input.managerId ?? null,
        basePayType: input.basePayType ?? null,
        dailyRate: input.dailyRate ?? null,
        hourlyRate: input.hourlyRate ?? null,
        fixedPay: input.fixedPay ?? null,
        notes: input.notes ?? "",
        createdByUserId: actorUserId ?? null
      }
    });

    // Re-sync current assignment from the contract in force today. Null fields
    // mean "not specified on this contract" — never clobber an existing value
    // with null (same rule as the pay snapshot fields below).
    const all = await tx.employmentContract.findMany({ where: { employeeId } });
    const current = currentContract(all, new Date());
    if (current && current.id === contract.id) {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(current.departmentId ? { departmentId: current.departmentId } : {}),
          ...(current.positionId ? { positionId: current.positionId } : {}),
          ...(current.costCentreId ? { costCentreId: current.costCentreId } : {}),
          ...(current.locationId ? { locationId: current.locationId } : {}),
          ...(current.workScheduleId ? { workScheduleId: current.workScheduleId } : {}),
          ...(current.managerId ? { managerId: current.managerId } : {}),
          ...(current.basePayType ? { basePayType: current.basePayType } : {}),
          ...(current.dailyRate != null ? { dailyRate: current.dailyRate } : {}),
          ...(current.hourlyRate != null ? { hourlyRate: current.hourlyRate } : {}),
          ...(current.fixedPay != null ? { fixedPay: current.fixedPay } : {})
        }
      });
    }
    return contract;
  });
}

// ---------------------------------------------------------------------------
// Backfill: legacy role/defaultSite strings -> masters + initial contracts
// ---------------------------------------------------------------------------

/** Idempotent. Returns what it created/linked on this run. */
export async function backfillHrStructure(actorUserId?: string) {
  const orgId = requireOrgId();
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      role: true,
      defaultSite: true,
      departmentId: true,
      positionId: true,
      locationId: true,
      employmentStartDate: true,
      createdAt: true,
      basePayType: true,
      dailyRate: true,
      hourlyRate: true,
      fixedPay: true
    }
  });

  const positionByName = new Map<string, string>();
  for (const p of await prisma.position.findMany()) positionByName.set(p.name.toLowerCase(), p.id);
  const locationByName = new Map<string, string>();
  for (const l of await prisma.location.findMany()) locationByName.set(l.name.toLowerCase(), l.id);

  let positionsCreated = 0;
  let locationsCreated = 0;
  const ensurePosition = async (name: string) => {
    const key = name.toLowerCase();
    const hit = positionByName.get(key);
    if (hit) return hit;
    const code = await uniqueCode("position", slugCode(name));
    const created = await prisma.position.create({ data: { orgId, code, name } });
    positionByName.set(key, created.id);
    positionsCreated += 1;
    return created.id;
  };
  const ensureLocation = async (name: string) => {
    const key = name.toLowerCase();
    const hit = locationByName.get(key);
    if (hit) return hit;
    const code = await uniqueCode("location", slugCode(name));
    const created = await prisma.location.create({ data: { orgId, code, name } });
    locationByName.set(key, created.id);
    locationsCreated += 1;
    return created.id;
  };

  let employeesLinked = 0;
  let contractsCreated = 0;
  for (const emp of employees) {
    let positionId = emp.positionId;
    let locationId = emp.locationId;
    if (!positionId && emp.role.trim()) {
      positionId = await ensurePosition(emp.role.trim());
    }
    if (!locationId && emp.defaultSite.trim()) {
      locationId = await ensureLocation(emp.defaultSite.trim());
    }
    if (positionId !== emp.positionId || locationId !== emp.locationId) {
      await prisma.employee.update({ where: { id: emp.id }, data: { positionId, locationId } });
      employeesLinked += 1;
    }
    const contractCount = await prisma.employmentContract.count({ where: { employeeId: emp.id } });
    if (contractCount === 0) {
      // The opening chapter of the career ledger: terms as they stand today,
      // effective from the recorded start date. Nothing is overwritten.
      await prisma.employmentContract.create({
        data: {
          orgId,
          employeeId: emp.id,
          effectiveFrom: emp.employmentStartDate ?? emp.createdAt,
          employmentType: EmploymentType.full_time,
          departmentId: emp.departmentId,
          positionId,
          locationId,
          basePayType: emp.basePayType,
          dailyRate: emp.dailyRate || null,
          hourlyRate: emp.hourlyRate || null,
          fixedPay: emp.fixedPay || null,
          notes: "Backfilled from existing employee record (Batch 19).",
          createdByUserId: actorUserId ?? null
        }
      });
      contractsCreated += 1;
    }
  }
  return { positionsCreated, locationsCreated, employeesLinked, contractsCreated };
}

async function uniqueCode(kind: "position" | "location", base: string): Promise<string> {
  const model = kind === "position" ? prisma.position : prisma.location;
  let code = base;
  for (let i = 2; i < 99; i += 1) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clash = await (model as any).findFirst({ where: { code }, select: { id: true } });
    if (!clash) return code;
    code = `${base.slice(0, 9)}-${i}`;
  }
  throw new Error(`Could not allocate a unique ${kind} code for "${base}".`);
}

// ---------------------------------------------------------------------------
// Promotion of archived migration files (Batch 18) into live masters
// ---------------------------------------------------------------------------

const PROMOTABLE: Record<string, { target: "costCentre" | "location"; label: string }> = {
  classes: { target: "costCentre", label: "cost centres" },
  locations: { target: "location", label: "locations" }
};

/**
 * Commit an archived classes/locations migration file into live masters.
 * The file was hashed + stored at inventory time (Batch 18) but never parsed
 * into rows — we read the stored object now. Idempotent per file.
 */
export async function promoteArchivedFile(fileId: string, actorUserId?: string) {
  const orgId = requireOrgId();
  const file = await prisma.accountingImportFile.findFirst({ where: { id: fileId } });
  if (!file) throw new Error("Import file not found.");
  if (file.disposition !== "archived") throw new Error(`Only archived files can be promoted (current: ${file.disposition}).`);
  const rule = PROMOTABLE[file.importType];
  if (!rule) throw new Error(`Files of type "${file.importType}" have no promotion target yet.`);
  if (file.dispositionNote.includes("Promoted")) throw new Error("This file was already promoted.");

  const stored = await documentStorage.getObject(file.storageKey);
  const chunks: Buffer[] = [];
  for await (const chunk of stored.body) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  if (file.fileName.toLowerCase().endsWith(".xlsx")) {
    throw new Error("XLSX promotion is not supported yet — re-export the file as CSV.");
  }
  const parsed = parseCsv(buffer.toString("utf8"));

  const nameHeader =
    parsed.headers.find((h) => ["name", "class", "location", "classname", "locationname"].includes(h.toLowerCase().replace(/[^a-z]/g, ""))) ??
    parsed.headers[0];
  if (!nameHeader) throw new Error("No name column found in the archived file.");

  const names = [...new Set(parsed.rows.map((r) => String(r[nameHeader] ?? "").trim()).filter(Boolean))];
  let created = 0;
  let skipped = 0;
  for (const name of names) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[rule.target];
    const existing = await model.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
    if (existing) {
      skipped += 1;
      continue;
    }
    let code = slugCode(name);
    for (let i = 2; i < 99 && (await model.findFirst({ where: { code }, select: { id: true } })); i += 1) {
      code = `${slugCode(name).slice(0, 9)}-${i}`;
    }
    await model.create({ data: { orgId, code, name } });
    created += 1;
  }

  await prisma.accountingImportFile.update({
    where: { id: file.id },
    data: {
      dispositionNote: `${file.dispositionNote} Promoted to ${created} ${rule.label} (${skipped} existing) on ${new Date().toISOString().slice(0, 10)}.`
    }
  });
  await prisma.auditLog.create({
    data: {
      orgId,
      actorUserId: actorUserId ?? null,
      action: "migration.file_promoted",
      entityType: "AccountingImportFile",
      entityId: file.id,
      metadata: { importType: file.importType, target: rule.target, created, skipped } as Prisma.InputJsonValue
    }
  });
  return { target: rule.target, created, skipped };
}

// ---------------------------------------------------------------------------
// Expiry reminders (contracts, work permits, documents)
// ---------------------------------------------------------------------------

export async function hrReminders(daysAhead: number): Promise<Reminder[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const daysUntil = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  const reminders: Reminder[] = [];
  const contracts = await prisma.employmentContract.findMany({
    where: { effectiveTo: { not: null, lte: horizon } },
    include: { employee: { select: { id: true, fullName: true, active: true } } }
  });
  for (const c of contracts) {
    if (!c.employee.active || !c.effectiveTo) continue;
    reminders.push({
      kind: "contract_end",
      employeeId: c.employee.id,
      employeeName: c.employee.fullName,
      label: `${c.employmentType} contract ends`,
      date: c.effectiveTo,
      daysUntil: daysUntil(c.effectiveTo)
    });
  }
  const permits = await prisma.employee.findMany({
    where: { active: true, workPermitExpiryDate: { not: null, lte: horizon } },
    select: { id: true, fullName: true, workPermitExpiryDate: true }
  });
  for (const e of permits) {
    reminders.push({
      kind: "work_permit",
      employeeId: e.id,
      employeeName: e.fullName,
      label: "Work permit expires",
      date: e.workPermitExpiryDate!,
      daysUntil: daysUntil(e.workPermitExpiryDate!)
    });
  }
  const documents = await prisma.employeeDocument.findMany({
    where: { deletedAt: null, expiryDate: { not: null, lte: horizon } },
    include: { employee: { select: { id: true, fullName: true, active: true } } }
  });
  for (const d of documents) {
    if (!d.employee.active || !d.expiryDate) continue;
    reminders.push({
      kind: "document_expiry",
      employeeId: d.employee.id,
      employeeName: d.employee.fullName,
      label: `${d.type.replace(/_/g, " ").toLowerCase()} "${d.fileName}" expires`,
      date: d.expiryDate,
      daysUntil: daysUntil(d.expiryDate)
    });
  }
  return sortReminders(reminders);
}

// ---------------------------------------------------------------------------
// Department / cost-centre reports (reconcile to company totals)
// ---------------------------------------------------------------------------

export type StructureReportRow = {
  id: string | null;
  code: string;
  name: string;
  headcount: number;
  gross: number;
  net: number;
};
export type StructureReport = {
  dimension: "department" | "costCentre";
  payRunId: string | null;
  rows: StructureReportRow[];
  totals: { headcount: number; gross: number; net: number };
};

export async function structureReport(dimension: "department" | "costCentre", payRunId?: string): Promise<StructureReport> {
  const orgId = requireOrgId();
  const masters =
    dimension === "department"
      ? await prisma.department.findMany({ orderBy: { code: "asc" } })
      : await prisma.costCentre.findMany({ orderBy: { code: "asc" } });

  const employees = await prisma.employee.findMany({
    where: { active: true },
    select: { id: true, departmentId: true, costCentreId: true }
  });

  let grossByEmployee = new Map<string, { gross: number; net: number }>();
  let runId: string | null = null;
  if (payRunId) {
    const run = await prisma.payRun.findFirst({ where: { id: payRunId } });
    if (!run) throw new Error("Pay run not found.");
    runId = run.id;
    const items = await prisma.payRunItem.findMany({
      where: { runId: run.id },
      select: { employeeId: true, gross: true, net: true }
    });
    grossByEmployee = new Map(items.map((i) => [i.employeeId, { gross: i.gross, net: i.net }]));
  }

  const rows: StructureReportRow[] = masters.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    headcount: 0,
    gross: 0,
    net: 0
  }));
  const unassigned: StructureReportRow = { id: null, code: "—", name: "Unassigned", headcount: 0, gross: 0, net: 0 };
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const emp of employees) {
    const key = dimension === "department" ? emp.departmentId : emp.costCentreId;
    const bucket = (key ? byId.get(key) : undefined) ?? unassigned;
    bucket.headcount += 1;
    const money = grossByEmployee.get(emp.id);
    if (money) {
      bucket.gross += money.gross;
      bucket.net += money.net;
    }
  }
  const all = [...rows, unassigned].filter((r) => r.headcount > 0 || r.id !== null);
  const totals = all.reduce(
    (s, r) => ({ headcount: s.headcount + r.headcount, gross: s.gross + r.gross, net: s.net + r.net }),
    { headcount: 0, gross: 0, net: 0 }
  );
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    dimension,
    payRunId: runId,
    rows: all.map((r) => ({ ...r, gross: round(r.gross), net: round(r.net) })),
    totals: { headcount: totals.headcount, gross: round(totals.gross), net: round(totals.net) }
  };
}
