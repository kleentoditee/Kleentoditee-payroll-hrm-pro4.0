-- CreateEnum
CREATE TYPE "LeaveEventKind" AS ENUM ('accrual', 'carryover', 'usage', 'usage_release', 'adjustment', 'time_for_time');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "bankAccountNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bankTransitNumber" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "LeavePolicy" ADD COLUMN     "accrualPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "basis" TEXT NOT NULL DEFAULT 'days',
ADD COLUMN     "carryoverCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "excludePublicHolidays" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "maxBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PublicHoliday" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicyAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "policyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "orgId" TEXT NOT NULL,

    CONSTRAINT "LeavePolicyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "LeaveEventKind" NOT NULL,
    "employeeId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "LeaveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'committed',
    "createdEmployeeIds" JSONB NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "OnboardingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollMutationBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "runId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "PayrollMutationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollMutation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "PayrollMutation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicHoliday_orgId_idx" ON "PublicHoliday"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicHoliday_orgId_date_key" ON "PublicHoliday"("orgId", "date");

-- CreateIndex
CREATE INDEX "LeavePolicyAssignment_employeeId_idx" ON "LeavePolicyAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "LeavePolicyAssignment_orgId_idx" ON "LeavePolicyAssignment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicyAssignment_policyId_employeeId_effectiveFrom_key" ON "LeavePolicyAssignment"("policyId", "employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LeaveEvent_orgId_employeeId_policyId_idx" ON "LeaveEvent"("orgId", "employeeId", "policyId");

-- CreateIndex
CREATE INDEX "LeaveEvent_sourceType_sourceId_idx" ON "LeaveEvent"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "OnboardingBatch_orgId_idx" ON "OnboardingBatch"("orgId");

-- CreateIndex
CREATE INDEX "PayrollMutationBatch_orgId_idx" ON "PayrollMutationBatch"("orgId");

-- CreateIndex
CREATE INDEX "PayrollMutationBatch_runId_idx" ON "PayrollMutationBatch"("runId");

-- CreateIndex
CREATE INDEX "PayrollMutation_batchId_idx" ON "PayrollMutation"("batchId");

-- CreateIndex
CREATE INDEX "PayrollMutation_runId_employeeId_idx" ON "PayrollMutation"("runId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollMutation_orgId_idx" ON "PayrollMutation"("orgId");

-- AddForeignKey
ALTER TABLE "LeavePolicyAssignment" ADD CONSTRAINT "LeavePolicyAssignment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicyAssignment" ADD CONSTRAINT "LeavePolicyAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEvent" ADD CONSTRAINT "LeaveEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveEvent" ADD CONSTRAINT "LeaveEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "LeavePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollMutationBatch" ADD CONSTRAINT "PayrollMutationBatch_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollMutation" ADD CONSTRAINT "PayrollMutation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollMutationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollMutation" ADD CONSTRAINT "PayrollMutation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
