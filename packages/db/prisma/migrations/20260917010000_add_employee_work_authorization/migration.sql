CREATE TYPE "WorkAuthorizationStatus" AS ENUM ('NOT_SPECIFIED', 'WORK_PERMIT', 'BELONGER', 'RESIDENT', 'BV_ISLANDER');

ALTER TABLE "Employee"
ADD COLUMN "workAuthorizationStatus" "WorkAuthorizationStatus" NOT NULL DEFAULT 'NOT_SPECIFIED';
