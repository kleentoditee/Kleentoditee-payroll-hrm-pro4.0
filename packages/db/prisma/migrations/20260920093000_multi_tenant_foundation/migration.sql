-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('active', 'suspended');

-- DropIndex
DROP INDEX "Account_code_key";

-- DropIndex
DROP INDEX "Bill_number_key";

-- DropIndex
DROP INDEX "BillPayment_number_key";

-- DropIndex
DROP INDEX "Customer_displayName_key";

-- DropIndex
DROP INDEX "Deposit_number_key";

-- DropIndex
DROP INDEX "Expense_number_key";

-- DropIndex
DROP INDEX "Invoice_number_key";

-- DropIndex
DROP INDEX "JournalEntry_sourceKey_key";

-- DropIndex
DROP INDEX "LeavePolicy_code_key";

-- DropIndex
DROP INDEX "LeavePolicy_requestType_key";

-- DropIndex
DROP INDEX "PayPeriod_schedule_startDate_endDate_key";

-- DropIndex
DROP INDEX "Payment_number_key";

-- DropIndex
DROP INDEX "Paystub_stubNumber_key";

-- DropIndex
DROP INDEX "Product_sku_key";

-- DropIndex
DROP INDEX "Supplier_displayName_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Bill" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "BillLine" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "BillPayment" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "BillPaymentApplication" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "DeductionTemplate" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "DepositLine" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "ExpenseLine" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "LeavePolicy" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "orgId" TEXT,
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PayPeriod" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "PayRun" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "PayRunItem" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "PaymentApplication" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "PayrollExport" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "PayrollYtdOpeningBalance" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Paystub" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "RewardLedger" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "StaffAnnouncement" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "StaffQuizAttempt" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "StaffQuizQuestion" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "StaffRequest" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "StatutoryRateVersion" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPlatformSupport" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserInvitation" ADD COLUMN     "orgId" TEXT;

-- AlterTable
ALTER TABLE "WorkAssignment" ADD COLUMN     "orgId" TEXT;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

-- Batch 12 backfill: create the default org and assign all existing data to it losslessly.
INSERT INTO "Organization" ("id", "createdAt", "updatedAt", "name", "slug", "status")
VALUES ('org_kleentoditee', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'KleenToDiTee', 'kleentoditee', 'active');

INSERT INTO "OrganizationMembership" ("id", "createdAt", "orgId", "userId")
SELECT 'om_' || "id", CURRENT_TIMESTAMP, 'org_kleentoditee', "id" FROM "User";

UPDATE "Account" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Bill" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "BillLine" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "BillPayment" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "BillPaymentApplication" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Customer" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "DeductionTemplate" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Deposit" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "DepositLine" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Employee" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "EmployeeDocument" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Expense" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "ExpenseLine" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Invoice" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "InvoiceLine" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "JournalEntry" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "JournalLine" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "LeavePolicy" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "NotificationLog" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PayPeriod" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PayRun" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PayRunItem" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Payment" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PaymentApplication" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PayrollExport" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "PayrollYtdOpeningBalance" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Paystub" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Product" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "RewardLedger" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "StaffAnnouncement" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "StaffQuizAttempt" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "StaffQuizQuestion" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "StaffRequest" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "StatutoryRateVersion" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "Supplier" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "TimeEntry" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "UserInvitation" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "WorkAssignment" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;
UPDATE "OrgSettings" SET "orgId" = 'org_kleentoditee' WHERE "orgId" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Bill" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "BillLine" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "BillPayment" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "BillPaymentApplication" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Customer" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "DeductionTemplate" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Deposit" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "DepositLine" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "EmployeeDocument" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "ExpenseLine" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "InvoiceLine" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "JournalEntry" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "JournalLine" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "LeavePolicy" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "NotificationLog" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PayPeriod" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PayRun" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PayRunItem" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PaymentApplication" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PayrollExport" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "PayrollYtdOpeningBalance" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Paystub" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "RewardLedger" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StaffAnnouncement" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StaffQuizAttempt" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StaffQuizQuestion" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StaffRequest" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "StatutoryRateVersion" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "TimeEntry" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "UserInvitation" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "WorkAssignment" ALTER COLUMN "orgId" SET NOT NULL;
ALTER TABLE "OrgSettings" ALTER COLUMN "orgId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMembership_orgId_userId_key" ON "OrganizationMembership"("orgId", "userId");

-- CreateIndex
CREATE INDEX "Account_orgId_idx" ON "Account"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_orgId_code_key" ON "Account"("orgId", "code");

-- CreateIndex
CREATE INDEX "AuditLog_orgId_idx" ON "AuditLog"("orgId");

-- CreateIndex
CREATE INDEX "Bill_orgId_idx" ON "Bill"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_orgId_number_key" ON "Bill"("orgId", "number");

-- CreateIndex
CREATE INDEX "BillLine_orgId_idx" ON "BillLine"("orgId");

