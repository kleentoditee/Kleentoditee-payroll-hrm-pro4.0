"use client";

import { CREATE_ACTIONS } from "@/lib/dashboard-nav";
import Link from "next/link";
import type { ReactNode } from "react";

const cardClass =
  "rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm shadow-slate-200/60";

export type AuditDay = { dayKey: string; count: number };

export type BusinessOverviewData = {
  activeEmployees: number | null;
  employeesError: string | null;
  submittedTime: number | null;
  timeError: string | null;
  draftRuns: number | null;
  payrollError: string | null;
  invoiceCount: number | null;
  financeError: string | null;
  billsCount: number | null;
  billsError: string | null;
  pendingInvites: number | null;
  invitedUsers: number | null;
  usersAccess: "ok" | "forbidden" | "error";
  auditPreview: { action: string; createdAt: string; actorLabel: string } | null;
  auditError: string | null;
  auditByDay: AuditDay[];
  periodCount: number | null;
  latestPeriod: { label: string; payDate: string | null; endDate: string } | null;
  nextPayroll: { label: string; payDate: string } | null;
  periodsError: string | null;
};

const MODULES: { label: string; abbr: string; href: string; ring: string }[] = [
  { label: "People", abbr: "P", href: "/dashboard/people/employees", ring: "ring-teal-600/20 bg-teal-600" },
  { label: "Time", abbr: "T", href: "/dashboard/time/entries", ring: "ring-sky-600/20 bg-sky-600" },
  { label: "Payroll", abbr: "Pr", href: "/dashboard/payroll/periods", ring: "ring-violet-600/20 bg-violet-600" },
  { label: "Finance", abbr: "F", href: "/dashboard/finance", ring: "ring-emerald-600/20 bg-emerald-600" },
  { label: "Reports", abbr: "R", href: "/dashboard/reports", ring: "ring-indigo-600/20 bg-indigo-600" },
  { label: "Users", abbr: "U", href: "/dashboard/users", ring: "ring-rose-600/20 bg-rose-600" },
  { label: "Audit", abbr: "A", href: "/dashboard/audit", ring: "ring-slate-600/20 bg-slate-700" }
];

