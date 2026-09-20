import { PaySchedule, PayRunStatus, Prisma, TimeEntryStatus, prisma } from "@kleentoditee/db";
import { employeeForNestedTimeContextSelect } from "./employee-privacy.js";
import { roundMoney } from "./payroll-calc.js";
import { buildRunItemsFromEntries } from "./payroll-run-builder.js";
import { loadYtdOpeningGrossByEmployee } from "./payroll-ytd-import.js";
import { loadUnpaidLeaveDaysByEmployee } from "./leave.js";
import {
  buildPayrollRemittanceJournal,
  buildPayrollRunJournal,
  buildPayrollSettlementJournal,
  ensureControlAccounts,
  findAccountIdByCode,
  postJournal,
  reverseJournal
} from "./gl-posting.js";
import {
  statutoryConfigFromOrgSettings,
  statutoryConfigFromVersion,
  versionCoversDate,
  type StatutoryConfig,
  type StatutoryRateVersionLike
} from "./statutory-config.js";
import {
  buildPayrollCsv,
  buildPeriodLabel,
  createPaystubNumber,
  dateKey
} from "./payroll-utils.js";

type OrgCompanyInfo = { companyLegalName: string; companyAddress: string };

function assertPayrollSettingsReady(company: OrgCompanyInfo, statutoryConfig: StatutoryConfig) {
  if (!company.companyLegalName.trim()) {
    throw new Error("Add the company legal name in Settings before finalizing payroll.");
  }

  const requiredContributions = [
    ["Social Security", statutoryConfig.socialSecurity],
    ["National Health Insurance", statutoryConfig.nationalHealthInsurance]
  ] as const;
  for (const [label, contribution] of requiredContributions) {
    if (!contribution.enabled) continue;
    if (contribution.employeeRate <= 0 || contribution.employerRate <= 0 || contribution.periodCeiling <= 0) {
      throw new Error(
        `${label} is enabled but its employee rate, employer rate, or period ceiling is zero. Review the official BVI figures in Settings before finalizing payroll.`
      );
    }
  }
  if (statutoryConfig.payrollTax.enabled) {
    if (statutoryConfig.payrollTax.employerClass === "NOT_SET") {
      throw new Error("Choose the BVI payroll tax employer class in Settings before finalizing payroll.");
    }
    if (statutoryConfig.payrollTax.employeeRate <= 0 || statutoryConfig.payrollTax.annualExemption < 0) {
      throw new Error("Review the BVI payroll tax rate and annual exemption in Settings.");
    }
  }
}

/**
 * Loads the editable OrgSettings singleton (create-on-read with defaults) and
 * derives the statutory config + company info used when building a pay run and
 * freezing paystubs. Lives at the DB/service boundary; the pure calc functions
 * still take an explicit config.
 */
export type StatutorySourceMeta = {
  source: "statutory_rate_version" | "org_settings";
  versionId: string | null;
  approvedBy: string | null;
  sourceUrl: string | null;
};

async function loadOrgPayrollContext(schedule: PaySchedule, asOf?: Date): Promise<{
  statutoryConfig: StatutoryConfig;
  company: OrgCompanyInfo;
  statutorySource: StatutorySourceMeta;
}> {
  const org = await prisma.orgSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {}
  });

  // Effective-dated, provenance-tracked rate versions win over the mutable
  // OrgSettings singleton (Batch 11). The newest version for the period's year
  // whose optional in-year range covers the pay date drives the calculation.
  let version: StatutoryRateVersionLike | null = null;
  if (asOf) {
    const year = asOf.getUTCFullYear();
    const candidates = await prisma.statutoryRateVersion.findMany({
      where: { effectiveYear: year },
      orderBy: { createdAt: "desc" }
    });
    version = candidates.find((v) => versionCoversDate(v, asOf)) ?? null;
  }

  const company = {
    companyLegalName: org.companyLegalName,
    companyAddress: org.companyAddress
  };
  if (version) {
    return {
      statutoryConfig: statutoryConfigFromVersion(version, schedule),
      company,
      statutorySource: {
        source: "statutory_rate_version",
        versionId: version.id,
        approvedBy: version.approvedBy || null,
        sourceUrl: version.sourceUrl || null
      }
    };
  }
  return {
    statutoryConfig: statutoryConfigFromOrgSettings(org, schedule),
    company,
    statutorySource: { source: "org_settings", versionId: null, approvedBy: null, sourceUrl: null }
  };
}

