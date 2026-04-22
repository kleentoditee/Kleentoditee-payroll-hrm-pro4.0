"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard/people/employees", label: "Employees" },
  { href: "/dashboard/people/templates", label: "Deduction templates" }
] as const;

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav aria-label="People section" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {links.map(({ href, label }) => {
          const active =
            href === "/dashboard/people/employees"
              ? pathname.startsWith("/dashboard/people/employees")
              : pathname.startsWith("/dashboard/people/templates");
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
