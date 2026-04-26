/** Sidebar and Create menu — every `href` is a real route (or dedicated Coming Soon page). */

export type NavItem = {
  label: string;
  href: string;
  /** Shown under the label in the sidebar (e.g. same destination, different intent). */
  hint?: string;
  /** Route exists but content is “coming soon”. */
  comingSoon?: boolean;
};

export type NavGroup = { id: string; title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    items: [{ label: "Home", href: "/dashboard" }]
  },
  {
    id: "people",
    title: "People",
    items: [
      { label: "Employees", href: "/dashboard/people/employees" },
      { label: "Deduction templates", href: "/dashboard/people/templates" },
      { label: "Users & roles", href: "/dashboard/users" }
    ]
  },
  {
    id: "time",
    title: "Time",
    items: [
      { label: "Time entries", href: "/dashboard/time/entries" },
      { label: "Approvals", href: "/dashboard/time/approvals" },
      { label: "Schedule", href: "/dashboard/schedule", comingSoon: true }
    ]
  },
  {
    id: "payroll",
    title: "Payroll",
    items: [
      { label: "Pay periods", href: "/dashboard/payroll/periods" },
      { label: "Pay runs", href: "/dashboard/payroll/runs" },
      {
        label: "Paystubs",
        href: "/dashboard/payroll/runs",
        hint: "Open a run, then a paystub from the line items"
      },
      {
        label: "Payroll exports",
        href: "/dashboard/payroll/runs",
        hint: "Export CSV from a run’s detail page"
      }
    ]
  },
  {
    id: "finance",
    title: "Finance",
    items: [
      { label: "Chart of accounts", href: "/dashboard/finance/accounts" },
      { label: "Customers", href: "/dashboard/finance/customers" },
      { label: "Suppliers", href: "/dashboard/finance/suppliers" },
      { label: "Products & services", href: "/dashboard/finance/products" },
      { label: "Invoices", href: "/dashboard/finance/invoices" },
      { label: "Bills", href: "/dashboard/finance/bills" },
      { label: "Payments received", href: "/dashboard/finance/payments" },
      { label: "Bill payments", href: "/dashboard/finance/bill-payments" },
      { label: "Expenses", href: "/dashboard/finance/expenses" },
      { label: "Deposits", href: "/dashboard/finance/deposits" }
    ]
  },
  {
    id: "reports",
    title: "Reports",
    items: [
      { label: "Reports home", href: "/dashboard/reports" },
      { label: "Audit reports", href: "/dashboard/audit" }
    ]
  },
  {
    id: "admin",
    title: "Admin",
    items: [
      { label: "Users & roles", href: "/dashboard/users" },
      { label: "Audit log", href: "/dashboard/audit" },
      { label: "Settings", href: "/dashboard/settings", comingSoon: true }
    ]
  }
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