-- CreateIndex
CREATE INDEX "BillPayment_orgId_idx" ON "BillPayment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_orgId_number_key" ON "BillPayment"("orgId", "number");

-- CreateIndex
CREATE INDEX "BillPaymentApplication_orgId_idx" ON "BillPaymentApplication"("orgId");

-- CreateIndex
CREATE INDEX "Customer_orgId_idx" ON "Customer"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_orgId_displayName_key" ON "Customer"("orgId", "displayName");

-- CreateIndex
CREATE INDEX "DeductionTemplate_orgId_idx" ON "DeductionTemplate"("orgId");

-- CreateIndex
CREATE INDEX "Deposit_orgId_idx" ON "Deposit"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_orgId_number_key" ON "Deposit"("orgId", "number");

-- CreateIndex
CREATE INDEX "DepositLine_orgId_idx" ON "DepositLine"("orgId");

-- CreateIndex
CREATE INDEX "Employee_orgId_idx" ON "Employee"("orgId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_orgId_idx" ON "EmployeeDocument"("orgId");

-- CreateIndex
CREATE INDEX "Expense_orgId_idx" ON "Expense"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_orgId_number_key" ON "Expense"("orgId", "number");

-- CreateIndex
CREATE INDEX "ExpenseLine_orgId_idx" ON "ExpenseLine"("orgId");

-- CreateIndex
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");

-- CreateIndex
CREATE INDEX "InvoiceLine_orgId_idx" ON "InvoiceLine"("orgId");

-- CreateIndex
CREATE INDEX "JournalEntry_orgId_idx" ON "JournalEntry"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_orgId_sourceKey_key" ON "JournalEntry"("orgId", "sourceKey");

-- CreateIndex
CREATE INDEX "JournalLine_orgId_idx" ON "JournalLine"("orgId");

-- CreateIndex
CREATE INDEX "LeavePolicy_orgId_idx" ON "LeavePolicy"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_orgId_code_key" ON "LeavePolicy"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_orgId_requestType_key" ON "LeavePolicy"("orgId", "requestType");

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_idx" ON "NotificationLog"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgSettings_orgId_key" ON "OrgSettings"("orgId");

-- CreateIndex
CREATE INDEX "PayPeriod_orgId_idx" ON "PayPeriod"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "PayPeriod_orgId_schedule_startDate_endDate_key" ON "PayPeriod"("orgId", "schedule", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "PayRun_orgId_idx" ON "PayRun"("orgId");

-- CreateIndex
CREATE INDEX "PayRunItem_orgId_idx" ON "PayRunItem"("orgId");

-- CreateIndex
CREATE INDEX "Payment_orgId_idx" ON "Payment"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orgId_number_key" ON "Payment"("orgId", "number");

-- CreateIndex
CREATE INDEX "PaymentApplication_orgId_idx" ON "PaymentApplication"("orgId");

-- CreateIndex
CREATE INDEX "PayrollExport_orgId_idx" ON "PayrollExport"("orgId");

-- CreateIndex
CREATE INDEX "PayrollYtdOpeningBalance_orgId_idx" ON "PayrollYtdOpeningBalance"("orgId");

-- CreateIndex
CREATE INDEX "Paystub_orgId_idx" ON "Paystub"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Paystub_orgId_stubNumber_key" ON "Paystub"("orgId", "stubNumber");

-- CreateIndex
CREATE INDEX "Product_orgId_idx" ON "Product"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_orgId_sku_key" ON "Product"("orgId", "sku");

-- CreateIndex
CREATE INDEX "RewardLedger_orgId_idx" ON "RewardLedger"("orgId");

-- CreateIndex
CREATE INDEX "StaffAnnouncement_orgId_idx" ON "StaffAnnouncement"("orgId");

-- CreateIndex
CREATE INDEX "StaffQuizAttempt_orgId_idx" ON "StaffQuizAttempt"("orgId");

-- CreateIndex
CREATE INDEX "StaffQuizQuestion_orgId_idx" ON "StaffQuizQuestion"("orgId");

-- CreateIndex
CREATE INDEX "StaffRequest_orgId_idx" ON "StaffRequest"("orgId");

-- CreateIndex
CREATE INDEX "StatutoryRateVersion_orgId_idx" ON "StatutoryRateVersion"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "StatutoryRateVersion_orgId_effectiveYear_key" ON "StatutoryRateVersion"("orgId", "effectiveYear");

-- CreateIndex
CREATE INDEX "Supplier_orgId_idx" ON "Supplier"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_orgId_displayName_key" ON "Supplier"("orgId", "displayName");

-- CreateIndex
CREATE INDEX "TimeEntry_orgId_idx" ON "TimeEntry"("orgId");

-- CreateIndex
CREATE INDEX "UserInvitation_orgId_idx" ON "UserInvitation"("orgId");

-- CreateIndex
CREATE INDEX "WorkAssignment_orgId_idx" ON "WorkAssignment"("orgId");

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

