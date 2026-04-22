import type { PayBasis } from "@kleentoditee/db";

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeEntryPreview(
  employee: {
    basePayType: PayBasis;
    dailyRate: number;
    hourlyRate: number;
    overtimeRate: number;
    fixedPay: number;
  },
  template: {
    nhiRate: number;
    ssbRate: number;
    incomeTaxRate: number;
  },
  entry: {
    daysWorked: number;
    hoursWorked: number;
    overtimeHours: number;
    flatGross: number;
    bonus: number;
    allowance: number;
    advanceDeduction: number;
    withdrawalDeduction: number;
    loanDeduction: number;
    otherDeduction: number;
    applyNhi: boolean;
    applySsb: boolean;
    applyIncomeTax: boolean;
  }
): {
  gross: number;
  totalDeductions: number;
  net: number;
  breakdown: { nhi: number; ssb: number; incomeTax: number; manual: number };
} {
  let gross = 0;
  const usesFlatGross = entry.flatGross > 0;

  if (usesFlatGross) {
    gross = entry.flatGross;
  } else if (employee.basePayType === "daily") {
    gross += entry.daysWorked * employee.dailyRate;
    gross += entry.hoursWorked * employee.hourlyRate;
  } else if (employee.basePayType === "hourly") {
    gross += entry.hoursWorked * employee.hourlyRate;
  } else {
    gross += employee.fixedPay;
  }

  const otRate = employee.overtimeRate || employee.hourlyRate || 0;
  gross += entry.overtimeHours * otRate;
  gross += entry.bonus + entry.allowance;

  const nhi = entry.applyNhi ? gross * template.nhiRate : 0;
  const ssb = entry.applySsb ? gross * template.ssbRate : 0;
  const incomeTax = entry.applyIncomeTax ? gross * template.incomeTaxRate : 0;
  const manual =
    entry.advanceDeduction +
    entry.withdrawalDeduction +
    entry.loanDeduction +
    entry.otherDeduction;

  const totalDeductions = roundMoney(nhi + ssb + incomeTax + manual);
  const net = roundMoney(gross - totalDeductions);

  return {
    gross: roundMoney(gross),
    totalDeductions,
    net,
    breakdown: {
      nhi: roundMoney(nhi),
      ssb: roundMoney(ssb),
      incomeTax: roundMoney(incomeTax),
      manual: roundMoney(manual)
    }
  };
}
