import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/index";

const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@kleentoditee.local").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Dev123";
const name = (process.env.SEED_ADMIN_NAME ?? "Platform Admin").trim();

async function main() {
  const hash = await bcrypt.hash(password, 12);

  await prisma.auditLog.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.deductionTemplate.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();

  await prisma.deductionTemplate.createMany({
    data: [
      {
        name: "Standard deductions",
        nhiRate: 0.0375,
        ssbRate: 0.04,
        incomeTaxRate: 0,
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: false
      },
      {
        name: "NHI + SSB + income tax",
        nhiRate: 0.0375,
        ssbRate: 0.04,
        incomeTaxRate: 0.08,
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: true
      },
      {
        name: "Manual deductions only",
        nhiRate: 0,
        ssbRate: 0,
        incomeTaxRate: 0,
        applyNhi: false,
        applySsb: false,
        applyIncomeTax: false
      }
    ]
  });

  await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      name,
      roles: {
        create: [
          { role: Role.platform_owner },
          { role: Role.payroll_admin },
          { role: Role.hr_admin }
        ]
      }
    }
  });

  console.log(`Seeded deduction templates and admin user: ${email} / ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
