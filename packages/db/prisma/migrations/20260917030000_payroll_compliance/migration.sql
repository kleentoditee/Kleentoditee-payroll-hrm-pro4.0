-- AddEnum
CREATE TYPE "PayrollTaxClass" AS ENUM ('NOT_SET', 'CLASS_1', 'CLASS_2');

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "payrollTaxExemptionEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "OrgSettings"
ADD COLUMN "ssbAnnualCeiling" DOUBLE PRECISION NOT NULL DEFAULT 53400,
ADD COLUMN "nhiAnnualCeiling" DOUBLE PRECISION NOT NULL DEFAULT 106800,
ADD COLUMN "payrollTaxEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "payrollTaxEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
ADD COLUMN "payrollTaxEmployerClass" "PayrollTaxClass" NOT NULL DEFAULT 'NOT_SET',
ADD COLUMN "payrollTaxAnnualExemption" DOUBLE PRECISION NOT NULL DEFAULT 10000,
ADD COLUMN "statutoryEffectiveYear" INTEGER NOT NULL DEFAULT 2026;

UPDATE "OrgSettings"
SET "ssbEmployeeRate" = 0.04,
    "ssbEmployerRate" = 0.045,
    "ssbAnnualCeiling" = 53400,
    "nhiEmployeeRate" = 0.0375,
    "nhiEmployerRate" = 0.0375,
    "nhiAnnualCeiling" = 106800
WHERE "id" = 'singleton'
  AND "ssbEmployeeRate" = 0
  AND "ssbEmployerRate" = 0
  AND "nhiEmployeeRate" = 0
  AND "nhiEmployerRate" = 0;

UPDATE "OrgSettings"
SET "ssbEmployeeRate" = CASE WHEN "ssbEmployeeRate" > 1 THEN "ssbEmployeeRate" / 100 ELSE "ssbEmployeeRate" END,
    "ssbEmployerRate" = CASE WHEN "ssbEmployerRate" > 1 THEN "ssbEmployerRate" / 100 ELSE "ssbEmployerRate" END,
    "nhiEmployeeRate" = CASE WHEN "nhiEmployeeRate" > 1 THEN "nhiEmployeeRate" / 100 ELSE "nhiEmployeeRate" END,
    "nhiEmployerRate" = CASE WHEN "nhiEmployerRate" > 1 THEN "nhiEmployerRate" / 100 ELSE "nhiEmployerRate" END;

-- AlterTable
ALTER TABLE "PayRun"
ADD COLUMN "statutorySnapshot" JSONB;

-- AlterTable
ALTER TABLE "PayRunItem"
ADD COLUMN "payrollTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "employerNhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "employerSsb" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "employerPayrollTax" DOUBLE PRECISION NOT NULL DEFAULT 0;
