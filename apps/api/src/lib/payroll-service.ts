import { PayRunStatus, Prisma, TimeEntryStatus, prisma } from "@kleentoditee/db";
import { employeeForNestedTimeContextSelect } from "./employee-privacy.js";
import { computeEntryPreview, roundMoney } from "./payroll-calc.js";
import {
  buildPayrollCsv,
  buildPeriodLabel,
  createPaystubNumber,
  dateKey,
  isTimeEntryWithinPeriod
} from "./payroll-utils.js";

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
  }
): Prisma.InputJsonValue {
  return {
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
      manual: roundMoney(item.manualDeductions),
      advance: roundMoney(item.advanceDeduction),
      withdrawal: roundMoney(item.withdrawalDeduction),
      loan: roundMoney(item.loanDeduction),
      other: roundMoney(item.otherDeduction),
      total: roundMoney(item.totalDeductions)
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
  schedule: "weekly" | "biweekly" | "monthly";
  startDate: Date;
  endDate: Date;
}) {
  const approvedEntries = await prisma.timeEntry.findMany({
    where: {
      status: TimeEntryStatus.approved,
      employee: {
        active: true,
        paySchedule: period.schedule
      }
    },
    include: {
      employee: { select: employeeForNestedTimeContextSelect },
      template: true
    },
    orderBy: [{ employee: { fullName: "asc" } }, { site: "asc" }]
  });

  const matchingEntries = approvedEntries.filter((entry) =>
    isTimeEntryWithinPeriod(period, {
      month: entry.month,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd
    })
  );

  const grouped = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      employeeRole: string;
      defaultSite: string;
      paySchedule: "weekly" | "biweekly" | "monthly";
      payBasis: "daily" | "hourly" | "fixed";
      templateNames: Set<string>;
      sourceEntryIds: string[];
      sourceSummary: Array<{
        entryId: string;
        month: string;
        periodStart: string | null;
        periodEnd: string | null;
        site: string;
        daysWorked: number;
        hoursWorked: number;
        overtimeHours: number;
        gross: number;
        net: number;
      }>;
      gross: number;
      nhi: number;
      ssb: number;
      incomeTax: number;
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
    }
  >();

  for (const entry of matchingEntries) {
    const preview = computeEntryPreview(
      {
        basePayType: entry.employee.basePayType,
        dailyRate: entry.employee.dailyRate,
        hourlyRate: entry.employee.hourlyRate,
        overtimeRate: entry.employee.overtimeRate,
        fixedPay: entry.employee.fixedPay
      },
      {
        nhiRate: entry.template.nhiRate,
        ssbRate: entry.template.ssbRate,
        incomeTaxRate: entry.template.incomeTaxRate
      },
      {
        daysWorked: entry.daysWorked,
        hoursWorked: entry.hoursWorked,
        overtimeHours: entry.overtimeHours,
        flatGross: entry.flatGross,
        bonus: entry.bonus,
        allowance: entry.allowance,
        advanceDeduction: entry.advanceDeduction,
        withdrawalDeduction: entry.withdrawalDeduction,
        loanDeduction: entry.loanDeduction,
        otherDeduction: entry.otherDeduction,
        applyNhi: entry.applyNhi,
        applySsb: entry.applySsb,
        applyIncomeTax: entry.applyIncomeTax
      }
    );

    const current =
      grouped.get(entry.employeeId) ??
      {
        employeeId: entry.employeeId,
        employeeName: entry.employee.fullName,
        employeeRole: entry.employee.role,
        defaultSite: entry.employee.defaultSite,
        paySchedule: entry.employee.paySchedule,
        payBasis: entry.employee.basePayType,
        templateNames: new Set<string>(),
        sourceEntryIds: [],
        sourceSummary: [],
        gross: 0,
        nhi: 0,
        ssb: 0,
        incomeTax: 0,
        manualDeductions: 0,
        totalDeductions: 0,
        net: 0,
        daysWorked: 0,
        hoursWorked: 0,
        overtimeHours: 0,
        bonus: 0,
        allowance: 0,
        flatGross: 0,
        advanceDeduction: 0,
        withdrawalDeduction: 0,
        loanDeduction: 0,
        otherDeduction: 0
      };

    current.templateNames.add(entry.template.name);
    current.sourceEntryIds.push(entry.id);
    current.sourceSummary.push({
      entryId: entry.id,
      month: entry.month,
      periodStart: entry.periodStart ? dateKey(entry.periodStart) : null,
      periodEnd: entry.periodEnd ? dateKey(entry.periodEnd) : null,
      site: entry.site,
      daysWorked: roundMoney(entry.daysWorked),
      hoursWorked: roundMoney(entry.hoursWorked),
      overtimeHours: roundMoney(entry.overtimeHours),
      gross: roundMoney(preview.gross),
      net: roundMoney(preview.net)
    });
    current.gross += preview.gross;
    current.nhi += preview.breakdown.nhi;
    current.ssb += preview.breakdown.ssb;
    current.incomeTax += preview.breakdown.incomeTax;
    current.manualDeductions += preview.breakdown.manual;
    current.totalDeductions += preview.totalDeductions;
    current.net += preview.net;
    current.daysWorked += entry.daysWorked;
    current.hoursWorked += entry.hoursWorked;
    current.overtimeHours += entry.overtimeHours;
    current.bonus += entry.bonus;
    current.allowance += entry.allowance;
    current.flatGross += entry.flatGross;
    current.advanceDeduction += entry.advanceDeduction;
    current.withdrawalDeduction += entry.withdrawalDeduction;
    current.loanDeduction += entry.loanDeduction;
    current.otherDeduction += entry.otherDeduction;

    grouped.set(entry.employeeId, current);
  }

  return [...grouped.values()]
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    .map((item) => ({
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      employeeRole: item.employeeRole,
      defaultSite: item.defaultSite,
      paySchedule: item.paySchedule,
      payBasis: item.payBasis,
      templateName:
        item.templateNames.size === 1 ? [...item.templateNames][0] : "Multiple templates",
      sourceEntryIds: item.sourceEntryIds,
      sourceSummary: item.sourceSummary,
      gross: roundMoney(item.gross),
      nhi: roundMoney(item.nhi),
      ssb: roundMoney(item.ssb),
      incomeTax: roundMoney(item.incomeTax),
      manualDeductions: roundMoney(item.manualDeductions),
      totalDeductions: roundMoney(item.totalDeductions),
      net: roundMoney(item.net),
      daysWorked: roundMoney(item.daysWorked),
      hoursWorked: roundMoney(item.hoursWorked),
      overtimeHours: roundMoney(item.overtimeHours),
      bonus: roundMoney(item.bonus),
      allowance: roundMoney(item.allowance),
      flatGross: roundMoney(item.flatGross),
      advanceDeduction: roundMoney(item.advanceDeduction),
      withdrawalDeduction: roundMoney(item.withdrawalDeduction),
      loanDeduction: roundMoney(item.loanDeduction),
      otherDeduction: roundMoney(item.otherDeduction)
    }));
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
  const existing = await prisma.payRun.count({ where: { periodId } });
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

  await prisma.$transaction(async (tx) => {
    await tx.payRun.update({
      where: { id: runId },
      data: {
        status: PayRunStatus.finalized,
        finalizedAt: new Date()
      }
    });
    const issuedAt = new Date();
    for (const item of run.items) {
      await tx.paystub.upsert({
        where: { payRunItemId: item.id },
        update: {
          issuedAt,
          payload: buildPaystubPayload(run.period, item)
        },
        create: {
          payRunItemId: item.id,
          stubNumber: createPaystubNumber(run.id, item.id),
          issuedAt,
          payload: buildPaystubPayload(run.period, item)
        }
      });
    }
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
  if (run.status === PayRunStatus.draft) {
    throw new Error("Finalize the pay run before marking it paid.");
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
  });

  return loadRun(runId);
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