export { buildRunItemsFromEntries };
export type { RunItemPayload, RunPeriodLike, RunSourceEntry } from "./payroll-run-builder.js";

const RUN_DETAIL_INCLUDE = {
  period: true,
  items: {
    include: { paystub: true },
    orderBy: { employeeName: "asc" }
  },
  exports: {
    orderBy: { createdAt: "desc" }
  }
} as const;

function parseSourceEntryIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item)).filter(Boolean);
}

function makeCsvFileName(period: { schedule: string; startDate: Date; endDate: Date }): string {
  return `payroll-${period.schedule}-${dateKey(period.startDate)}-${dateKey(period.endDate)}.csv`;
}

function buildPaystubPayload(
  period: { label: string; schedule: string; startDate: Date; endDate: Date; payDate: Date | null },
  item: {
    employeeName: string;
    employeeRole: string;
    defaultSite: string;
    templateName: string;
    gross: number;
    nhi: number;
    ssb: number;
    incomeTax: number;
    payrollTax: number;
    employerNhi: number;
    employerSsb: number;
    employerPayrollTax: number;
    manualDeductions: number;
    totalDeductions: number;
    net: number;
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
    bonus: number;
    allowance: number;
    flatGross: number;
    advanceDeduction: number;
    withdrawalDeduction: number;
    loanDeduction: number;
    otherDeduction: number;
    sourceSummary: Prisma.JsonValue | null;
  },
  company: OrgCompanyInfo
): Prisma.InputJsonValue {
  return {
    company: {
      legalName: company.companyLegalName,
      address: company.companyAddress
    },
    employeeName: item.employeeName,
    employeeRole: item.employeeRole,
    site: item.defaultSite,
    templateName: item.templateName,
    periodLabel: period.label,
    schedule: period.schedule,
    startDate: dateKey(period.startDate),
    endDate: dateKey(period.endDate),
    payDate: period.payDate ? dateKey(period.payDate) : null,
    earnings: {
      gross: roundMoney(item.gross),
      bonus: roundMoney(item.bonus),
      allowance: roundMoney(item.allowance),
      flatGross: roundMoney(item.flatGross)
    },
    deductions: {
      nhi: roundMoney(item.nhi),
      ssb: roundMoney(item.ssb),
      incomeTax: roundMoney(item.incomeTax),
      payrollTax: roundMoney(item.payrollTax),
      manual: roundMoney(item.manualDeductions),
      advance: roundMoney(item.advanceDeduction),
      withdrawal: roundMoney(item.withdrawalDeduction),
      loan: roundMoney(item.loanDeduction),
      other: roundMoney(item.otherDeduction),
      total: roundMoney(item.totalDeductions)
    },
    employerContributions: {
      nhi: roundMoney(item.employerNhi),
      ssb: roundMoney(item.employerSsb),
      payrollTax: roundMoney(item.employerPayrollTax),
      total: roundMoney(item.employerNhi + item.employerSsb + item.employerPayrollTax)
    },
    totals: {
      daysWorked: roundMoney(item.daysWorked),
      hoursWorked: roundMoney(item.hoursWorked),
      overtimeHours: roundMoney(item.overtimeHours),
      net: roundMoney(item.net)
    },
    sources: item.sourceSummary
  };
}

function summarizeRunItems(
  items: Array<{
    gross: number;
    totalDeductions: number;
    net: number;
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
  }>
) {
  const totals = items.reduce<{
    count: number;
    gross: number;
    totalDeductions: number;
    net: number;
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
  }>(
    (acc, item) => ({
      count: acc.count + 1,
      gross: acc.gross + item.gross,
      totalDeductions: acc.totalDeductions + item.totalDeductions,
      net: acc.net + item.net,
      daysWorked: acc.daysWorked + item.daysWorked,
      hoursWorked: acc.hoursWorked + item.hoursWorked,
      overtimeHours: acc.overtimeHours + item.overtimeHours
    }),
    { count: 0, gross: 0, totalDeductions: 0, net: 0, daysWorked: 0, hoursWorked: 0, overtimeHours: 0 }
  );
  return {
    count: totals.count,
    gross: roundMoney(totals.gross),
    totalDeductions: roundMoney(totals.totalDeductions),
    net: roundMoney(totals.net),
    daysWorked: roundMoney(totals.daysWorked),
    hoursWorked: roundMoney(totals.hoursWorked),
    overtimeHours: roundMoney(totals.overtimeHours)
  };
}

