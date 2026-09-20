-- CreateEnum
CREATE TYPE "BankStatementLineStatus" AS ENUM ('unmatched', 'matched', 'excluded');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('in_progress', 'completed');

-- CreateTable
CREATE TABLE "BankStatementImport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL DEFAULT '',
    "statementStartDate" TIMESTAMP(3),
    "statementEndDate" TIMESTAMP(3),
    "openingBalance" DOUBLE PRECISION,
    "closingBalance" DOUBLE PRECISION,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "importedByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "BankStatementLineStatus" NOT NULL DEFAULT 'unmatched',
    "matchedEntityType" TEXT,
    "matchedEntityId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "matchedByUserId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementEndingDate" TIMESTAMP(3) NOT NULL,
    "statementEndingBalance" DOUBLE PRECISION NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clearedNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "BankReconciliationStatus" NOT NULL DEFAULT 'in_progress',
    "completedAt" TIMESTAMP(3),
    "completedByUserId" TEXT,
    "unlockedAt" TIMESTAMP(3),
    "unlockedByUserId" TEXT,
    "unlockReason" TEXT,
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "BankReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliationLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciliationId" TEXT NOT NULL,
    "statementLineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "BankReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankStatementImport_bankAccountId_idx" ON "BankStatementImport"("bankAccountId");

-- CreateIndex
CREATE INDEX "BankStatementImport_orgId_idx" ON "BankStatementImport"("orgId");

-- CreateIndex
CREATE INDEX "BankStatementLine_importId_position_idx" ON "BankStatementLine"("importId", "position");

-- CreateIndex
CREATE INDEX "BankStatementLine_status_idx" ON "BankStatementLine"("status");

-- CreateIndex
CREATE INDEX "BankStatementLine_date_idx" ON "BankStatementLine"("date");

-- CreateIndex
CREATE INDEX "BankStatementLine_orgId_idx" ON "BankStatementLine"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BankStatementLine_orgId_fingerprint_key" ON "BankStatementLine"("orgId", "fingerprint");

-- CreateIndex
CREATE INDEX "BankReconciliation_bankAccountId_status_idx" ON "BankReconciliation"("bankAccountId", "status");

-- CreateIndex
CREATE INDEX "BankReconciliation_orgId_idx" ON "BankReconciliation"("orgId");

-- CreateIndex
CREATE INDEX "BankReconciliationLine_orgId_idx" ON "BankReconciliationLine"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciliationLine_reconciliationId_statementLineId_key" ON "BankReconciliationLine"("reconciliationId", "statementLineId");

-- AddForeignKey
ALTER TABLE "BankStatementImport" ADD CONSTRAINT "BankStatementImport_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankStatementLine" ADD CONSTRAINT "BankStatementLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliation" ADD CONSTRAINT "BankReconciliation_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationLine" ADD CONSTRAINT "BankReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankReconciliationLine" ADD CONSTRAINT "BankReconciliationLine_statementLineId_fkey" FOREIGN KEY ("statementLineId") REFERENCES "BankStatementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

