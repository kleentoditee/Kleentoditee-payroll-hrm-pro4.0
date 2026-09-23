-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('platform_owner', 'hr_admin', 'payroll_admin', 'finance_admin', 'operations_manager', 'site_supervisor', 'employee_tracker_user');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('daily', 'hourly', 'fixed');

-- CreateEnum
CREATE TYPE "PaySchedule" AS ENUM ('weekly', 'biweekly', 'monthly');

-- CreateEnum
CREATE TYPE "TimeEntryStatus" AS ENUM ('draft', 'submitted', 'approved', 'paid');

-- CreateEnum
CREATE TYPE "PayRunStatus" AS ENUM ('draft', 'finalized', 'exported', 'paid');

-- CreateEnum
CREATE TYPE "EmployeeDocumentType" AS ENUM ('PHOTO', 'WORK_PERMIT_CARD', 'NHI_CARD', 'ID_CARD', 'CONTRACT', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRequestType" AS ENUM ('JOB_LETTER', 'TIME_OFF', 'SICK_LEAVE', 'PROFILE_UPDATE', 'SUPPLIES_REQUEST', 'EQUIPMENT_UNIFORM_REQUEST', 'INCIDENT_REPORT', 'DAMAGE_REPORT');

-- CreateEnum
CREATE TYPE "StaffRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DENIED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('service', 'product', 'bundle');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('draft', 'open', 'partial', 'paid', 'void');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'check', 'card', 'ach', 'other');

-- CreateEnum
CREATE TYPE "WorkAssignmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StaffAnnouncementCategory" AS ENUM ('GENERAL', 'SAFETY', 'HOLIDAY', 'POLICY', 'WEATHER', 'PAYROLL', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "StaffAnnouncementAudience" AS ENUM ('ALL', 'EMPLOYEES', 'MANAGERS');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL_DRAFT', 'WHATSAPP_DRAFT', 'EMAIL_PROVIDER', 'WHATSAPP_PROVIDER');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailCanonical" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionTemplate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "nhiRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssbRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTaxRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "applyNhi" BOOLEAN NOT NULL DEFAULT true,
    "applySsb" BOOLEAN NOT NULL DEFAULT true,
    "applyIncomeTax" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DeductionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "defaultSite" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "profilePhotoPath" TEXT,
    "socialSecurityNumber" TEXT NOT NULL DEFAULT '',
    "nationalHealthInsuranceNumber" TEXT NOT NULL DEFAULT '',
    "inlandRevenueDepartmentNumber" TEXT NOT NULL DEFAULT '',
    "employmentStartDate" TIMESTAMP(3),
    "employmentEndDate" TIMESTAMP(3),
    "workPermitNumber" TEXT NOT NULL DEFAULT '',
    "workPermitExpiryDate" TIMESTAMP(3),
    "basePayType" "PayBasis" NOT NULL DEFAULT 'daily',
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "standardHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paySchedule" "PaySchedule" NOT NULL DEFAULT 'monthly',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "StaffRequestType" NOT NULL,
    "status" "StaffRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "subject" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "reason" TEXT,
    "details" TEXT,
    "requestedContactUpdate" JSONB,
    "reviewNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "StaffRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "EmployeeDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "uploadedByUserId" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "site" TEXT NOT NULL DEFAULT '',
    "status" "TimeEntryStatus" NOT NULL DEFAULT 'draft',
    "daysWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flatGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "templateId" TEXT NOT NULL,
    "applyNhi" BOOLEAN NOT NULL DEFAULT true,
    "applySsb" BOOLEAN NOT NULL DEFAULT true,
    "applyIncomeTax" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "TimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPeriod" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "schedule" "PaySchedule" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "PayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "periodId" TEXT NOT NULL,
    "status" "PayRunStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "finalizedAt" TIMESTAMP(3),
    "exportedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PayRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRunItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "employeeRole" TEXT NOT NULL DEFAULT '',
    "defaultSite" TEXT NOT NULL DEFAULT '',
    "paySchedule" "PaySchedule" NOT NULL,
    "payBasis" "PayBasis" NOT NULL,
    "templateName" TEXT NOT NULL DEFAULT '',
    "sourceEntryIds" JSONB,
    "sourceSummary" JSONB,
    "gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhi" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "daysWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonus" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "flatGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawalDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "PayRunItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paystub" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payRunItemId" TEXT NOT NULL,
    "stubNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "Paystub_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollExport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "runId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contents" TEXT NOT NULL,

    CONSTRAINT "PayrollExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subtype" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "primaryContact" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "billingAddress" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "displayName" TEXT NOT NULL,
    "companyName" TEXT NOT NULL DEFAULT '',
    "primaryContact" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "mailingAddress" TEXT NOT NULL DEFAULT '',
    "taxId" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'service',
    "description" TEXT NOT NULL DEFAULT '',
    "salesPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "incomeAccountId" TEXT NOT NULL,
    "expenseAccountId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "memo" TEXT NOT NULL DEFAULT '',
    "status" "TransactionStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeAccountId" TEXT NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "memo" TEXT NOT NULL DEFAULT '',
    "status" "TransactionStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "billId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "reference" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unapplied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "depositAccountId" TEXT NOT NULL,
    "depositedAt" TIMESTAMP(3),

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPayment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'check',
    "reference" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "applied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unapplied" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceAccountId" TEXT NOT NULL,

    CONSTRAINT "BillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillPaymentApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billPaymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BillPaymentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'card',
    "reference" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "supplierId" TEXT,
    "payeeName" TEXT NOT NULL DEFAULT '',
    "paymentAccountId" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'draft',
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expenseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenseAccountId" TEXT NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAssignment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "locationName" TEXT NOT NULL,
    "locationAddress" TEXT,
    "notes" TEXT,
    "status" "WorkAssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdByUserId" TEXT,

    CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAnnouncement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "StaffAnnouncementCategory" NOT NULL,
    "audience" "StaffAnnouncementAudience" NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,

    CONSTRAINT "StaffAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "channel" "NotificationChannel" NOT NULL,
    "recipientUserId" TEXT,
    "employeeId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffQuizQuestion" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "question" TEXT NOT NULL,
    "choices" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StaffQuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffQuizAttempt" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedIndex" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardLedger" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "RewardLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deposit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" TEXT NOT NULL,
    "depositDate" TIMESTAMP(3) NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "bankAccountId" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TransactionStatus" NOT NULL DEFAULT 'draft',
    "postedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "Deposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositLine" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "depositId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "paymentId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DepositLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "UserInvitation_userId_idx" ON "UserInvitation"("userId");

-- CreateIndex
CREATE INDEX "UserInvitation_expiresAt_idx" ON "UserInvitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Employee_templateId_idx" ON "Employee"("templateId");

-- CreateIndex
CREATE INDEX "Employee_active_idx" ON "Employee"("active");

-- CreateIndex
CREATE INDEX "Employee_fullName_idx" ON "Employee"("fullName");

-- CreateIndex
CREATE INDEX "Employee_paySchedule_active_idx" ON "Employee"("paySchedule", "active");

-- CreateIndex
CREATE INDEX "StaffRequest_employeeId_idx" ON "StaffRequest"("employeeId");

-- CreateIndex
CREATE INDEX "StaffRequest_status_idx" ON "StaffRequest"("status");

-- CreateIndex
CREATE INDEX "StaffRequest_type_idx" ON "StaffRequest"("type");

-- CreateIndex
CREATE INDEX "StaffRequest_createdAt_idx" ON "StaffRequest"("createdAt");

-- CreateIndex
CREATE INDEX "StaffRequest_employeeId_status_idx" ON "StaffRequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_deletedAt_idx" ON "EmployeeDocument"("employeeId", "deletedAt");

-- CreateIndex
CREATE INDEX "EmployeeDocument_type_idx" ON "EmployeeDocument"("type");

-- CreateIndex
CREATE INDEX "TimeEntry_employeeId_month_idx" ON "TimeEntry"("employeeId", "month");

-- CreateIndex
CREATE INDEX "TimeEntry_month_idx" ON "TimeEntry"("month");

-- CreateIndex
CREATE INDEX "TimeEntry_status_idx" ON "TimeEntry"("status");

-- CreateIndex
CREATE INDEX "TimeEntry_periodStart_periodEnd_idx" ON "TimeEntry"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayPeriod_schedule_startDate_idx" ON "PayPeriod"("schedule", "startDate");

-- CreateIndex
CREATE INDEX "PayPeriod_endDate_idx" ON "PayPeriod"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayPeriod_schedule_startDate_endDate_key" ON "PayPeriod"("schedule", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayRun_periodId_key" ON "PayRun"("periodId");

-- CreateIndex
CREATE INDEX "PayRun_status_idx" ON "PayRun"("status");

-- CreateIndex
CREATE INDEX "PayRunItem_employeeId_idx" ON "PayRunItem"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayRunItem_runId_employeeId_key" ON "PayRunItem"("runId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Paystub_payRunItemId_key" ON "Paystub"("payRunItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Paystub_stubNumber_key" ON "Paystub"("stubNumber");

-- CreateIndex
CREATE INDEX "PayrollExport_runId_idx" ON "PayrollExport"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- CreateIndex
CREATE INDEX "Account_type_active_idx" ON "Account"("type", "active");

-- CreateIndex
CREATE INDEX "Account_parentId_idx" ON "Account"("parentId");

-- CreateIndex
CREATE INDEX "Account_name_idx" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_displayName_key" ON "Customer"("displayName");

-- CreateIndex
CREATE INDEX "Customer_active_idx" ON "Customer"("active");

-- CreateIndex
CREATE INDEX "Customer_displayName_idx" ON "Customer"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_displayName_key" ON "Supplier"("displayName");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "Supplier_displayName_idx" ON "Supplier"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_kind_active_idx" ON "Product"("kind", "active");

-- CreateIndex
CREATE INDEX "Product_incomeAccountId_idx" ON "Product"("incomeAccountId");

-- CreateIndex
CREATE INDEX "Product_expenseAccountId_idx" ON "Product"("expenseAccountId");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_position_idx" ON "InvoiceLine"("invoiceId", "position");

-- CreateIndex
CREATE INDEX "InvoiceLine_productId_idx" ON "InvoiceLine"("productId");

-- CreateIndex
CREATE INDEX "InvoiceLine_incomeAccountId_idx" ON "InvoiceLine"("incomeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_number_key" ON "Bill"("number");

-- CreateIndex
CREATE INDEX "Bill_supplierId_idx" ON "Bill"("supplierId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_billDate_idx" ON "Bill"("billDate");

-- CreateIndex
CREATE INDEX "BillLine_billId_position_idx" ON "BillLine"("billId", "position");

-- CreateIndex
CREATE INDEX "BillLine_productId_idx" ON "BillLine"("productId");

-- CreateIndex
CREATE INDEX "BillLine_expenseAccountId_idx" ON "BillLine"("expenseAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_number_key" ON "Payment"("number");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_depositAccountId_idx" ON "Payment"("depositAccountId");

-- CreateIndex
CREATE INDEX "PaymentApplication_paymentId_idx" ON "PaymentApplication"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentApplication_invoiceId_idx" ON "PaymentApplication"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentApplication_paymentId_invoiceId_key" ON "PaymentApplication"("paymentId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPayment_number_key" ON "BillPayment"("number");

-- CreateIndex
CREATE INDEX "BillPayment_supplierId_idx" ON "BillPayment"("supplierId");

-- CreateIndex
CREATE INDEX "BillPayment_paymentDate_idx" ON "BillPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "BillPayment_sourceAccountId_idx" ON "BillPayment"("sourceAccountId");

-- CreateIndex
CREATE INDEX "BillPaymentApplication_billPaymentId_idx" ON "BillPaymentApplication"("billPaymentId");

-- CreateIndex
CREATE INDEX "BillPaymentApplication_billId_idx" ON "BillPaymentApplication"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "BillPaymentApplication_billPaymentId_billId_key" ON "BillPaymentApplication"("billPaymentId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_number_key" ON "Expense"("number");

-- CreateIndex
CREATE INDEX "Expense_expenseDate_idx" ON "Expense"("expenseDate");

-- CreateIndex
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");

-- CreateIndex
CREATE INDEX "Expense_paymentAccountId_idx" ON "Expense"("paymentAccountId");

-- CreateIndex
CREATE INDEX "Expense_status_idx" ON "Expense"("status");

-- CreateIndex
CREATE INDEX "ExpenseLine_expenseId_position_idx" ON "ExpenseLine"("expenseId", "position");

-- CreateIndex
CREATE INDEX "ExpenseLine_expenseAccountId_idx" ON "ExpenseLine"("expenseAccountId");

-- CreateIndex
CREATE INDEX "WorkAssignment_employeeId_date_idx" ON "WorkAssignment"("employeeId", "date");

-- CreateIndex
CREATE INDEX "WorkAssignment_date_idx" ON "WorkAssignment"("date");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "StaffQuizAttempt_employeeId_createdAt_idx" ON "StaffQuizAttempt"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffQuizAttempt_questionId_idx" ON "StaffQuizAttempt"("questionId");

-- CreateIndex
CREATE INDEX "RewardLedger_employeeId_createdAt_idx" ON "RewardLedger"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deposit_number_key" ON "Deposit"("number");

-- CreateIndex
CREATE INDEX "Deposit_depositDate_idx" ON "Deposit"("depositDate");

-- CreateIndex
CREATE INDEX "Deposit_bankAccountId_idx" ON "Deposit"("bankAccountId");

-- CreateIndex
CREATE INDEX "Deposit_status_idx" ON "Deposit"("status");

-- CreateIndex
CREATE INDEX "DepositLine_depositId_position_idx" ON "DepositLine"("depositId", "position");

-- CreateIndex
CREATE INDEX "DepositLine_paymentId_idx" ON "DepositLine"("paymentId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DeductionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRequest" ADD CONSTRAINT "StaffRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DeductionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRun" ADD CONSTRAINT "PayRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "PayPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRunItem" ADD CONSTRAINT "PayRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayRunItem" ADD CONSTRAINT "PayRunItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paystub" ADD CONSTRAINT "Paystub_payRunItemId_fkey" FOREIGN KEY ("payRunItemId") REFERENCES "PayRunItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollExport" ADD CONSTRAINT "PayrollExport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_incomeAccountId_fkey" FOREIGN KEY ("incomeAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_depositAccountId_fkey" FOREIGN KEY ("depositAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentApplication" ADD CONSTRAINT "PaymentApplication_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPayment" ADD CONSTRAINT "BillPayment_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentApplication" ADD CONSTRAINT "BillPaymentApplication_billPaymentId_fkey" FOREIGN KEY ("billPaymentId") REFERENCES "BillPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillPaymentApplication" ADD CONSTRAINT "BillPaymentApplication_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAnnouncement" ADD CONSTRAINT "StaffAnnouncement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQuizAttempt" ADD CONSTRAINT "StaffQuizAttempt_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffQuizAttempt" ADD CONSTRAINT "StaffQuizAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StaffQuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardLedger" ADD CONSTRAINT "RewardLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deposit" ADD CONSTRAINT "Deposit_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLine" ADD CONSTRAINT "DepositLine_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositLine" ADD CONSTRAINT "DepositLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