async function buildRunItemPayloads(period: {
  id: string;
  label: string;
  schedule: PaySchedule;
  startDate: Date;
  endDate: Date;
}) {
  const approvedEntries = await prisma.timeEntry.findMany({
    where: {
      status: TimeEntryStatus.approved,
      employee: {
        paySchedule: period.schedule,
        AND: [
          { OR: [{ employmentStartDate: null }, { employmentStartDate: { lte: period.endDate } }] },
          { OR: [{ employmentEndDate: null }, { employmentEndDate: { gte: period.startDate } }] }
        ]
      }
    },
    include: {
      employee: { select: employeeForNestedTimeContextSelect },
      template: true
    },
    orderBy: [{ employee: { fullName: "asc" } }, { site: "asc" }]
  });

  const fixedEmployees = await prisma.employee.findMany({
    where: {
      paySchedule: period.schedule,
      basePayType: "fixed",
      AND: [
        { OR: [{ employmentStartDate: null }, { employmentStartDate: { lte: period.endDate } }] },
        { OR: [{ employmentEndDate: null }, { employmentEndDate: { gte: period.startDate } }] }
      ]
    },
    select: {
      ...employeeForNestedTimeContextSelect,
      template: { select: { name: true } }
    }
  });

  const employeeIds = [
    ...new Set([
      ...approvedEntries.map((entry) => entry.employeeId),
      ...fixedEmployees.map((employee) => employee.id)
    ])
  ];
  const yearStart = new Date(Date.UTC(period.startDate.getUTCFullYear(), 0, 1));
  const priorGrossRows = employeeIds.length
    ? await prisma.payRunItem.groupBy({
        by: ["employeeId"],
        where: {
          employeeId: { in: employeeIds },
          run: {
            status: { in: [PayRunStatus.finalized, PayRunStatus.exported, PayRunStatus.paid] },
            period: { startDate: { gte: yearStart, lt: period.startDate } }
          }
        },
        _sum: { gross: true }
      })
    : [];
  const yearToDateGrossByEmployee = new Map(
    priorGrossRows.map((row) => [row.employeeId, row._sum.gross ?? 0])
  );
  const openingGrossByEmployee = await loadYtdOpeningGrossByEmployee(
    employeeIds,
    period.startDate.getUTCFullYear()
  );
  for (const [employeeId, openingGross] of openingGrossByEmployee) {
    yearToDateGrossByEmployee.set(employeeId, (yearToDateGrossByEmployee.get(employeeId) ?? 0) + openingGross);
  }

  const { statutoryConfig } = await loadOrgPayrollContext(period.schedule, period.startDate);
  const unpaidLeaveDaysByEmployee = await loadUnpaidLeaveDaysByEmployee(employeeIds, period);
  return buildRunItemsFromEntries(period, approvedEntries, statutoryConfig, {
    fixedEmployees: fixedEmployees.map((employee) => ({
      ...employee,
      templateName: employee.template.name
    })),
    yearToDateGrossByEmployee,
    unpaidLeaveDaysByEmployee
  });
}

async function loadRun(runId: string) {
  return prisma.payRun.findUnique({
    where: { id: runId },
    include: RUN_DETAIL_INCLUDE
  });
}

async function replaceDraftRunItems(runId: string, items: Awaited<ReturnType<typeof buildRunItemPayloads>>) {
  await prisma.$transaction(async (tx) => {
    await tx.paystub.deleteMany({
      where: {
        payRunItem: {
          runId
        }
      }
    });
    await tx.payRunItem.deleteMany({ where: { runId } });
    for (const item of items) {
      await tx.payRunItem.create({
        data: {
          runId,
          ...item,
          sourceEntryIds: item.sourceEntryIds as Prisma.InputJsonValue,
          sourceSummary: item.sourceSummary as Prisma.InputJsonValue
        }
      });
    }
  });
}

