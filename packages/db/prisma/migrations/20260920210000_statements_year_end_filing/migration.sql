-- CreateEnum
CREATE TYPE "ReportSnapshotType" AS ENUM ('profit_loss', 'balance_sheet', 'cash_flow', 'changes_in_equity', 'aging', 'payroll_liabilities', 'annual_return');

-- CreateEnum
CREATE TYPE "YearEndCloseStatus" AS ENUM ('draft', 'reviewed', 'approved', 'posted', 'superseded');

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "annualReturnExemptionBasis" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "companyRegistrationNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "filesIrFinancialStatements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fiscalYearEndMonth" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "incorporationDate" TIMESTAMP(3),
ADD COLUMN     "registeredAgentName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "registeredOfficeAddress" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "ReportSnapshotType" NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "paramsJson" JSONB NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearEndClose" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "YearEndCloseStatus" NOT NULL DEFAULT 'draft',
    "closingPreviewJson" JSONB,
    "closingJournalEntryId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "postedByUserId" TEXT,
    "signatureText" TEXT NOT NULL DEFAULT '',
    "revisionOfId" TEXT,
    "supersededById" TEXT,
    "revisionReason" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "YearEndClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSnapshot_orgId_type_idx" ON "ReportSnapshot"("orgId", "type");

-- CreateIndex
CREATE INDEX "YearEndClose_orgId_year_idx" ON "YearEndClose"("orgId", "year");

-- AddForeignKey
ALTER TABLE "YearEndClose" ADD CONSTRAINT "YearEndClose_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "YearEndClose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

