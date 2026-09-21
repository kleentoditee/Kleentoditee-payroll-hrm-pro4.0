/** Sidebar and Create menu - every `href` is a working route. */

export type NavItem = {
  label: string;
  href: string;
  icon?: string;
  description?: string;
  action?: "all-apps";
};

export type NavGroup = { id: string; title: string; icon: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "layout-dashboard",
    items: [{ label: "Home", href: "/dashboard", icon: "home" }]
  },
  {
    id: "people",
    title: "People",
    icon: "users",
    items: [
      { label: "Employees", href: "/dashboard/people/employees", icon: "users", description: "Manage employee records and payroll setup." },
      { label: "Staff requests", href: "/dashboard/people/requests", icon: "inbox", description: "Review employee requests and submissions." },
      { label: "Deduction templates", href: "/dashboard/people/templates", icon: "file-text", description: "Configure deductions used in payroll." },
      { label: "Leave balances", href: "/dashboard/people/leave", icon: "calendar", description: "Track annual, sick, and unpaid leave allowances and usage." }
    ]
  },
  {
    id: "time",
    title: "Time",
    icon: "clock",
    items: [
      { label: "Time entries", href: "/dashboard/time/entries", icon: "clock", description: "Review submitted work time." },
      { label: "Approvals", href: "/dashboard/time/approvals", icon: "activity", description: "Approve pending time entries." },
      { label: "Work schedule", href: "/dashboard/schedule", icon: "calendar", description: "Manage staff schedules." },
      { label: "Staff announcements", href: "/dashboard/announcements", icon: "megaphone", description: "Share updates with staff." }
    ]
  },
  {
    id: "payroll",
    title: "Payroll",
    icon: "dollar-sign",
    items: [
      { label: "Pay periods", href: "/dashboard/payroll/periods", icon: "calendar", description: "Create and manage payroll periods." },
      { label: "Pay runs", href: "/dashboard/payroll/runs", icon: "dollar-sign", description: "Build, review, and finalize payroll." },
      { label: "Paystubs", href: "/dashboard/payroll/paystubs/preview", icon: "receipt", description: "View and print employee paystubs." },
      { label: "Government forms", href: "/dashboard/payroll/forms", icon: "file-text", description: "Preview and download BVI NHI and SSB forms." },
      { label: "YTD import", href: "/dashboard/payroll/ytd-import", icon: "receipt", description: "Import historical year-to-date payroll opening balances." },
      { label: "Reports", href: "/dashboard/payroll/reports", icon: "file-text", description: "Payroll register, year summary, and reconciliation." }
    ]
  },
  {
    id: "finance",
    title: "Finance",
    icon: "wallet",
    items: [
      { label: "Chart of accounts", href: "/dashboard/finance/accounts", icon: "building", description: "Manage accounting categories." },
      { label: "Customers", href: "/dashboard/finance/customers", icon: "users", description: "Manage customer records." },
      { label: "Suppliers", href: "/dashboard/finance/suppliers", icon: "building", description: "Manage vendor and supplier records." },
      { label: "Products & services", href: "/dashboard/finance/products", icon: "package", description: "Manage sale items and services." },
      { label: "Invoices", href: "/dashboard/finance/invoices", icon: "invoice", description: "Create and review invoices." },
      { label: "Bills", href: "/dashboard/finance/bills", icon: "receipt", description: "Track bills owed." },
      { label: "Payments received", href: "/dashboard/finance/payments", icon: "credit-card", description: "Record customer payments." },
      { label: "Bill payments", href: "/dashboard/finance/bill-payments", icon: "arrow-down-left", description: "Record vendor payments." },
      { label: "Expenses", href: "/dashboard/finance/expenses", icon: "receipt", description: "Track business expenses." },
      { label: "Deposits", href: "/dashboard/finance/deposits", icon: "wallet", description: "Record deposits." }
    ]
  },
  {
    id: "reports",
    title: "Reports",
    icon: "bar-chart",
    items: [
      { label: "Reports home", href: "/dashboard/reports", icon: "bar-chart", description: "View business reports." },
      { label: "Audit reports", href: "/dashboard/audit", icon: "scroll", description: "Review system and payroll audit history." }
    ]
  },
  {
    id: "admin",
    title: "Admin",
    icon: "shield",
    items: [
      { label: "Users & roles", href: "/dashboard/users", icon: "user-check", description: "Manage access and permissions." },
      { label: "Email queue", href: "/dashboard/email-queue", icon: "inbox", description: "Monitor transactional email delivery, retry failures." },
      { label: "Accounting import", href: "/dashboard/imports/accounting", icon: "cloud-upload", description: "Import accounting data from file exports." },
      { label: "Migration center", href: "/dashboard/imports/migration", icon: "cloud-upload", description: "Safe legacy-system migration with batches, validation, and rollback." },
      { label: "Settings", href: "/dashboard/settings", icon: "settings", description: "Configure workspace settings." }
    ]
  }
];

export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "home" },
  { label: "Activity", href: "/dashboard/audit", icon: "activity" },
  { label: "Reports", href: "/dashboard/reports", icon: "bar-chart" },
  { label: "All apps", href: "#all-apps", icon: "grid", action: "all-apps" }
];

export const PINNED_SHORTCUTS: NavItem[] = [
  { label: "Accounting", href: "/dashboard/finance/accounts", icon: "calculator" },
  { label: "Expenses", href: "/dashboard/finance/expenses", icon: "receipt" },
  { label: "Sales", href: "/dashboard/finance/invoices", icon: "invoice" },
  { label: "Payroll", href: "/dashboard/payroll/runs", icon: "dollar-sign" },
  { label: "Time", href: "/dashboard/time/entries", icon: "clock" },
  { label: "Employees", href: "/dashboard/people/employees", icon: "users" }
];

export type CreateAction = {
  label: string;
  href: string;
  /** If set, action is only shown when user has one of these roles. */
  roles?: readonly string[];
};

export const CREATE_ACTIONS: CreateAction[] = [
  { label: "Add employee", href: "/dashboard/people/employees/new" },
  { label: "Add time entry", href: "/dashboard/time/entries/new" },
  { label: "Approve time", href: "/dashboard/time/approvals" },
  { label: "Create pay period", href: "/dashboard/payroll/periods" },
  { label: "View pay runs", href: "/dashboard/payroll/runs" },
  { label: "Create invoice", href: "/dashboard/finance/invoices/new" },
  { label: "Record expense", href: "/dashboard/finance/expenses/new" },
  { label: "Invite user", href: "/dashboard/users/new", roles: ["platform_owner"] as const }
];

/** Active nav: exact match for home; prefix match for deeper sections. */
export function isNavItemActive(pathname: string, href: string): boolean {
  const norm = pathname.replace(/\/$/, "") || "/";
  const h = href.replace(/\/$/, "") || "/";
  if (h === "/dashboard") {
    return norm === "/dashboard";
  }
  return norm === h || norm.startsWith(`${h}/`);
}