export async function createDraftRun(periodId: string, notes = "") {
  const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    throw new Error("Pay period not found.");
  }
  const existing = await prisma.payRun.count({
    where: { periodId, status: { not: PayRunStatus.void } }
  });
  if (existing > 0) {
    throw new Error("A pay run already exists for this period.");
  }
  const items = await buildRunItemPayloads(period);
  const run = await prisma.payRun
    .create({
      data: { periodId, notes },
      include: RUN_DETAIL_INCLUDE
    })
    .catch((e) => {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new Error("A pay run already exists for this period.");
      }
      throw e;
    });
  await replaceDraftRunItems(run.id, items);
  return loadRun(run.id);
}

export async function rebuildDraftRun(runId: string) {
  const run = await prisma.payRun.findUnique({
    where: { id: runId },
    include: { period: true }
  });
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status !== PayRunStatus.draft) {
    throw new Error("Only draft pay runs can be rebuilt.");
  }
  const items = await buildRunItemPayloads(run.period);
  await replaceDraftRunItems(runId, items);
  return loadRun(runId);
}

export async function previewPaystubs(periodId: string) {
  const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
  if (!period) {
    throw new Error("Pay period not found.");
  }

  const items = await buildRunItemPayloads(period);
  const { company } = await loadOrgPayrollContext(period.schedule, period.startDate);
  const periodWithLabel = {
    ...period,
    label: period.label || buildPeriodLabel(period)
  };

  return {
    period: periodWithLabel,
    items: items.map((item) => ({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      payload: buildPaystubPayload(periodWithLabel, item, company)
    }))
  };
}

export async function finalizeRun(runId: string) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status !== PayRunStatus.draft) {
    throw new Error("Only draft pay runs can be finalized.");
  }
  if (run.items.length === 0) {
    throw new Error("Cannot finalize an empty pay run.");
  }

  const { company, statutoryConfig, statutorySource } = await loadOrgPayrollContext(run.period.schedule, run.period.startDate);
  assertPayrollSettingsReady(company, statutoryConfig);
  if (statutorySource.source === "statutory_rate_version" && !statutorySource.approvedBy) {
    throw new Error(
      "The statutory rate version for this period is not approved. Record the verifier and owner approval in Settings before finalizing payroll."
    );
  }
  if (run.period.startDate.getUTCFullYear() !== statutoryConfig.effectiveYear) {
    throw new Error(
      `Settings are approved for ${statutoryConfig.effectiveYear}, but this pay period starts in ${run.period.startDate.getUTCFullYear()}. Review the statutory year before finalizing.`
    );
  }
  if (run.items.some((item) => item.net < 0)) {
    throw new Error("One or more employees has negative net pay. Correct deductions and rebuild the run.");
  }

  const recalculated = await buildRunItemPayloads(run.period);
  const currentSignature = run.items.map((item) => ({
    employeeId: item.employeeId,
    gross: item.gross,
    totalDeductions: item.totalDeductions,
    net: item.net
  }));
  const recalculatedSignature = recalculated.map((item) => ({
    employeeId: item.employeeId,
    gross: item.gross,
    totalDeductions: item.totalDeductions,
    net: item.net
  }));
  if (JSON.stringify(currentSignature) !== JSON.stringify(recalculatedSignature)) {
    throw new Error("Payroll inputs or settings changed after this draft was built. Rebuild and review the run before finalizing.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payRun.update({
      where: { id: runId },
      data: {
        status: PayRunStatus.finalized,
        finalizedAt: new Date(),
        statutorySnapshot: {
          config: statutoryConfig,
          source: statutorySource,
          frozenAt: new Date().toISOString()
        } as unknown as Prisma.InputJsonValue
      }
    });
    const issuedAt = new Date();
    for (const item of run.items) {
      await tx.paystub.upsert({
        where: { payRunItemId: item.id },
        update: {
          issuedAt,
          payload: buildPaystubPayload(run.period, item, company)
        },
        create: {
          payRunItemId: item.id,
          stubNumber: createPaystubNumber(run.id, item.id),
          issuedAt,
          payload: buildPaystubPayload(run.period, item, company)
        }
      });
    }

    // GL: post the payroll accrual journal (idempotent by sourceKey).
    const glAccounts = await ensureControlAccounts(tx);
    await postJournal(
      tx,
      buildPayrollRunJournal(
        {
          id: run.id,
          periodLabel: run.period.label,
          payDate: run.period.payDate ?? run.period.endDate,
          items: run.items
        },
        glAccounts
      )
    );
  });

  return loadRun(runId);
}

