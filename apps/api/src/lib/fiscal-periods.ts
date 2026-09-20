import { FiscalPeriodStatus, requireOrgId, type Prisma, type prisma } from "@kleentoditee/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export class PeriodClosedError extends Error {
  constructor(
    public readonly periodLabel: string,
    public readonly status: FiscalPeriodStatus
  ) {
    super(
      status === FiscalPeriodStatus.locked
        ? `Posting rejected: fiscal period ${periodLabel} is locked.`
        : `Posting rejected: fiscal period ${periodLabel} is closed. Reopen it to post.`
    );
    this.name = "PeriodClosedError";
  }
}

function monthBounds(date: Date): { year: number; period: number; startDate: Date; endDate: Date } {
  const year = date.getUTCFullYear();
  const period = date.getUTCMonth() + 1;
  const startDate = new Date(Date.UTC(year, period - 1, 1));
  const endDate = new Date(Date.UTC(year, period, 0, 23, 59, 59, 999));
  return { year, period, startDate, endDate };
}

export function fiscalPeriodLabel(year: number, period: number): string {
  return `${year}-${String(period).padStart(2, "0")}`;
}

/**
 * Resolve (auto-creating open) the fiscal period containing `date` for the
 * active org, and reject when it is soft_closed or locked. Called by
 * postJournal so EVERY posting event — invoices, payments, payroll, manual
 * journals — is period-controlled (Batch 13).
 */
export async function assertPeriodOpen(db: DbClient, date: Date): Promise<{ id: string; year: number; period: number }> {
  const orgId = requireOrgId();
  const { year, period, startDate, endDate } = monthBounds(date);
  const existing = await db.fiscalPeriod.findFirst({
    where: { startDate: { lte: date }, endDate: { gte: date } },
    select: { id: true, year: true, period: true, status: true }
  });
  if (existing) {
    if (existing.status !== FiscalPeriodStatus.open) {
      throw new PeriodClosedError(fiscalPeriodLabel(existing.year, existing.period), existing.status);
    }
    return { id: existing.id, year: existing.year, period: existing.period };
  }
  // Auto-provision open year + period (calendar-year convention).
  const fiscalYear = await db.fiscalYear.upsert({
    where: { orgId_year: { orgId, year } },
    create: {
      orgId,
      year,
      startDate: new Date(Date.UTC(year, 0, 1)),
      endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    },
    update: {},
    select: { id: true }
  });
  const created = await db.fiscalPeriod.upsert({
    where: { orgId_year_period: { orgId, year, period } },
    create: { orgId, year, period, startDate, endDate, fiscalYearId: fiscalYear.id },
    update: {},
    select: { id: true, year: true, period: true }
  });
  return created;
}
