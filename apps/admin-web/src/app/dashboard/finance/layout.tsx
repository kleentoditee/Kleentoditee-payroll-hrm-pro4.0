"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard/finance/accounts", label: "Chart of accounts" },
  { href: "/dashboard/finance/customers", label: "Customers" },
  { href: "/dashboard/finance/suppliers", label: "Suppliers" },
  { href: "/dashboard/finance/products", label: "Products & services" },
  { href: "/dashboard/finance/invoices", label: "Invoices" },
  { href: "/dashboard/finance/payments", label: "Payments" },
  { href: "/dashboard/finance/bills", label: "Bills" },
  { href: "/dashboard/finance/bill-payments", label: "Bill payments" },
  { href: "/dashboard/finance/expenses", label: "Expenses" },
  { href: "/dashboard/finance/deposits", label: "Deposits" },
  { href: "/dashboard/finance/journal", label: "Journal" },
  { href: "/dashboard/finance/journals", label: "Manual journals" },
  { href: "/dashboard/finance/periods", label: "Fiscal periods" },
  { href: "/dashboard/finance/statements", label: "Bank statements" },
  { href: "/dashboard/finance/reconciliations", label: "Reconciliation" },
  { href: "/dashboard/finance/register", label: "Bank register" },
  { href: "/dashboard/finance/financial-statements", label: "Financial statements" },
  { href: "/dashboard/finance/aging", label: "Aging" },
  { href: "/dashboard/finance/year-end", label: "Year-end close" },
  { href: "/dashboard/finance/filing", label: "Filing support" },
  { href: "/dashboard/finance/trial-balance", label: "Trial balance" },
  { href: "/dashboard/reports", label: "Reports" }
] as const;

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="space-y-6">
      <label className="block text-sm font-medium text-slate-700 sm:hidden">
        Finance page
        <select
          value={links.find((item) => pathname.startsWith(item.href))?.href ?? links[0].href}
          onChange={(e) => router.push(e.target.value)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5"
        >
          {links.map(({ href, label }) => <option key={href} value={href}>{label}</option>)}
        </select>
      </label>
      <nav aria-label="Finance section" className="hidden flex-wrap gap-2 border-b border-slate-200 pb-3 sm:flex">
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
