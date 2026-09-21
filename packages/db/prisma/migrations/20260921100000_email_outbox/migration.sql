-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "template" TEXT NOT NULL,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailMessage_status_nextAttemptAt_idx" ON "EmailMessage"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "EmailMessage_orgId_idx" ON "EmailMessage"("orgId");

-- CreateIndex
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");
