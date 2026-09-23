-- Batch 10 baseline: models previously applied via db push (Batches 1/2/3/5/8):
-- StatutoryRateVersion, AuthRateLimit, PayrollYtdOpeningBalance, LeavePolicy + leave fields,
-- JournalEntry/JournalLine, PayRun.void/voidedAt, PayRunItem unpaid-leave fields.
-- Proven by replaying migrations 1-8 + this file in a scratch postgres and hash-comparing
-- the resulting catalog against the live database (537 columns + 97 enum labels identical).

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('posted', 'void');

-- AlterEnum
ALTER TYPE "PayRunStatus" ADD VALUE 'void';

-- AlterEnum
ALTER TYPE "StaffRequestType" ADD VALUE 'UNPAID_LEAVE';

-- AlterTable
ALTER TABLE "PayRun" ADD COLUMN     "voidedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PayRunItem" ADD COLUMN     "unpaidLeaveDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unpaidLeaveDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'posted',
    "reversalOfId" TEXT,
    "createdByUserId" TEXT,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatutoryRateVersion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "effectiveYear" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "ssbEmployeeRate" DOUBLE PRECISION NOT NULL,
    "ssbEmployerRate" DOUBLE PRECISION NOT NULL,
    "ssbAnnualCeiling" DOUBLE PRECISION NOT NULL,
    "ssbEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nhiEmployeeRate" DOUBLE PRECISION NOT NULL,
    "nhiEmployerRate" DOUBLE PRECISION NOT NULL,
    "nhiAnnualCeiling" DOUBLE PRECISION NOT NULL,
    "nhiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payrollTaxEmployeeRate" DOUBLE PRECISION NOT NULL,
    "payrollTaxEmployerClass" "PayrollTaxClass" NOT NULL DEFAULT 'NOT_SET',
    "payrollTaxAnnualExemption" DOUBLE PRECISION NOT NULL,
    "payrollTaxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT NOT NULL DEFAULT '',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "StatutoryRateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthRateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollYtdOpeningBalance" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payrollTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerNhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerSsb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employerPayrollTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'csv-import',
    "notes" TEXT NOT NULL DEFAULT '',
    "importedBy" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PayrollYtdOpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requestType" "StaffRequestType" NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT true,
    "annualAllowanceDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_sourceKey_key" ON "JournalEntry"("sourceKey");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_sourceType_sourceId_idx" ON "JournalEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "JournalEntry_status_idx" ON "JournalEntry"("status");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_position_idx" ON "JournalLine"("entryId", "position");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- CreateIndex
CREATE INDEX "StatutoryRateVersion_effectiveYear_idx" ON "StatutoryRateVersion"("effectiveYear");

-- CreateIndex
CREATE UNIQUE INDEX "AuthRateLimit_key_key" ON "AuthRateLimit"("key");

-- CreateIndex
CREATE INDEX "AuthRateLimit_resetAt_idx" ON "AuthRateLimit"("resetAt");

-- CreateIndex
CREATE INDEX "PayrollYtdOpeningBalance_year_idx" ON "PayrollYtdOpeningBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollYtdOpeningBalance_employeeId_year_key" ON "PayrollYtdOpeningBalance"("employeeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_code_key" ON "LeavePolicy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_requestType_key" ON "LeavePolicy"("requestType");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollYtdOpeningBalance" ADD CONSTRAINT "PayrollYtdOpeningBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

