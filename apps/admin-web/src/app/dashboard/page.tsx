import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Home</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          You are signed in to the new admin shell. Global search, widgets, and payroll APIs come in later
          phases. Audit events from login and future mutations are stored in PostgreSQL.
        </p>
        <p className="mt-4 flex flex-wrap gap-4">
          <Link
            href="/dashboard/people/employees"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            People — employees →
          </Link>
          <Link
            href="/dashboard/time/entries"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            Time — timesheets →
          </Link>
          <Link
            href="/dashboard/audit"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            Audit log →
          </Link>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Needs attention", body: "Pending approvals and exceptions will appear here." },
          { title: "Payroll status", body: "Phase 2 will connect live payroll state to this console." },
          {
            title: "Legacy payroll data",
            body: "Employees and runs in the browser app are still at http://localhost:8081 until migrated."
          },
          { title: "API", body: "Authenticated routes use JWT from /auth/login. Health check stays public at /health." }
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-700"
          >
            <h3 className="font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-2 leading-relaxed">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
