import type { PaySchedule, PayrollTaxClass } from "@kleentoditee/db";

export type StatutoryContribution = {
  employeeRate: number;
  employerRate: number;
  periodCeiling: number;
  enabled: boolean;
};

export type PayrollTaxConfig = {
  employeeRate: number;
  employerRate: number;
  annualExemption: number;
  employerClass: PayrollTaxClass;
  enabled: boolean;
};

export type StatutoryConfig = {
  socialSecurity: StatutoryContribution;
  nationalHealthInsurance: StatutoryContribution;
  payrollTax: PayrollTaxConfig;
  effectiveYear: number;
  // Retained only for legacy previews/data. BVI payroll uses payrollTax above.
  incomeTax: StatutoryContribution;
};

export const BVI_STATUTORY_DEFAULTS: StatutoryConfig = {
  socialSecurity: { employeeRate: 0.04, employerRate: 0.045, periodCeiling: 0, enabled: true },
  nationalHealthInsurance: {
    employeeRate: 0.0375,
    employerRate: 0.0375,
    periodCeiling: 0,
    enabled: true
  },
  payrollTax: {
    employeeRate: 0.08,
    employerRate: 0,
    annualExemption: 10000,
    employerClass: "NOT_SET",
    enabled: true
  },
  effectiveYear: 2026,
  incomeTax: { employeeRate: 0, employerRate: 0, periodCeiling: 0, enabled: false }
};

export type StatutoryRateInput = {
  ssbRate: number;
  nhiRate: number;
  incomeTaxRate: number;
};

export function statutoryConfigFromRates(
  rates: StatutoryRateInput,
  base: StatutoryConfig = BVI_STATUTORY_DEFAULTS
): StatutoryConfig {
  return {
    ...base,
    socialSecurity: { ...base.socialSecurity, employeeRate: rates.ssbRate },
    nationalHealthInsurance: { ...base.nationalHealthInsurance, employeeRate: rates.nhiRate },
    incomeTax: { ...base.incomeTax, employeeRate: 0, enabled: false }
  };
}

export type OrgStatutoryInput = {
  ssbEmployeeRate: number;
  ssbEmployerRate: number;
  ssbAnnualCeiling: number;
  ssbEnabled: boolean;
  nhiEmployeeRate: number;
  nhiEmployerRate: number;
  nhiAnnualCeiling: number;
  nhiEnabled: boolean;
  payrollTaxEnabled: boolean;
  payrollTaxEmployeeRate: number;
  payrollTaxEmployerClass: PayrollTaxClass;
  payrollTaxAnnualExemption: number;
  statutoryEffectiveYear: number;
};

export function annualCeilingForSchedule(annual: number, schedule: PaySchedule): number {
  if (annual <= 0) return 0;
  const periods = schedule === "weekly" ? 52 : schedule === "biweekly" ? 26 : 12;
  return annual / periods;
}

export function employerPayrollTaxRate(employerClass: PayrollTaxClass): number {
  if (employerClass === "CLASS_1") return 0.02;
  if (employerClass === "CLASS_2") return 0.06;
  return 0;
}

export function statutoryConfigFromOrgSettings(
  org: OrgStatutoryInput,
  schedule: PaySchedule
): StatutoryConfig {
  return {
    socialSecurity: {
      employeeRate: org.ssbEmployeeRate,
      employerRate: org.ssbEmployerRate,
      periodCeiling: annualCeilingForSchedule(org.ssbAnnualCeiling, schedule),
      enabled: org.ssbEnabled
    },
    nationalHealthInsurance: {
      employeeRate: org.nhiEmployeeRate,
      employerRate: org.nhiEmployerRate,
      periodCeiling: annualCeilingForSchedule(org.nhiAnnualCeiling, schedule),
      enabled: org.nhiEnabled
    },
    payrollTax: {
      employeeRate: org.payrollTaxEmployeeRate,
      employerRate: employerPayrollTaxRate(org.payrollTaxEmployerClass),
      annualExemption: org.payrollTaxAnnualExemption,
      employerClass: org.payrollTaxEmployerClass,
      enabled: org.payrollTaxEnabled
    },
    effectiveYear: org.statutoryEffectiveYear,
    incomeTax: { employeeRate: 0, employerRate: 0, periodCeiling: 0, enabled: false }
  };
}
export type StatutoryRateVersionLike = {
  id: string;
  effectiveYear: number;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  ssbEmployeeRate: number;
  ssbEmployerRate: number;
  ssbAnnualCeiling: number;
  ssbEnabled: boolean;
  nhiEmployeeRate: number;
  nhiEmployerRate: number;
  nhiAnnualCeiling: number;
  nhiEnabled: boolean;
  payrollTaxEmployeeRate: number;
  payrollTaxEmployerClass: PayrollTaxClass;
  payrollTaxAnnualExemption: number;
  payrollTaxEnabled: boolean;
  sourceUrl: string;
  verifiedBy: string;
  verifiedAt: Date | null;
  approvedBy: string;
  approvedAt: Date | null;
};

/** Builds the run config from a versioned, provenance-tracked statutory rate row. */
export function statutoryConfigFromVersion(
  version: StatutoryRateVersionLike,
  schedule: PaySchedule
): StatutoryConfig {
  return statutoryConfigFromOrgSettings(
    {
      ssbEmployeeRate: version.ssbEmployeeRate,
      ssbEmployerRate: version.ssbEmployerRate,
      ssbAnnualCeiling: version.ssbAnnualCeiling,
      ssbEnabled: version.ssbEnabled,
      nhiEmployeeRate: version.nhiEmployeeRate,
      nhiEmployerRate: version.nhiEmployerRate,
      nhiAnnualCeiling: version.nhiAnnualCeiling,
      nhiEnabled: version.nhiEnabled,
      payrollTaxEnabled: version.payrollTaxEnabled,
      payrollTaxEmployeeRate: version.payrollTaxEmployeeRate,
      payrollTaxEmployerClass: version.payrollTaxEmployerClass,
      payrollTaxAnnualExemption: version.payrollTaxAnnualExemption,
      statutoryEffectiveYear: version.effectiveYear
    },
    schedule
  );
}

/** True when the version covers the given pay date (explicit range wins over bare year). */
export function versionCoversDate(version: StatutoryRateVersionLike, asOf: Date): boolean {
  if (version.effectiveFrom && version.effectiveFrom > asOf) return false;
  if (version.effectiveTo && version.effectiveTo < asOf) return false;
  return true;
}
