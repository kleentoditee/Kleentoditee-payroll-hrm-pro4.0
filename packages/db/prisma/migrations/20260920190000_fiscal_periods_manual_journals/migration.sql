-- CreateEnum
CREATE TYPE "FiscalPeriodStatus" AS ENUM ('open', 'soft_closed', 'locked');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalEntryStatus" ADD VALUE 'draft';
ALTER TYPE "JournalEntryStatus" ADD VALUE 'approved';

-- AlterTable
ALTER TABLE "DepositLine" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "fiscalYearId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FiscalYear_orgId_idx" ON "FiscalYear"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_orgId_year_key" ON "FiscalYear"("orgId", "year");

-- CreateIndex
CREATE INDEX "FiscalPeriod_orgId_idx" ON "FiscalPeriod"("orgId");

-- CreateIndex
CREATE INDEX "FiscalPeriod_startDate_endDate_idx" ON "FiscalPeriod"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalPeriod_orgId_year_period_key" ON "FiscalPeriod"("orgId", "year", "period");

-- AddForeignKey
ALTER TABLE "DepositLine" ADD CONSTRAINT "DepositLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalPeriod" ADD CONSTRAINT "FiscalPeriod_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

