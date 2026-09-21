-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('uploaded', 'inventoried', 'mapped', 'validated', 'approved', 'importing', 'reconciled', 'accepted', 'rejected', 'failed', 'reversed');

-- CreateTable
CREATE TABLE "AccountingImportBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sourceSystem" TEXT NOT NULL DEFAULT 'excel_generic',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'uploaded',
    "label" TEXT NOT NULL DEFAULT '',
    "mappingJson" JSONB,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "committedByUserId" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT NOT NULL DEFAULT '',
    "errorSummary" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "AccountingImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingImportFile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL DEFAULT '',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "committedCount" INTEGER NOT NULL DEFAULT 0,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "AccountingImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingImportRow" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "sourceRef" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT NOT NULL DEFAULT '',
    "destinationType" TEXT NOT NULL DEFAULT '',
    "destinationId" TEXT NOT NULL DEFAULT '',
    "orgId" TEXT NOT NULL,

    CONSTRAINT "AccountingImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalSourceRef" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceSystem" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "batchId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "ExternalSourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationReconciliation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "expected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,

    CONSTRAINT "MigrationReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegacyDocument" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT '',
    "storageKey" TEXT NOT NULL,
    "linkedType" TEXT NOT NULL DEFAULT '',
    "linkedId" TEXT NOT NULL DEFAULT '',
    "orgId" TEXT NOT NULL,

    CONSTRAINT "LegacyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingImportBatch_orgId_status_idx" ON "AccountingImportBatch"("orgId", "status");

-- CreateIndex
CREATE INDEX "AccountingImportFile_orgId_batchId_idx" ON "AccountingImportFile"("orgId", "batchId");

-- CreateIndex
CREATE INDEX "AccountingImportFile_batchId_idx" ON "AccountingImportFile"("batchId");

-- CreateIndex
CREATE INDEX "AccountingImportRow_orgId_fileId_idx" ON "AccountingImportRow"("orgId", "fileId");

-- CreateIndex
CREATE INDEX "AccountingImportRow_orgId_sourceRef_idx" ON "AccountingImportRow"("orgId", "sourceRef");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingImportRow_fileId_rowIndex_key" ON "AccountingImportRow"("fileId", "rowIndex");

-- CreateIndex
CREATE INDEX "ExternalSourceRef_orgId_destinationType_destinationId_idx" ON "ExternalSourceRef"("orgId", "destinationType", "destinationId");

-- CreateIndex
CREATE INDEX "ExternalSourceRef_batchId_idx" ON "ExternalSourceRef"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalSourceRef_orgId_sourceSystem_sourceType_sourceId_key" ON "ExternalSourceRef"("orgId", "sourceSystem", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MigrationReconciliation_orgId_batchId_idx" ON "MigrationReconciliation"("orgId", "batchId");

-- CreateIndex
CREATE INDEX "MigrationReconciliation_batchId_idx" ON "MigrationReconciliation"("batchId");

-- CreateIndex
CREATE INDEX "LegacyDocument_orgId_batchId_idx" ON "LegacyDocument"("orgId", "batchId");

-- CreateIndex
CREATE INDEX "LegacyDocument_orgId_linkedType_linkedId_idx" ON "LegacyDocument"("orgId", "linkedType", "linkedId");

-- AddForeignKey
ALTER TABLE "AccountingImportFile" ADD CONSTRAINT "AccountingImportFile_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AccountingImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingImportRow" ADD CONSTRAINT "AccountingImportRow_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "AccountingImportFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationReconciliation" ADD CONSTRAINT "MigrationReconciliation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AccountingImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