export async function createRunExport(runId: string) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status === PayRunStatus.draft) {
    throw new Error("Finalize the pay run before exporting.");
  }
  if (run.items.length === 0) {
    throw new Error("Cannot export an empty pay run.");
  }

  const csv = buildPayrollCsv({
    label: run.period.label || buildPeriodLabel(run.period),
    schedule: run.period.schedule,
    payDate: run.period.payDate,
    items: run.items
  });
  const fileName = makeCsvFileName(run.period);

  const exportRow = await prisma.payrollExport.create({
    data: {
      runId,
      format: "csv",
      fileName,
      contents: csv
    }
  });

  await prisma.payRun.update({
    where: { id: runId },
    data: {
      status: run.status === PayRunStatus.paid ? PayRunStatus.paid : PayRunStatus.exported,
      exportedAt: new Date()
    }
  });

  return {
    exportRow,
    csv,
    fileName,
    run: await loadRun(runId)
  };
}

export async function markRunPaid(runId: string) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status === PayRunStatus.paid) {
    throw new Error("This pay run is already marked paid.");
  }
  // Policy: a run must have at least one export (PayrollExport) on file before it
  // can be marked paid, so every payment is backed by an immutable export.
  if (run.status === PayRunStatus.draft) {
    throw new Error("Finalize and export the pay run before marking it paid.");
  }
  if (run.exports.length === 0) {
    throw new Error("Export the pay run before marking it paid.");
  }

  const sourceEntryIds = [...new Set(run.items.flatMap((item) => parseSourceEntryIds(item.sourceEntryIds)))];

  await prisma.$transaction(async (tx) => {
    if (sourceEntryIds.length > 0) {
      await tx.timeEntry.updateMany({
        where: {
          id: { in: sourceEntryIds },
          status: TimeEntryStatus.approved
        },
        data: { status: TimeEntryStatus.paid }
      });
    }
    await tx.payRun.update({
      where: { id: runId },
      data: {
        status: PayRunStatus.paid,
        paidAt: new Date()
      }
    });
    // GL: settle net wages against cash in the same transaction (idempotent).
    const glAccounts = await ensureControlAccounts(tx);
    const cashAccountId = await findAccountIdByCode(tx, "1000");
    await postJournal(
      tx,
      buildPayrollSettlementJournal(
        {
          id: run.id,
          periodLabel: run.period.label,
          payDate: new Date(),
          items: run.items
        },
        glAccounts,
        cashAccountId
      )
    );
  });

  return loadRun(runId);
}

/**
 * Records that the run's NHI/SSB/payroll-tax liabilities were remitted to the
 * authorities: clears the liability control accounts against cash (idempotent,
 * reversal-only corrections). Requires a finalized (or later) run.
 */
export async function remitRunStatutory(runId: string) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status === PayRunStatus.draft) {
    throw new Error("Finalize the pay run before recording a statutory remittance.");
  }
  if (run.status === PayRunStatus.void) {
    throw new Error("A voided pay run cannot be remitted.");
  }
  if (run.statutoryRemittedAt) {
    throw new Error("Statutory remittance for this pay run is already recorded.");
  }

  await prisma.$transaction(async (tx) => {
    const glAccounts = await ensureControlAccounts(tx);
    const cashAccountId = await findAccountIdByCode(tx, "1000");
    await postJournal(
      tx,
      buildPayrollRemittanceJournal(
        {
          id: run.id,
          periodLabel: run.period.label,
          payDate: new Date(),
          items: run.items
        },
        glAccounts,
        cashAccountId
      )
    );
    await tx.payRun.update({
      where: { id: runId },
      data: { statutoryRemittedAt: new Date() }
    });
  });

  return loadRun(runId);
}

