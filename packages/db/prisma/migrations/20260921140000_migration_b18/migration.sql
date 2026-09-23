-- AlterTable
ALTER TABLE "AccountingImportBatch" ADD COLUMN     "exceptionSignature" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "exceptionSignedAt" TIMESTAMP(3),
ADD COLUMN     "exceptionSignedByUserId" TEXT,
ADD COLUMN     "migrationMode" TEXT NOT NULL DEFAULT 'full_detail';

-- AlterTable
ALTER TABLE "AccountingImportFile" ADD COLUMN     "disposition" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "dispositionNote" TEXT NOT NULL DEFAULT '';
