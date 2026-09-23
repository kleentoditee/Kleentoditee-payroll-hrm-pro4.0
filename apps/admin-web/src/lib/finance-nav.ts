/**
 * Finance information architecture: six sections grouping every existing
 * finance destination (all 22 routes are preserved) plus the new overview.
 * Desktop section nav, the compact mobile selector, and breadcrumbs all
 * consume this single source.
 */

export type FinanceNavItem = {
  label: string;
  href: string;
  description: string;
};

export type FinanceSection = {
  id: string;
  label: string;
  /** Section landing route — always the first destination (or the overview). */
  href: string;
  items: FinanceNavItem[];
};

export const FINANCE_OVERVIEW_HREF = "/dashboard/finance";

export const FINANCE_SECTIONS: FinanceSection[] = [
  {
    id: "overview",
    label: "Overview",
    href: FINANCE_OVERVIEW_HREF,
    items: []
  },
  {
    id: "sales",
    label: "Sales",
    href: "/dashboard/finance/customers",
    items: [
      {
        label: "Customers",
        href: "/dashboard/finance/customers",
        description: "Manage customer records and balances."
      },
      {
        label: "Products & services",
        href: "/dashboard/finance/products",
        description: "Manage sale items and services."
      },
      {
        label: "Invoices",
        href: "/dashboard/finance/invoices",
        description: "Create, send, and review invoices."
      },
      {
        label: "Payments received",
        href: "/dashboard/finance/payments",
        description: "Record and review customer payments."
      }
    ]
  },
  {
    id: "purchases",
    label: "Purchases",
    href: "/dashboard/finance/suppliers",
    items: [
      {
        label: "Suppliers",
        href: "/dashboard/finance/suppliers",
        description: "Manage vendor and supplier records."
      },
      {
        label: "Bills",
        href: "/dashboard/finance/bills",
        description: "Track bills owed to suppliers."
      },
      {
        label: "Bill payments",
        href: "/dashboard/finance/bill-payments",
        description: "Record payments made to suppliers."
      },
      {
        label: "Expenses",
        href: "/dashboard/finance/expenses",
        description: "Track business expenses."
      }
    ]
  },
  {
    id: "banking",
    label: "Banking",
    href: "/dashboard/finance/deposits",
    items: [
      {
        label: "Deposits",
        href: "/dashboard/finance/deposits",
        description: "Record bank deposits."
      },
      {
        label: "Bank statements",
        href: "/dashboard/finance/statements",
        description: "Import and review bank statement lines."
      },
      {
        label: "Reconciliation",
        href: "/dashboard/finance/reconciliations",
        description: "Match bank activity to the books."
      },
      {
        label: "Bank register",
        href: "/dashboard/finance/register",
        description: "Review transactions per bank account."
      }
    ]
  },
  {
    id: "accounting",
    label: "Accounting",
    href: "/dashboard/finance/accounts",
    items: [
      {
        label: "Chart of accounts",
        href: "/dashboard/finance/accounts",
        description: "Manage accounting categories."
      },
      {
        label: "General journal",
        href: "/dashboard/finance/journal",
        description: "Posted ledger view of all journal entries."
      },
      {
        label: "Manual journals",
        href: "/dashboard/finance/journals",
        description: "Create, approve, post, and reverse manual journal entries."
      },
      {
        label: "Fiscal periods",
        href: "/dashboard/finance/periods",
        description: "Manage fiscal periods and close dates."
      }
    ]
  },
  {
    id: "reports",
    label: "Reports & compliance",
    href: "/dashboard/finance/financial-statements",
    items: [
      {
        label: "Financial statements",
        href: "/dashboard/finance/financial-statements",
        description: "Balance sheet and income statement."
      },
      {
        label: "Trial balance",
        href: "/dashboard/finance/trial-balance",
        description: "Account balances at a point in time."
      },
      {
        label: "AR/AP aging",
        href: "/dashboard/finance/aging",
        description: "Aged receivables and payables."
      },
      {
        label: "Year-end close",
        href: "/dashboard/finance/year-end",
        description: "Close the fiscal year."
      },
      {
        label: "Filing support",
        href: "/dashboard/finance/filing",
        description: "Prepare statutory filing data."
      },
      {
        label: "Finance reports",
        href: "/dashboard/reports",
        description: "Business reports across the workspace."
      }
    ]
  }
];

/** Exact-or-descendant match so /finance/journal doesn't also match /finance/journals. */
export function isFinanceItemActive(pathname: string, href: string): boolean {
  const norm = pathname.replace(/\/+$/, "") || "/";
  const h = href.replace(/\/+$/, "") || "/";
  return norm === h || norm.startsWith(`${h}/`);
}

/** The section that owns the current pathname (Overview for the finance root). */
export function getActiveFinanceSection(pathname: string): FinanceSection {
  const norm = pathname.replace(/\/+$/, "") || "/";
  if (norm === FINANCE_OVERVIEW_HREF) {
    return FINANCE_SECTIONS[0];
  }
  for (const section of FINANCE_SECTIONS) {
    if (section.id === "overview") {
      continue;
    }
    if (section.items.some((item) => isFinanceItemActive(norm, item.href))) {
      return section;
    }
  }
  return FINANCE_SECTIONS[0];
}

/** The specific destination that owns the pathname, if any. */
export function getActiveFinanceItem(pathname: string): FinanceNavItem | null {
  const section = getActiveFinanceSection(pathname);
  const norm = pathname.replace(/\/+$/, "") || "/";
  return section.items.find((item) => isFinanceItemActive(norm, item.href)) ?? null;
}

export type FinanceCrumb = {
  label: string;
  href?: string;
};

/**
 * Breadcrumb trail for a finance pathname, e.g.
 * Finance / Sales / Invoices. The final crumb has no href (current context).
 * Detail and creation pages append their own record crumb in a later phase.
 */
export function getFinanceBreadcrumbs(pathname: string): FinanceCrumb[] {
  const section = getActiveFinanceSection(pathname);
  const crumbs: FinanceCrumb[] = [
    { label: "Finance", href: section.id === "overview" ? undefined : FINANCE_OVERVIEW_HREF }
  ];
  if (section.id === "overview") {
    return crumbs;
  }
  const item = getActiveFinanceItem(pathname);
  if (!item) {
    crumbs.push({ label: section.label });
    return crumbs;
  }
  const last = { label: item.label };
  const middle: FinanceCrumb = { label: section.label, href: section.href };
  // Avoid a duplicated middle crumb when the section lands on the same item.
  if (section.href === item.href) {
    crumbs.push(last);
  } else {
    crumbs.push(middle, last);
  }
  return crumbs;
}
