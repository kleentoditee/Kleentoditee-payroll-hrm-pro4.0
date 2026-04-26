import Link from "next/link";

const CATALOG = [
  {
    title: "Payroll reports",
    description: "Pay periods, runs, paystubs, and exports. Build operational reports from finalized payroll data.",
    href: "/dashboard/payroll/runs",
    cta: "Open pay runs"
  },
  {
    title: "Time reports",
    description: "Timesheets, approvals, and entry history across employees and sites.",
    href: "/dashboard/time/entries",
    cta: "Time entries"
  },
  {
    title: "People reports",
    description: "Employee roster, roles, and deduction templates used for payroll.",
    href: "/dashboard/people/employees",
    cta: "Employees"
  },
  {
    title: "Finance reports",
    description: "Invoices, bills, payments, expenses, and deposits — document-centric views today.",
    href: "/dashboard/finance/invoices",
    cta: "Invoices"
  },
  {
    title: "Audit reports",
    description: "Recent administrative and auth events with actor and entity context.",
    href: "/dashboard/audit",
    cta: "Audit log"
  }
] as const;

export default function ReportsHomePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Reports</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-slate-900">Reports catalog</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Browse where each business area keeps its source data. Dedicated report builders and exports can be added
          without changing these entry points.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {CATALOG.map((cat) => (
          <li
            key={cat.title}
            className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold text-slate-900">{cat.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{cat.description}</p>
            <Link
              href={cat.href}
              className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline"
            >
              {cat.cta} →
            </Link>
          </li>
        ))}
      </ul>
      <p>
        <Link href="/dashboard" className="text-sm font-semibold text-brand hover:underline">
          ← Dashboard home
        </Link>
      </p>
    </div>
  );
}
