export type StatutoryFormSettings = {
  companyLegalName: string;
  companyAddress: string;
  ssbEmployerNumber: string;
  nhiEmployerNumber: string;
  statutorySignatureDataUrl: string;
};

export type StatutoryFormRun = {
  id: string;
  period: {
    schedule: "weekly" | "biweekly" | "monthly";
    endDate: Date;
    payDate: Date | null;
  };
  items: Array<{
    employeeId: string;
    employeeName: string;
    gross: number;
    nhi: number;
    ssb: number;
    employerNhi: number;
    employerSsb: number;
    daysWorked: number;
    employee: {
      fullName: string;
      sex: string;
      socialSecurityNumber: string;
      nationalHealthInsuranceNumber: string;
      nhiUnemployedSpouse: boolean;
    };
  }>;
};

export type StatutoryFormEmployee = {
  id: string;
  fullName: string;
  sex: string;
  socialSecurityNumber: string;
  nationalHealthInsuranceNumber: string;
  nhiUnemployedSpouse: boolean;
};

type ContributionTotals = {
  earnings: number;
  employee: number;
  employer: number;
  total: number;
  weeklyEmployee: number[];
  weeklyEmployer: number[];
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function addMoney(current: number, value: number): number {
  return money(current + value);
}

function weekSlot(run: StatutoryFormRun): number {
  if (run.period.schedule === "monthly") return 4;
  const date = run.period.payDate ?? run.period.endDate;
  return Math.min(4, Math.floor((date.getUTCDate() - 1) / 7));
}

function weeksForItem(schedule: StatutoryFormRun["period"]["schedule"], daysWorked: number, gross: number): number {
  if (gross <= 0) return 0;
  if (daysWorked > 0) return Math.min(5, Math.max(1, Math.ceil(daysWorked / 5)));
  if (schedule === "weekly") return 1;
  if (schedule === "biweekly") return 2;
  return 4;
}

export function buildStatutoryForms(
  settings: StatutoryFormSettings,
  runs: StatutoryFormRun[],
  month: string,
  currentEmployees: StatutoryFormEmployee[] = []
) {
  const employees = new Map<string, {
    employeeId: string;
    employeeName: string;
    sex: string;
    ssbNumber: string;
    nhiNumber: string;
    nhiUnemployedSpouse: boolean;
    weeklyEarnings: number[];
    weeksWorked: number;
    ssb: ContributionTotals;
    nhi: ContributionTotals & { unemployedSpouse: number; weeklyUnemployedSpouse: number[] };
    missing: string[];
  }>();

  function addEmployee(employee: StatutoryFormEmployee) {
    if (employees.has(employee.id)) return employees.get(employee.id)!;
    const row = {
      employeeId: employee.id,
      employeeName: employee.fullName,
      sex: employee.sex,
      ssbNumber: employee.socialSecurityNumber,
      nhiNumber: employee.nationalHealthInsuranceNumber,
      nhiUnemployedSpouse: employee.nhiUnemployedSpouse,
      weeklyEarnings: [0, 0, 0, 0, 0],
      weeksWorked: 0,
      ssb: { earnings: 0, employee: 0, employer: 0, total: 0, weeklyEmployee: [0, 0, 0, 0, 0], weeklyEmployer: [0, 0, 0, 0, 0] },
      nhi: {
        earnings: 0,
        employee: 0,
        employer: 0,
        total: 0,
        weeklyEmployee: [0, 0, 0, 0, 0],
        weeklyEmployer: [0, 0, 0, 0, 0],
        unemployedSpouse: 0,
        weeklyUnemployedSpouse: [0, 0, 0, 0, 0]
      },
      missing: [] as string[]
    };
    employees.set(employee.id, row);
    return row;
  }

  currentEmployees.forEach(addEmployee);

  for (const run of runs) {
    const slot = weekSlot(run);
    for (const item of run.items) {
      let row = employees.get(item.employeeId);
      if (!row) {
        row = addEmployee({
          id: item.employeeId,
          fullName: item.employee.fullName || item.employeeName,
          sex: item.employee.sex,
          socialSecurityNumber: item.employee.socialSecurityNumber,
          nationalHealthInsuranceNumber: item.employee.nationalHealthInsuranceNumber,
          nhiUnemployedSpouse: item.employee.nhiUnemployedSpouse
        });
      }

      row.weeklyEarnings[slot] = addMoney(row.weeklyEarnings[slot], item.gross);
      row.weeksWorked = Math.min(5, row.weeksWorked + weeksForItem(run.period.schedule, item.daysWorked, item.gross));
      row.ssb.earnings = addMoney(row.ssb.earnings, item.gross);
      row.ssb.employee = addMoney(row.ssb.employee, item.ssb);
      row.ssb.employer = addMoney(row.ssb.employer, item.employerSsb);
      row.ssb.weeklyEmployee[slot] = addMoney(row.ssb.weeklyEmployee[slot], item.ssb);
      row.ssb.weeklyEmployer[slot] = addMoney(row.ssb.weeklyEmployer[slot], item.employerSsb);
      row.ssb.total = addMoney(row.ssb.employee, row.ssb.employer);
      row.nhi.earnings = addMoney(row.nhi.earnings, item.gross);
      row.nhi.employee = addMoney(row.nhi.employee, item.nhi);
      row.nhi.employer = addMoney(row.nhi.employer, item.employerNhi);
      row.nhi.weeklyEmployee[slot] = addMoney(row.nhi.weeklyEmployee[slot], item.nhi);
      row.nhi.weeklyEmployer[slot] = addMoney(row.nhi.weeklyEmployer[slot], item.employerNhi);
      row.nhi.total = addMoney(row.nhi.employee, row.nhi.employer);
      if (row.nhiUnemployedSpouse) {
        row.nhi.unemployedSpouse = addMoney(row.nhi.unemployedSpouse, item.nhi);
        row.nhi.weeklyUnemployedSpouse[slot] = addMoney(row.nhi.weeklyUnemployedSpouse[slot], item.nhi);
      }
    }
  }

  const rows = [...employees.values()]
    .map((row) => ({
      ...row,
      missing: [
        ...(row.sex === "M" || row.sex === "F" ? [] : ["Sex"]),
        ...(row.ssbNumber.trim() ? [] : ["SSB number"]),
        ...(row.nhiNumber.trim() ? [] : ["NHI number"])
      ]
    }))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  const companyMissing = [
    ...(settings.companyLegalName.trim() ? [] : ["Company legal name"]),
    ...(settings.ssbEmployerNumber.trim() ? [] : ["SSB employer number"]),
    ...(settings.nhiEmployerNumber.trim() ? [] : ["NHI employer number"])
  ];

  return {
    month,
    sourceRunCount: runs.length,
    company: settings,
    companyMissing,
    rows,
    totals: rows.reduce(
      (totals, row) => ({
        ssb: {
          earnings: addMoney(totals.ssb.earnings, row.ssb.earnings),
          employee: addMoney(totals.ssb.employee, row.ssb.employee),
          employer: addMoney(totals.ssb.employer, row.ssb.employer),
          total: addMoney(totals.ssb.total, row.ssb.total),
          weeklyEmployee: totals.ssb.weeklyEmployee.map((value, index) => addMoney(value, row.ssb.weeklyEmployee[index])),
          weeklyEmployer: totals.ssb.weeklyEmployer.map((value, index) => addMoney(value, row.ssb.weeklyEmployer[index]))
        },
        nhi: {
          earnings: addMoney(totals.nhi.earnings, row.nhi.earnings),
          employee: addMoney(totals.nhi.employee, row.nhi.employee),
          employer: addMoney(totals.nhi.employer, row.nhi.employer),
          total: addMoney(totals.nhi.total, row.nhi.total),
          weeklyEmployee: totals.nhi.weeklyEmployee.map((value, index) => addMoney(value, row.nhi.weeklyEmployee[index])),
          weeklyEmployer: totals.nhi.weeklyEmployer.map((value, index) => addMoney(value, row.nhi.weeklyEmployer[index])),
          unemployedSpouse: addMoney(totals.nhi.unemployedSpouse, row.nhi.unemployedSpouse),
          weeklyUnemployedSpouse: totals.nhi.weeklyUnemployedSpouse.map((value, index) => addMoney(value, row.nhi.weeklyUnemployedSpouse[index]))
        }
      }),
      {
        ssb: { earnings: 0, employee: 0, employer: 0, total: 0, weeklyEmployee: [0, 0, 0, 0, 0], weeklyEmployer: [0, 0, 0, 0, 0] },
        nhi: {
          earnings: 0,
          employee: 0,
          employer: 0,
          total: 0,
          weeklyEmployee: [0, 0, 0, 0, 0],
          weeklyEmployer: [0, 0, 0, 0, 0],
          unemployedSpouse: 0,
          weeklyUnemployedSpouse: [0, 0, 0, 0, 0]
        }
      }
    )
  };
}