export async function voidRun(runId: string, options: { reversePaid?: boolean } = {}) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status === PayRunStatus.void) {
    throw new Error("This pay run is already void.");
  }
  if (run.status === PayRunStatus.paid && !options.reversePaid) {
    throw new Error(
      "This pay run is already paid. Confirm the reversal to void it and revert its time entries."
    );
  }

  const sourceEntryIds = [...new Set(run.items.flatMap((item) => parseSourceEntryIds(item.sourceEntryIds)))];

  await prisma.$transaction(async (tx) => {
    await tx.paystub.deleteMany({
      where: { payRunItem: { runId } }
    });
    if (run.status === PayRunStatus.paid && sourceEntryIds.length > 0) {
      await tx.timeEntry.updateMany({
        where: { id: { in: sourceEntryIds }, status: TimeEntryStatus.paid },
        data: { status: TimeEntryStatus.approved }
      });
    }
    // GL: reverse the accrual journal if this run was finalized after the
    // ledger went live (no-op for pre-GL runs).
    await reverseJournal(tx, "payroll_run", runId, {
      date: new Date(),
      memo: `Payroll run voided — reversal (${run.period.label})`
    });
    // Reverse the payment settlement and statutory remittance when present
    // (no-ops for runs that never reached those states).
    await reverseJournal(tx, "payroll_run_paid", runId, {
      date: new Date(),
      memo: `Payroll payment voided — reversal (${run.period.label})`
    });
    await reverseJournal(tx, "payroll_statutory_remittance", runId, {
      date: new Date(),
      memo: `Statutory remittance voided — reversal (${run.period.label})`
    });
    await tx.payRun.update({
      where: { id: runId },
      data: {
        status: PayRunStatus.void,
        voidedAt: new Date()
      }
    });
  });

  return loadRun(runId);
}

export async function deleteDraftRun(runId: string) {
  const run = await prisma.payRun.findUnique({ where: { id: runId } });
  if (!run) {
    throw new Error("Pay run not found.");
  }
  if (run.status !== PayRunStatus.draft) {
    throw new Error("Only draft pay runs can be deleted. Void a finalized run instead.");
  }
  await prisma.payRun.delete({ where: { id: runId } });
  return run;
}

export async function getRunExport(runId: string, exportId: string) {
  const exportRow = await prisma.payrollExport.findFirst({
    where: { id: exportId, runId }
  });
  if (!exportRow) {
    throw new Error("Export not found.");
  }
  return exportRow;
}

export async function getRunDetail(runId: string) {
  const run = await loadRun(runId);
  if (!run) {
    throw new Error("Pay run not found.");
  }
  return {
    ...run,
    summary: summarizeRunItems(run.items)
  };
}

const EMPLOYEE_VISIBLE_RUN_STATUSES = [
  PayRunStatus.finalized,
  PayRunStatus.exported,
  PayRunStatus.paid
] as const;

export async function listEmployeePaystubs(employeeId: string) {
  const stubs = await prisma.paystub.findMany({
    where: {
      payRunItem: {
        employeeId,
        run: { status: { in: [...EMPLOYEE_VISIBLE_RUN_STATUSES] } }
      }
    },
    include: {
      payRunItem: {
        include: { run: { include: { period: true } } }
      }
    },
    orderBy: { issuedAt: "desc" }
  });
  return stubs.map((stub) => {
    const period = stub.payRunItem.run.period;
    return {
      id: stub.id,
      stubNumber: stub.stubNumber,
      issuedAt: stub.issuedAt,
      periodLabel: period.label || buildPeriodLabel(period),
      startDate: period.startDate,
      endDate: period.endDate,
      gross: stub.payRunItem.gross,
      net: stub.payRunItem.net
    };
  });
}

export async function getEmployeePaystub(employeeId: string, paystubId: string) {
  const paystub = await prisma.paystub.findUnique({
    where: { id: paystubId },
    include: {
      payRunItem: {
        include: { run: { include: { period: true } } }
      }
    }
  });
  if (
    !paystub ||
    paystub.payRunItem.employeeId !== employeeId ||
    paystub.payRunItem.run.status === PayRunStatus.draft ||
    paystub.payRunItem.run.status === PayRunStatus.void
  ) {
    return null;
  }
  return paystub;
}

export async function getPaystubDetail(paystubId: string) {
  const paystub = await prisma.paystub.findUnique({
    where: { id: paystubId },
    include: {
      payRunItem: {
        include: {
          run: {
            include: { period: true }
          }
        }
      }
    }
  });
  if (!paystub) {
    throw new Error("Paystub not found.");
  }
  return paystub;
}
