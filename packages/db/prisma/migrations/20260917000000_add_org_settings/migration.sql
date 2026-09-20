CREATE TABLE "OrgSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyLegalName" TEXT NOT NULL DEFAULT '',
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "defaultPaySchedule" "PaySchedule" NOT NULL DEFAULT 'monthly',
    "defaultPayDayOfMonth" INTEGER NOT NULL DEFAULT 0,
    "ssbEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssbEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssbPeriodCeiling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ssbEnabled" BOOLEAN NOT NULL DEFAULT true,
    "nhiEmployeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhiEmployerRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhiPeriodCeiling" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nhiEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrgSettings_pkey" PRIMARY KEY ("id")
);
