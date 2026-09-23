-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'casual', 'fixed_term');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "costCentreId" TEXT,
ADD COLUMN     "departmentId" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "positionId" TEXT,
ADD COLUMN     "workScheduleId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeDocument" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCentre" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "glAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "CostCentre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pattern" JSONB NOT NULL DEFAULT '[]',
    "standardHoursPerWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'full_time',
    "departmentId" TEXT,
    "positionId" TEXT,
    "costCentreId" TEXT,
    "locationId" TEXT,
    "workScheduleId" TEXT,
    "managerId" TEXT,
    "basePayType" "PayBasis",
    "dailyRate" DOUBLE PRECISION,
    "hourlyRate" DOUBLE PRECISION,
    "fixedPay" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAsset" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "condition" TEXT NOT NULL DEFAULT '',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "orgId" TEXT NOT NULL,

    CONSTRAINT "EmployeeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE INDEX "Department_orgId_idx" ON "Department"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_orgId_code_key" ON "Department"("orgId", "code");

-- CreateIndex
CREATE INDEX "Position_orgId_idx" ON "Position"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_orgId_code_key" ON "Position"("orgId", "code");

-- CreateIndex
CREATE INDEX "CostCentre_orgId_idx" ON "CostCentre"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CostCentre_orgId_code_key" ON "CostCentre"("orgId", "code");

-- CreateIndex
CREATE INDEX "Location_orgId_idx" ON "Location"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_orgId_code_key" ON "Location"("orgId", "code");

-- CreateIndex
CREATE INDEX "WorkSchedule_orgId_idx" ON "WorkSchedule"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_orgId_name_key" ON "WorkSchedule"("orgId", "name");

-- CreateIndex
CREATE INDEX "EmploymentContract_employeeId_effectiveFrom_idx" ON "EmploymentContract"("employeeId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "EmploymentContract_orgId_idx" ON "EmploymentContract"("orgId");

-- CreateIndex
CREATE INDEX "EmployeeAsset_employeeId_returnedAt_idx" ON "EmployeeAsset"("employeeId", "returnedAt");

-- CreateIndex
CREATE INDEX "EmployeeAsset_orgId_idx" ON "EmployeeAsset"("orgId");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_costCentreId_idx" ON "Employee"("costCentreId");

-- CreateIndex
CREATE INDEX "Employee_managerId_idx" ON "Employee"("managerId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCentre" ADD CONSTRAINT "CostCentre_glAccountId_fkey" FOREIGN KEY ("glAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_costCentreId_fkey" FOREIGN KEY ("costCentreId") REFERENCES "CostCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAsset" ADD CONSTRAINT "EmployeeAsset_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
