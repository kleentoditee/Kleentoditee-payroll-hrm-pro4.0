import { FINANCE_SECTIONS } from "./finance-nav";

/** Sidebar and Create menu - every `href` is a working route. */

export type NavItem = {
  label: string;
  href: string;
  icon?: string;
  description?: string;
  action?: "all-apps";
  /** Use exact route matching instead of treating descendants as active. */
  exact?: boolean;
  /** Routes owned by a section link when they do not share its URL prefix. */
  matchHrefs?: string[];
};

export type NavGroup = {
  id: string;
  title: string;
  icon: string;
  /** Workspace landing route — clicking the workspace name navigates here. */
  landingHref: string;
  items: NavItem[];
  /** Full destination list shown only in the searchable All Apps launcher. */
  launcherItems?: NavItem[];
};

const FINANCE_WORKSPACE_ITEMS: NavItem[] = FINANCE_SECTIONS.map((section) => ({
  label: section.label,
  href: section.href,
  exact: section.id === "overview",
  icon: section.id === "sales" ? "invoice" : section.id === "purchases" ? "receipt" : section.id === "banking" ? "wallet" : section.id === "reports" ? "bar-chart" : "calculator",
  description: section.id === "overview" ? "Finance overview and work queue." : `${section.label} workspace.`,
  matchHrefs:
    section.id === "overview"
      ? undefined
      : section.items.map((item) => item.href).filter((href) => href.startsWith("/dashboard/finance"))
}));

const FINANCE_LAUNCHER_ITEMS: NavItem[] = [
  { label: "Finance overview", href: "/dashboard/finance", icon: "wallet", description: "Finance overview and work queue." },
  ...FINANCE_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: section.id === "sales" ? "invoice" : section.id === "purchases" ? "receipt" : section.id === "banking" ? "wallet" : section.id === "reports" ? "bar-chart" : "calculator",
      description: item.description
    }))
  )
];

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    title: "Home",
    icon: "layout-dashboard",
    landingHref: "/dashboard",
    items: [{ label: "Home", href: "/dashboard", icon: "home" }]
  },
  {
    id: "people",
    title: "People",
    icon: "users",
    landingHref: "/dashboard/people",
    items: [
      { label: "Employees", href: "/dashboard/people/employees", icon: "users", description: "Manage employee records and payroll setup." },
      { label: "HR structure", href: "/dashboard/people/structure", icon: "building", description: "Departments, positions, cost centres, locations, schedules, contracts." },
      { label: "Staff requests", href: "/dashboard/people/requests", icon: "inbox", description: "Review employee requests and submissions." },
      { label: "Deduction templates", href: "/dashboard/people/templates", icon: "file-text", description: "Configure deductions used in payroll." },
      { label: "Leave balances", href: "/dashboard/people/leave", icon: "calendar", description: "Track annual, sick, and unpaid leave allowances and usage." }
    ]
  },
  {
    id: "time",
    title: "Time",
    icon: "clock",
    landingHref: "/dashboard/time",
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
    landingHref: "/dashboard/payroll",
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
    landingHref: "/dashboard/finance",
    items: FINANCE_WORKSPACE_ITEMS,
    launcherItems: FINANCE_LAUNCHER_ITEMS
  },
  {
    id: "reports",
    title: "Reports",
    icon: "bar-chart",
    landingHref: "/dashboard/reports",
    items: [
      { label: "Reports home", href: "/dashboard/reports", icon: "bar-chart", description: "View business reports." },
      { label: "Audit reports", href: "/dashboard/audit", icon: "scroll", description: "Review system and payroll audit history." }
    ]
  },
  {
    id: "admin",
    title: "Admin",
    icon: "shield",
    // No dedicated /dashboard/admin landing route exists yet; land on the
    // first Admin destination instead of opening a launcher or a 404.
    landingHref: "/dashboard/users",
    items: [
      { label: "Users & roles", href: "/dashboard/users", icon: "user-check", description: "Manage access and permissions." },
      { label: "Email queue", href: "/dashboard/email-queue", icon: "inbox", description: "Monitor transactional email delivery, retry failures." },
      { label: "Accounting import", href: "/dashboard/imports/accounting", icon: "cloud-upload", description: "Import accounting data from file exports." },
      { label: "Migration center", href: "/dashboard/imports/migration", icon: "cloud-upload", description: "Safe legacy-system migration with batches, validation, and rollback." },
      { label: "Settings", href: "/dashboard/settings", icon: "settings", description: "Configure workspace settings." }
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

export function isNavEntryActive(pathname: string, item: NavItem): boolean {
  if (item.matchHrefs?.some((href) => isNavItemActive(pathname, href))) return true;
  if (item.exact) {
    const norm = pathname.replace(/\/$/, "") || "/";
    const href = item.href.replace(/\/$/, "") || "/";
    return norm === href;
  }
  return isNavItemActive(pathname, item.href);
}