function StatusBadge({ tone, children }: { tone: "ok" | "warn" | "muted"; children: ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function SegmentedQueueBar({ count }: { count: number }) {
  const cap = 6;
  const lit = Math.min(count, cap);
  return (
    <div className="flex gap-1" aria-label={`Queue depth ${count}`}>
      {Array.from({ length: cap }, (_, i) => (
        <div
          key={i}
          className={`h-2 flex-1 rounded-full ${i < lit ? "bg-amber-500" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function ReadinessRing({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const r = 36;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" className="stroke-slate-200" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className="stroke-brand transition-[stroke-dasharray] duration-500"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold text-slate-900">{completed}/{total}</span>
        <span className="text-[0.65rem] font-medium uppercase tracking-wide text-slate-500">checks</span>
      </div>
    </div>
  );
}

function AuditSparkline({ days }: { days: AuditDay[] }) {
  const w = 240;
  const h = 56;
  const pad = 4;
  const max = Math.max(1, ...days.map((d) => d.count));
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const pts = days.map((d, i) => {
    const x = pad + (i / Math.max(1, days.length - 1)) * innerW;
    const y = pad + innerH - (d.count / max) * innerH;
    return `${x},${y}`;
  });
  const line = pts.join(" ");

  return (
    <div>
      <svg width={w} height={h} className="text-brand" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={line}
        />
        {days.map((d, i) => {
          const x = pad + (i / Math.max(1, days.length - 1)) * innerW;
          const y = pad + innerH - (d.count / max) * innerH;
          return <circle key={d.dayKey} cx={x} cy={y} r="3.5" className="fill-white stroke-2 stroke-brand" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[0.65rem] font-medium text-slate-500">
        {days.map((d) => (
          <span key={d.dayKey} className="w-8 text-center">
            {d.dayKey.slice(5).replace("-", "/")}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[0.65rem] text-slate-500">Event counts from the audit log (last 7 days).</p>
    </div>
  );
}

function DonutPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 100 100" className="-rotate-90" aria-hidden>
          <circle cx="50" cy="50" r="38" fill="none" className="stroke-slate-200" strokeWidth="12" />
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            className="stroke-slate-300"
            strokeWidth="12"
            strokeDasharray="60 180"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="text-xs leading-snug text-slate-600">{label}</p>
    </div>
  );
}

export function BusinessOperatingDashboard({
  data,
  userRoles
}: {
  data: BusinessOverviewData;
  userRoles: string[];
}) {
  const createItems = CREATE_ACTIONS.filter(
    (a) => !a.roles || a.roles.some((r) => userRoles.includes(r))
  );

  const hasEmployees = (data.activeEmployees ?? 0) > 0;
  const hasPeriods = (data.periodCount ?? 0) > 0;
  const timeQueueClear = !data.timeError && (data.submittedTime ?? 0) === 0;
  const readinessSteps: { label: string; ok: boolean; href: string }[] = [
    {
      label: "Active employees on file",
      ok: !data.employeesError && hasEmployees,
      href: "/dashboard/people/employees"
    },
    {
      label: "Pay periods configured",
      ok: !data.periodsError && hasPeriods,
      href: "/dashboard/payroll/periods"
    },
    {
      label: "Approval queue clear (no submitted time waiting)",
      ok: timeQueueClear,
      href: "/dashboard/time/approvals"
    }
  ];
  const completed = readinessSteps.filter((s) => s.ok).length;

  return (
    <div className="space-y-10 pb-8">
      <header className="border-b border-slate-200/80 pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KleenToDiTee · Console</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-slate-900">Business overview</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          A single place to see payroll, time, finance, and governance signals. Metrics come from live API data when your
          role allows; gaps are labeled honestly with links to the underlying work — no fabricated figures.
        </p>
      </header>

      {/* Module shortcuts */}
      <section aria-label="Module shortcuts">
        <h2 className="text-sm font-semibold text-slate-800">Modules</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {MODULES.map((m) => (
            <Link
              key={m.label}
              href={m.href}
              className="group flex min-w-[4.5rem] flex-col items-center gap-2 text-center"
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ring-2 ${m.ring} transition group-hover:brightness-110`}
              >
                <span className={m.abbr.length > 1 ? "text-[0.7rem]" : ""}>{m.abbr}</span>
              </span>
              <span className="max-w-[5.5rem] text-xs font-medium leading-tight text-slate-700 group-hover:text-brand">
                {m.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Create actions */}
      <section aria-label="Create actions">
        <h2 className="text-sm font-semibold text-slate-800">Create</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {createItems.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Business at a glance */}
      <section aria-label="Business at a glance">
        <h2 className="text-sm font-semibold text-slate-800">At a glance</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {/* Payroll readiness */}
          <article className={cardClass}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payroll readiness</p>
                <p className="mt-1 text-sm text-slate-600">Operational checks before you run payroll.</p>
              </div>
              {completed === readinessSteps.length ? (
                <StatusBadge tone="ok">Ready</StatusBadge>
              ) : (
                <StatusBadge tone="warn">Attention</StatusBadge>
              )}
            </div>
            <div className="mt-4 flex gap-4">
              <ReadinessRing completed={completed} total={readinessSteps.length} />
              <ul className="flex-1 space-y-2 text-sm">
                {readinessSteps.map((s) => (
                  <li key={s.label} className="flex items-start gap-2">
                    <span className={s.ok ? "text-emerald-600" : "text-amber-600"}>{s.ok ? "✓" : "!"}</span>
                    <Link href={s.href} className="font-medium text-slate-800 hover:text-brand hover:underline">
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {data.draftRuns !== null && data.draftRuns > 0 && !data.payrollError ? (
              <p className="mt-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">{data.draftRuns}</span> draft pay run
                {data.draftRuns === 1 ? "" : "s"} in progress.{" "}
                <Link href="/dashboard/payroll/runs" className="font-semibold text-brand hover:underline">
                  Review runs
                </Link>
              </p>
            ) : null}
            <Link
              href="/dashboard/payroll/periods"
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Pay periods & runs →
            </Link>
          </article>

          {/* Time approvals */}
          <article className={cardClass}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time approvals</p>
              {data.timeError ? (
                <StatusBadge tone="muted">Unknown</StatusBadge>
              ) : (data.submittedTime ?? 0) > 0 ? (
                <StatusBadge tone="warn">Review</StatusBadge>
              ) : (
                <StatusBadge tone="ok">Clear</StatusBadge>
              )}
            </div>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{data.submittedTime === null ? "—" : data.submittedTime}</p>
            <p className="mt-1 text-sm text-slate-600">Submitted timesheets in the approval queue (all months).</p>
            {data.timeError ? (
              <p className="mt-2 text-sm text-amber-800">{data.timeError}</p>
            ) : (
              <div className="mt-4">
                <p className="text-xs font-medium text-slate-500">Queue depth (capped at 6 segments)</p>
                <div className="mt-1.5">
                  <SegmentedQueueBar count={data.submittedTime ?? 0} />
                </div>
              </div>
            )}
            <Link href="/dashboard/time/approvals" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
              Open approval queue →
            </Link>
          </article>

          {/* Active employees */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active employees</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{data.activeEmployees === null ? "—" : data.activeEmployees}</p>
            {data.employeesError ? (
              <p className="mt-2 text-sm text-amber-800">{data.employeesError}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Headcount with active status in People.</p>
            )}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{
                  width: hasEmployees ? "100%" : "0%"
                }}
              />
            </div>
            <p className="mt-1 text-[0.65rem] text-slate-500">Bar indicates whether the roster is populated (on/off).</p>
            <Link href="/dashboard/people/employees" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              Manage people →
            </Link>
          </article>

          {/* Finance — invoices */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finance · Invoices</p>
            <p className="mt-3 text-4xl font-semibold text-slate-900">{data.invoiceCount === null ? "—" : data.invoiceCount}</p>
            {data.financeError ? (
              <p className="mt-2 text-sm text-amber-800">{data.financeError}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Invoice documents on file (all statuses).</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/dashboard/finance/invoices"
                className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                Invoices
              </Link>
              <Link
                href="/dashboard/finance/bills"
                className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                Bills
              </Link>
              <Link
                href="/dashboard/finance/expenses"
                className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                Expenses
              </Link>
            </div>
          </article>

          {/* Users */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users & invitations</p>
            {data.usersAccess === "forbidden" ? (
              <>
                <p className="mt-3 text-sm text-slate-600">
                  User administration and invitations are available to <strong>platform owners</strong>.
                </p>
                <Link href="/dashboard/users" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                  Users & roles →
                </Link>
              </>
            ) : data.usersAccess === "error" ? (
              <p className="mt-3 text-sm text-amber-800">Could not load user administration metrics.</p>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.pendingInvites ?? "—"}</p>
                    <p className="text-xs text-slate-600">Pending invites</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-slate-900">{data.invitedUsers ?? "—"}</p>
                    <p className="text-xs text-slate-600">Invited (not active)</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/dashboard/users" className="text-sm font-semibold text-brand hover:underline">
                    Directory →
                  </Link>
                  {userRoles.includes("platform_owner") ? (
                    <Link href="/dashboard/users/new" className="text-sm font-semibold text-brand hover:underline">
                      Invite user →
                    </Link>
                  ) : null}
                </div>
              </>
            )}
          </article>

          {/* Audit */}
          <article className={cardClass}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit activity</p>
              {!data.auditError && data.auditByDay.some((d) => d.count > 0) ? (
                <StatusBadge tone="ok">Live</StatusBadge>
              ) : null}
            </div>
            {data.auditError ? (
              <p className="mt-2 text-sm text-amber-800">{data.auditError}</p>
            ) : (
              <>
                {data.auditPreview ? (
                  <p className="mt-2 text-sm text-slate-800">
                    <span className="font-semibold text-slate-900">Last event:</span> {data.auditPreview.action}
                    <br />
                    <span className="text-xs text-slate-500">
                      {new Date(data.auditPreview.createdAt).toLocaleString()} · {data.auditPreview.actorLabel}
                    </span>
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No recent events returned.</p>
                )}
                {data.auditByDay.length > 0 ? (
                  <div className="mt-4">
                    <AuditSparkline days={data.auditByDay} />
                  </div>
                ) : null}
                <Link href="/dashboard/audit" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                  Full audit log →
                </Link>
              </>
            )}
          </article>

          {/* Cash flow placeholder */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cash flow</p>
            <DonutPlaceholder label="Connect finance summary in next phase. Rolling cash outlook will use posted payments, deposits, and bill timing." />
            <Link
              href="/dashboard/finance/payments"
              className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Payments received →
            </Link>
          </article>

          {/* AR / AP */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receivables & payables</p>
            <p className="mt-2 text-sm text-slate-600">Document counts (balances require a future finance summary endpoint).</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-xs font-medium text-slate-500">AR · Invoices</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{data.invoiceCount === null ? "—" : data.invoiceCount}</p>
                {data.financeError ? <p className="mt-1 text-xs text-amber-800">{data.financeError}</p> : null}
                <Link href="/dashboard/finance/invoices" className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">
                  Open list →
                </Link>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200/80">
                <p className="text-xs font-medium text-slate-500">AP · Bills</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{data.billsCount === null ? "—" : data.billsCount}</p>
                {data.billsError ? <p className="mt-1 text-xs text-amber-800">{data.billsError}</p> : null}
                <Link href="/dashboard/finance/bills" className="mt-2 inline-block text-xs font-semibold text-brand hover:underline">
                  Open list →
                </Link>
              </div>
            </div>
            <p className="mt-3 text-xs leading-snug text-slate-500">
              Open balances, aging, and working capital: connect finance summary in next phase.
            </p>
          </article>

          {/* Upcoming payroll */}
          <article className={cardClass}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming payroll</p>
            {data.periodsError ? (
              <p className="mt-2 text-sm text-amber-800">{data.periodsError}</p>
            ) : data.nextPayroll && data.nextPayroll.payDate ? (
              <>
                <p className="mt-2 text-lg font-semibold text-slate-900">{data.nextPayroll.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  Next pay date:{" "}
                  <span className="font-medium text-slate-900">
                    {new Date(data.nextPayroll.payDate).toLocaleDateString(undefined, {
                      dateStyle: "long"
                    })}
                  </span>
                </p>
              </>
            ) : data.latestPeriod ? (
              <>
                <p className="mt-2 text-lg font-semibold text-slate-900">{data.latestPeriod.label}</p>
                <p className="mt-1 text-sm text-amber-800">
                  No future pay date is set on a period, or all scheduled dates are in the past. Set pay dates on pay
                  periods to drive this tile.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No pay periods yet. Create a period to anchor payroll dates.</p>
            )}
            <Link href="/dashboard/payroll/periods" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
              Pay periods →
            </Link>
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Keyboard-first navigation</p>
        <p className="mt-1">
          Every tile links to a working screen. Use the module row and Create pills to jump in without hunting the
          sidebar.
        </p>
      </section>
    </div>
  );
}
