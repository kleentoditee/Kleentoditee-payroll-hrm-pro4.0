import bcrypt from "bcryptjs";
import { AccountType, PayBasis, PaySchedule, ProductKind, Role, TimeEntryStatus } from "@prisma/client";
import { prisma } from "../src/index";

const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@kleentoditee.local").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Dev123";
const name = (process.env.SEED_ADMIN_NAME ?? "Platform Admin").trim();

async function main() {
  const hash = await bcrypt.hash(password, 12);

  await prisma.payrollExport.deleteMany();
  await prisma.paystub.deleteMany();
  await prisma.payRunItem.deleteMany();
  await prisma.payRun.deleteMany();
  await prisma.payPeriod.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.deductionTemplate.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();

  const standardTemplate = await prisma.deductionTemplate.create({
    data: {
      name: "Standard deductions",
      nhiRate: 0.0375,
      ssbRate: 0.04,
      incomeTaxRate: 0,
      applyNhi: true,
      applySsb: true,
      applyIncomeTax: false
    }
  });

  const taxedTemplate = await prisma.deductionTemplate.create({
    data: {
      name: "NHI + SSB + income tax",
      nhiRate: 0.0375,
      ssbRate: 0.04,
      incomeTaxRate: 0.08,
      applyNhi: true,
      applySsb: true,
      applyIncomeTax: true
    }
  });

  const manualTemplate = await prisma.deductionTemplate.create({
    data: {
      name: "Manual deductions only",
      nhiRate: 0,
      ssbRate: 0,
      incomeTaxRate: 0,
      applyNhi: false,
      applySsb: false,
      applyIncomeTax: false
    }
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

  const monthlyEmployee = await prisma.employee.create({
    data: {
      fullName: "Maria Monthly",
      role: "Lead cleaner",
      defaultSite: "San Pedro",
      phone: "501-600-0101",
      basePayType: PayBasis.daily,
      paySchedule: PaySchedule.monthly,
      dailyRate: 80,
      hourlyRate: 10,
      overtimeRate: 15,
      fixedPay: 0,
      standardDays: 20,
      standardHours: 0,
      active: true,
      notes: "Seeded monthly employee",
      templateId: standardTemplate.id
    }
  });

  const weeklyEmployee = await prisma.employee.create({
    data: {
      fullName: "Wendy Weekly",
      role: "Site supervisor",
      defaultSite: "Belize City",
      phone: "501-600-0102",
      basePayType: PayBasis.hourly,
      paySchedule: PaySchedule.weekly,
      dailyRate: 0,
      hourlyRate: 13.5,
      overtimeRate: 18.5,
      fixedPay: 0,
      standardDays: 5,
      standardHours: 40,
      active: true,
      notes: "Seeded weekly employee",
      templateId: taxedTemplate.id
    }
  });

  const biweeklyEmployee = await prisma.employee.create({
    data: {
      fullName: "Bianca Biweekly",
      role: "Office support",
      defaultSite: "Ladyville",
      phone: "501-600-0103",
      basePayType: PayBasis.fixed,
      paySchedule: PaySchedule.biweekly,
      dailyRate: 0,
      hourlyRate: 0,
      overtimeRate: 0,
      fixedPay: 950,
      standardDays: 10,
      standardHours: 80,
      active: true,
      notes: "Seeded biweekly employee",
      templateId: manualTemplate.id
    }
  });

  await prisma.timeEntry.createMany({
    data: [
      {
        employeeId: monthlyEmployee.id,
        month: "2026-04",
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-30T00:00:00.000Z"),
        site: monthlyEmployee.defaultSite,
        status: TimeEntryStatus.approved,
        daysWorked: 20,
        hoursWorked: 4,
        overtimeHours: 2,
        bonus: 75,
        allowance: 25,
        templateId: standardTemplate.id,
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: false,
        notes: "Seeded monthly payroll-ready entry"
      },
      {
        employeeId: weeklyEmployee.id,
        month: "2026-04",
        periodStart: new Date("2026-04-06T00:00:00.000Z"),
        periodEnd: new Date("2026-04-12T00:00:00.000Z"),
        site: weeklyEmployee.defaultSite,
        status: TimeEntryStatus.approved,
        daysWorked: 5,
        hoursWorked: 40,
        overtimeHours: 3,
        bonus: 30,
        allowance: 20,
        templateId: taxedTemplate.id,
        applyNhi: true,
        applySsb: true,
        applyIncomeTax: true,
        notes: "Seeded weekly payroll-ready entry"
      },
      {
        employeeId: biweeklyEmployee.id,
        month: "2026-04",
        periodStart: new Date("2026-04-01T00:00:00.000Z"),
        periodEnd: new Date("2026-04-14T00:00:00.000Z"),
        site: biweeklyEmployee.defaultSite,
        status: TimeEntryStatus.approved,
        daysWorked: 10,
        hoursWorked: 0,
        overtimeHours: 0,
        bonus: 0,
        allowance: 40,
        templateId: manualTemplate.id,
        applyNhi: false,
        applySsb: false,
        applyIncomeTax: false,
        advanceDeduction: 25,
        otherDeduction: 10,
        notes: "Seeded biweekly payroll-ready entry"
      }
    ]
  });

  // Finance master data (Phase 3 Task 9) — small starter chart of accounts
  // plus one customer, supplier, and service so invoice/bill flows have
  // something to point at when Task 10 lands.
  const [cash, ar, ap, salesRevenue, cogs, officeExpense] = await Promise.all([
    prisma.account.create({
      data: {
        code: "1000",
        name: "Cash",
        type: AccountType.asset,
        subtype: "Bank",
        description: "Primary operating cash account"
      }
    }),
    prisma.account.create({
      data: {
        code: "1100",
        name: "Accounts Receivable",
        type: AccountType.asset,
        subtype: "Accounts Receivable",
        description: "Amounts owed by customers"
      }
    }),
    prisma.account.create({
      data: {
        code: "2000",
        name: "Accounts Payable",
        type: AccountType.liability,
        subtype: "Accounts Payable",
        description: "Amounts owed to suppliers"
      }
    }),
    prisma.account.create({
      data: {
        code: "4000",
        name: "Sales Revenue",
        type: AccountType.revenue,
        subtype: "Sales",
        description: "Revenue from services rendered"
      }
    }),
    prisma.account.create({
      data: {
        code: "5000",
        name: "Cost of Goods Sold",
        type: AccountType.expense,
        subtype: "Direct Costs",
        description: "Direct costs of delivering services"
      }
    }),
    prisma.account.create({
      data: {
        code: "6000",
        name: "Office Expenses",
        type: AccountType.expense,
        subtype: "Operating Expenses",
        description: "General office and administrative"
      }
    })
  ]);

  void cash;
  void ar;
  void ap;
  void cogs;

  await prisma.customer.create({
    data: {
      displayName: "Belize Bay Resort",
      companyName: "Belize Bay Resort Ltd.",
      primaryContact: "Sandra Torres",
      email: "ap@belizebay.example",
      phone: "501-500-7001",
      billingAddress: "Marine Parade, Belize City",
      notes: "Weekly housekeeping contract"
    }
  });

  await prisma.supplier.create({
    data: {
      displayName: "Caribbean Cleaning Supply",
      companyName: "Caribbean Cleaning Supply Co.",
      primaryContact: "Miguel Ramos",
      email: "orders@ccsupply.example",
      phone: "501-500-7201",
      mailingAddress: "Industrial Park, Ladyville",
      notes: "Primary consumables vendor"
    }
  });

  await prisma.product.create({
    data: {
      sku: "SVC-CLEAN-STD",
      name: "Standard cleaning service",
      kind: ProductKind.service,
      description: "Per-visit standard site cleaning",
      salesPrice: 150,
      purchaseCost: 0,
      taxable: false,
      incomeAccountId: salesRevenue.id,
      expenseAccountId: officeExpense.id
    }
  });

  console.log(`Seeded templates, admin user, payroll-ready data, and finance master data: ${email} / ${password}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
