"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/finance/accounts", label: "Chart of accounts" },
  { href: "/dashboard/finance/customers", label: "Customers" },
  { href: "/dashboard/finance/suppliers", label: "Suppliers" },
  { href: "/dashboard/finance/products", label: "Products & services" }
] as const;

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav aria-label="Finance section" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {links.map(({ href, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
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
