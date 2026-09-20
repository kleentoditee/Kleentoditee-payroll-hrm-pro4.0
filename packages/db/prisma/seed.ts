import bcrypt from "bcryptjs";
import {
  AccountType,
  PayBasis,
  PaySchedule,
  ProductKind,
  Role,
  StaffAnnouncementAudience,
  StaffAnnouncementCategory,
  StaffRequestStatus,
  StaffRequestType,
  TimeEntryStatus,
  UserStatus,
  WorkAssignmentStatus
} from "@prisma/client";
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
  await prisma.rewardLedger.deleteMany();
  await prisma.staffQuizAttempt.deleteMany();
  await prisma.staffQuizQuestion.deleteMany();
  await prisma.workAssignment.deleteMany();
  await prisma.staffAnnouncement.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.staffRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.deductionTemplate.deleteMany();
  // Finance transactions must come down before their parents because the
  // join tables hold Restrict references to invoices, bills, and payments.
  await prisma.depositLine.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.paymentApplication.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.billPaymentApplication.deleteMany();
  await prisma.billPayment.deleteMany();
  await prisma.expenseLine.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.billLine.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.account.deleteMany();
  await prisma.userInvitation.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // Single default tenant (Batch 12).
  const ORG_ID = "org_kleentoditee";
  await prisma.organization.create({
    data: { id: ORG_ID, name: "KleenToDiTee", slug: "kleentoditee" }
  });

  const standardTemplate = await prisma.deductionTemplate.create({
    data: {
      orgId: ORG_ID,
      name: "Standard deductions",
      nhiRate: 0.0375,
      ssbRate: 0.04,
      incomeTaxRate: 0,
      applyNhi: true,
      applySsb: true,
      applyIncomeTax: false
    }
  });

  // BVI has NO income tax (rate zero since the Payroll Taxes Act, 2004). The
  // legacy "income tax" template was misleading; payroll tax is computed from the
  // statutory config, never from template incomeTaxRate (which calc forces to 0).
  const taxedTemplate = await prisma.deductionTemplate.create({
    data: {
      orgId: ORG_ID,
      name: "NHI + SSB (full statutory)",
      nhiRate: 0.0375,
      ssbRate: 0.04,
      incomeTaxRate: 0,
      applyNhi: true,
      applySsb: true,
      applyIncomeTax: false
    }
  });

  const manualTemplate = await prisma.deductionTemplate.create({
    data: {
      orgId: ORG_ID,
      name: "Manual deductions only",
      nhiRate: 0,
      ssbRate: 0,
      incomeTaxRate: 0,
      applyNhi: false,
      applySsb: false,
      applyIncomeTax: false
    }
  });

  const adminUser = await prisma.user.create({
    data: {
      email,
      emailCanonical: email,
      passwordHash: hash,
      name,
      status: UserStatus.active,
      roles: {
        create: [
          { role: Role.platform_owner },
          { role: Role.payroll_admin },
          { role: Role.hr_admin }
        ]
      },
      memberships: { create: [{ orgId: ORG_ID }] }
    }
  });

  const monthlyEmployee = await prisma.employee.create({
    data: {
      orgId: ORG_ID,
      fullName: "Maria Monthly",
      role: "Lead cleaner",
      defaultSite: "Road Town",
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
      notes: "",
      templateId: standardTemplate.id
    }
  });

  // Tracker demo user: active, employee_tracker_user only, same bcrypt hash as seed admin,
  // linked to Maria Monthly employee (required for /time/self/*).
  const mariaEmail = "maria.tracker@kleentoditee.local";
  await prisma.user.create({
    data: {
      email: mariaEmail,
      emailCanonical: mariaEmail,
      passwordHash: hash,
      name: "Maria Monthly",
      employeeId: monthlyEmployee.id,
      status: UserStatus.active,
      roles: { create: [{ role: Role.employee_tracker_user }] },
      memberships: { create: [{ orgId: ORG_ID }] }
    }
  });

  const adminForSeed = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  const todayUtc = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  await prisma.workAssignment.create({
    data: {
      orgId: ORG_ID,
      employeeId: monthlyEmployee.id,
      date: todayUtc,
      startTime: "08:00",
      endTime: "16:00",
      locationName: "Road Town - Main site",
      locationAddress: "",
      notes: "Bring your ID badge.",
      status: WorkAssignmentStatus.SCHEDULED,
      createdByUserId: adminForSeed?.id
    }
  });
  await prisma.staffAnnouncement.create({
    data: {
      orgId: ORG_ID,
      title: "Welcome to Staff Hub",
      body: "Check Today for your work location.",
      category: StaffAnnouncementCategory.GENERAL,
      audience: StaffAnnouncementAudience.EMPLOYEES,
      active: true,
      createdByUserId: adminForSeed?.id
    }
  });
  await prisma.staffQuizQuestion.create({
    data: {
      orgId: ORG_ID,
      question: "What should you do before starting a shift?",
      choices: ["Skip the safety checklist", "Review site hazards and PPE", "Ignore posted procedures"],
      correctIndex: 1,
      explanation: "Reviewing hazards and PPE helps keep you and the team safe.",
      active: true
    }
  });

  const weeklyEmployee = await prisma.employee.create({
    data: {
      orgId: ORG_ID,
      fullName: "Wendy Weekly",
      role: "Site supervisor",
      defaultSite: "Virgin Gorda",
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
      notes: "",
      templateId: taxedTemplate.id
    }
  });

  const biweeklyEmployee = await prisma.employee.create({
    data: {
      orgId: ORG_ID,
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
      notes: "",
      templateId: manualTemplate.id
    }
  });

  await prisma.timeEntry.createMany({
    data: [
      {
        orgId: ORG_ID,
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
        notes: ""
      },
      {
        orgId: ORG_ID,
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
        notes: ""
      },
      {
        orgId: ORG_ID,
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
        notes: ""
      }
    ]
  });

  await prisma.staffRequest.createMany({
    data: [
      {
        orgId: ORG_ID,
        employeeId: monthlyEmployee.id,
        type: StaffRequestType.TIME_OFF,
        status: StaffRequestStatus.SUBMITTED,
        subject: "Family event",
        startDate: new Date("2026-05-04T00:00:00.000Z"),
        endDate: new Date("2026-05-06T00:00:00.000Z"),
        reason: "Family wedding out of town",
        details: "Three working days requested. Coverage arranged with team lead."
      },
      {
        orgId: ORG_ID,
        employeeId: weeklyEmployee.id,
        type: StaffRequestType.JOB_LETTER,
        status: StaffRequestStatus.UNDER_REVIEW,
        subject: "Embassy letter",
        reason: "Travel visa application",
        details: "Need salary, role, and start date addressed to the visa office."
      },
      {
        orgId: ORG_ID,
        employeeId: biweeklyEmployee.id,
        type: StaffRequestType.SUPPLIES_REQUEST,
        status: StaffRequestStatus.SUBMITTED,
        subject: "Cleaning consumables",
        details: "Two boxes of all-purpose cleaner and three packs of microfiber cloths for Ladyville site."
      }
    ]
  });

  // One pay period for the dashboard.
  await prisma.payPeriod.create({
    data: {
      orgId: ORG_ID,
      label: "April 2026 (monthly)",
      schedule: PaySchedule.monthly,
      startDate: new Date("2026-04-01T00:00:00.000Z"),
      endDate: new Date("2026-04-30T00:00:00.000Z"),
      payDate: new Date("2026-04-28T00:00:00.000Z"),
      notes: ""
    }
  });

  const [cash, ar, ap, salesRevenue, cogs, officeExpense] = await Promise.all([
    prisma.account.create({
      data: {
        orgId: ORG_ID,
        code: "1000",
        name: "Cash",
        type: AccountType.asset,
        subtype: "Bank",
        description: "Primary operating cash account"
      }
    }),
    prisma.account.create({
      data: {
        orgId: ORG_ID,
        code: "1100",
        name: "Accounts Receivable",
        type: AccountType.asset,
        subtype: "Accounts Receivable",
        description: "Amounts owed by customers"
      }
    }),
    prisma.account.create({
      data: {
        orgId: ORG_ID,
        code: "2000",
        name: "Accounts Payable",
        type: AccountType.liability,
        subtype: "Accounts Payable",
        description: "Amounts owed to suppliers"
      }
    }),
    prisma.account.create({
      data: {
        orgId: ORG_ID,
        code: "4000",
        name: "Sales Revenue",
        type: AccountType.revenue,
        subtype: "Sales",
        description: "Revenue from services rendered"
      }
    }),
    prisma.account.create({
      data: {
        orgId: ORG_ID,
        code: "5000",
        name: "Cost of Goods Sold",
        type: AccountType.expense,
        subtype: "Direct Costs",
        description: "Direct costs of delivering services"
      }
    }),
    prisma.account.create({
      data: {
        orgId: ORG_ID,
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

  // GL control accounts (Batch 8) — upsert by code so reseeds stay additive.
  // The API's posting engine auto-provisions these too; seeding keeps a fresh
  // install complete without posting activity.
  const controlAccounts = [
    { code: "2100", name: "NHI Payable", type: AccountType.liability, subtype: "Payroll Liabilities" },
    { code: "2200", name: "SSB Payable", type: AccountType.liability, subtype: "Payroll Liabilities" },
    { code: "2300", name: "Payroll Tax Payable", type: AccountType.liability, subtype: "Payroll Liabilities" },
    { code: "2500", name: "Net Wages Payable", type: AccountType.liability, subtype: "Payroll Liabilities" },
    { code: "2600", name: "Other Payroll Deductions Payable", type: AccountType.liability, subtype: "Payroll Liabilities" },
    { code: "2700", name: "Tax Payable", type: AccountType.liability, subtype: "Taxes" },
    { code: "6100", name: "Wages & Salaries", type: AccountType.expense, subtype: "Payroll" },
    { code: "6200", name: "Employer Statutory Contributions", type: AccountType.expense, subtype: "Payroll" }
  ];
  for (const account of controlAccounts) {
    await prisma.account.upsert({
      where: { orgId_code: { orgId: ORG_ID, code: account.code } },
      update: {},
      create: { orgId: ORG_ID, ...account, description: "GL control account" }
    });
  }

  const sampleCustomer = await prisma.customer.create({
    data: {
      orgId: ORG_ID,
      displayName: "Tortola Bay Resort",
      companyName: "Tortola Bay Resort Ltd.",
      primaryContact: "Sandra Torres",
      email: "ap@tortolabay.example",
      phone: "501-500-7001",
      billingAddress: "Road Town, Tortola, British Virgin Islands",
      notes: "Weekly housekeeping contract"
    }
  });

  const sampleSupplier = await prisma.supplier.create({
    data: {
      orgId: ORG_ID,
      displayName: "Caribbean Cleaning Supply",
      companyName: "Caribbean Cleaning Supply Co.",
      primaryContact: "Miguel Ramos",
      email: "orders@ccsupply.example",
      phone: "501-500-7201",
      mailingAddress: "Industrial Park, Ladyville",
      notes: "Primary consumables vendor"
    }
  });

  const sampleProduct = await prisma.product.create({
    data: {
      orgId: ORG_ID,
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

  const year = new Date().getFullYear();
  await prisma.invoice.create({
    data: {
      orgId: ORG_ID,
      number: `INV-${year}-0001`,
      customerId: sampleCustomer.id,
      issueDate: new Date(`${year}-04-15T00:00:00.000Z`),
      dueDate: new Date(`${year}-05-15T00:00:00.000Z`),
      memo: "Weekly housekeeping",
      subtotal: 300,
      taxTotal: 0,
      total: 300,
      amountPaid: 0,
      balance: 300,
      lines: {
        create: [
          {
            position: 1,
            orgId: ORG_ID,
            productId: sampleProduct.id,
            description: "Weekly housekeeping - 2 visits",
            quantity: 2,
            unitPrice: 150,
            amount: 300,
            incomeAccountId: salesRevenue.id
          }
        ]
      }
    }
  });

  await prisma.bill.create({
    data: {
      orgId: ORG_ID,
      number: `BILL-${year}-0001`,
      supplierId: sampleSupplier.id,
      billDate: new Date(`${year}-04-18T00:00:00.000Z`),
      dueDate: new Date(`${year}-05-18T00:00:00.000Z`),
      memo: "Monthly consumables",
      subtotal: 145,
      taxTotal: 0,
      total: 145,
      amountPaid: 0,
      balance: 145,
      lines: {
        create: [
          {
            orgId: ORG_ID,
            position: 1,
            description: "Consumables box",
            quantity: 1,
            unitCost: 95,
            amount: 95,
            expenseAccountId: officeExpense.id
          },
          {
            position: 2,
            description: "Mop heads",
            quantity: 4,
            unitCost: 12.5,
            amount: 50,
            expenseAccountId: officeExpense.id
          }
        ]
      }
    }
  });

  // Statutory verification baseline: seed the current year's BVI rates as an
  // UNVERIFIED version (no source/verification/approval). Payroll keeps using
  // OrgSettings; this row records what the live defaults claim to be so the
  // settings UI can flag them until they are checked against official sources.
  const statutoryYear = new Date().getFullYear();
  const existingVersion = await prisma.statutoryRateVersion.findFirst({
    where: { effectiveYear: statutoryYear }
  });
  if (!existingVersion) {
    await prisma.statutoryRateVersion.create({
      data: {
        orgId: ORG_ID,
        effectiveYear: statutoryYear,
        ssbEmployeeRate: 0.04,
        ssbEmployerRate: 0.045,
        ssbAnnualCeiling: 53400,
        ssbEnabled: true,
        nhiEmployeeRate: 0.0375,
        nhiEmployerRate: 0.0375,
        nhiAnnualCeiling: 106800,
        nhiEnabled: true,
        payrollTaxEmployeeRate: 0.08,
        payrollTaxEmployerClass: "CLASS_1",
        payrollTaxAnnualExemption: 10000,
        payrollTaxEnabled: true,
        sourceUrl: "https://bvi.gov.vg/sites/default/files/resources/Guide%20to%20Payroll%20Tax.pdf",
        verifiedBy: "Kimi Batch 11 (2026-09-19): NHI 2026 bulletin vinhi.vg; SSB form bvissb.vg",
        approvedBy: "Owner directive 2026-09-19"
      }
    });
  }

  // Leave policies (R8): default annual/sick/unpaid schemes. Upsert by code so
  // seeding never overwrites admin edits to allowances or paid flags.
  const defaultLeavePolicies = [
    { code: "ANNUAL", name: "Annual vacation", requestType: "TIME_OFF" as const, paid: true, annualAllowanceDays: 15, sortOrder: 1 },
    { code: "SICK", name: "Sick leave", requestType: "SICK_LEAVE" as const, paid: true, annualAllowanceDays: 12, sortOrder: 2 },
    { code: "UNPAID", name: "Unpaid leave", requestType: "UNPAID_LEAVE" as const, paid: false, annualAllowanceDays: 0, sortOrder: 3 }
  ];
  for (const policy of defaultLeavePolicies) {
    await prisma.leavePolicy.upsert({
      where: { orgId_code: { orgId: ORG_ID, code: policy.code } },
      create: { orgId: ORG_ID, ...policy },
      update: {}
    });
  }

  console.log(
    `Seeded templates, admin, one pay period, employee tracker login, payroll-ready time, sample staff requests (time off, job letter, supplies), finance (accounts, customer, AR/AP), and draft invoice + bill. Admin: ${email} / ${password} — Tracker: maria.tracker@kleentoditee.local / ${password}`
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
