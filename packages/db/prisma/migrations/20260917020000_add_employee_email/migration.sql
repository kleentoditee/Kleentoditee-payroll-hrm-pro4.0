ALTER TABLE "Employee"
ADD COLUMN "email" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Employee_email_idx" ON "Employee"("email");
