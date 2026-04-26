"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type EmployeeRow = { active: boolean };

type DashboardMetrics = {
  activeEmployees: number | null;
  employeesError: string | null;
  submittedTime: number | null;
  timeError: string | null;
  draftRuns: number | null;
  payrollError: string | null;
  invoiceCount: number | null;
  financeError: string | null;
  pendingInvites: number | null;
  invitedUsers: number | null;
  usersAccess: "ok" | "forbidden" | "error";
  auditPreview: { action: string; createdAt: string; actorLabel: string } | null;
  auditError: string | null;
};

async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function DashboardPage() {
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<DashboardMetrics> => {
    const headers = { ...authHeaders() };
    const [
      empRes,
      timeRes,
      runRes,
      invRes,
      pendRes,
      usersRes,
      auditRes
    ] = await Promise.all([
      fetch(`${apiBase()}/people/employees`, { headers }),
      fetch(`${apiBase()}/time/entries/count?queue=all&status=submitted`, { headers }),
      fetch(`${apiBase()}/payroll/runs?status=draft`, { headers }),
      fetch(`${apiBase()}/finance/invoices`, { headers }),
      fetch(`${apiBase()}/admin/users/invitations/pending`, { headers }),
      fetch(`${apiBase()}/admin/users`, { headers }),
      fetch(`${apiBase()}/audit/recent?take=5`, { headers })
    ]);

    let activeEmployees: number | null = null;
    let employeesError: string | null = null;
    if (empRes.ok) {
      const data = await safeJson<{ items: EmployeeRow[] }>(empRes);
      if (data?.items) {
        activeEmployees = data.items.filter((e) => e.active).length;
      } else {
        employeesError = "Unexpected employee list format.";
      }
    } else {
      employeesError = "Could not load employees.";
    }

    let submittedTime: number | null = null;
    let timeError: string | null = null;
    try {
      if (timeRes.ok) {
        const t = await readApiData<{ count: number }>(timeRes, "time count");
        submittedTime = t.count;
      } else {
        timeError = "Could not load approval queue count.";
      }
    } catch {
      timeError = "Could not load approval queue count.";
    }

    let draftRuns: number | null = null;
    let payrollError: string | null = null;
    try {
      if (runRes.ok) {
        const r = await readApiData<{ items: unknown[] }>(runRes, "payroll runs");
        draftRuns = r.items.length;
      } else {
        payrollError = "Could not load draft pay runs.";
      }
    } catch {
      payrollError = "Could not load draft pay runs.";
    }

    let invoiceCount: number | null = null;
    let financeError: string | null = null;
    if (invRes.ok) {
      const data = await safeJson<{ items: unknown[] }>(invRes);
      invoiceCount = data?.items?.length ?? 0;
    } else if (invRes.status === 403) {
      financeError = "No access to finance lists with current roles.";
    } else {
      financeError = "Could not load invoices.";
    }

    let pendingInvites: number | null = null;
    let invitedUsers: number | null = null;
    let usersAccess: DashboardMetrics["usersAccess"] = "ok";
    if (pendRes.status === 403 || usersRes.status === 403) {
      usersAccess = "forbidden";
    } else if (pendRes.ok && usersRes.ok) {
      const pend = await safeJson<{ items: unknown[] }>(pendRes);
      const users = await safeJson<{ items: { status: string }[] }>(usersRes);
      pendingInvites = pend?.items?.length ?? 0;
      invitedUsers = users?.items?.filter((u) => u.status === "invited").length ?? 0;
    } else {
      usersAccess = "error";
    }

    let auditPreview: DashboardMetrics["auditPreview"] = null;
    let auditError: string | null = null;
    if (auditRes.ok) {
      const a = await safeJson<{
        items: { action: string; createdAt: string; actor: { name: string; email: string } | null }[];
      }>(auditRes);
      const first = a?.items?.[0];
      if (first) {
        auditPreview = {
          action: first.action,
          createdAt: first.createdAt,
          actorLabel: first.actor?.name || first.actor?.email || "System"
        };
      }
    } else if (auditRes.status === 403) {
      auditError = "Audit log requires appropriate role.";
    } else {
      auditError = "Could not load recent audit events.";
    }

    return {
      activeEmployees,
      employeesError,
      submittedTime,
      timeError,
      draftRuns,
      payrollError,
      invoiceCount,
      financeError,
      pendingInvites,
      invitedUsers,
      usersAccess,
      auditPreview,
      auditError
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await load();
        if (!cancelled) {
          setM(data);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load dashboard");
          setM(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!m) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
        {loadError ? (
          <p className="text-red-700">{loadError}</p>
        ) : (
          <p>Loading business overview…</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Overview</p>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-slate-900">Business at a glance</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Figures load from live API data when your role allows. Where a metric is unavailable, we show what is missing
          and link you to the underlying screen — no invented numbers.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active employees</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {m.activeEmployees === null ? "—" : m.activeEmployees}
          </p>
          {m.employeesError ? (
            <p className="mt-2 text-sm text-amber-800">{m.employeesError}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Employees marked active in People</p>
          )}
          <Link href="/dashboard/people/employees" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
            Manage employees →
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time approvals</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {m.submittedTime === null ? "—" : m.submittedTime}
          </p>
          {m.timeError ? (
            <p className="mt-2 text-sm text-amber-800">{m.timeError}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Submitted timesheets awaiting approval</p>
          )}
          <Link href="/dashboard/time/approvals" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
            Approval queue →
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Draft pay runs</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{m.draftRuns === null ? "—" : m.draftRuns}</p>
          {m.payrollError ? (
            <p className="mt-2 text-sm text-amber-800">{m.payrollError}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Runs still in draft status</p>
          )}
          <Link href="/dashboard/payroll/runs" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
            Pay runs →
          </Link>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Finance shortcuts</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {m.invoiceCount === null ? "—" : m.invoiceCount}
          </p>
          {m.financeError ? (
            <p className="mt-2 text-sm text-amber-800">{m.financeError}</p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Invoice documents in the system (all statuses)</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/dashboard/finance/invoices" className="text-sm font-semibold text-brand hover:underline">
              Invoices →
            </Link>
            <Link href="/dashboard/finance/bills" className="text-sm font-semibold text-brand hover:underline">
              Bills →
            </Link>
            <Link href="/dashboard/finance/expenses" className="text-sm font-semibold text-brand hover:underline">
              Expenses →
            </Link>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Users & invitations</p>
          {m.usersAccess === "forbidden" ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                User administration and pending invitations are limited to <strong>platform owners</strong>.
              </p>
              <Link href="/dashboard/users" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
                Users & roles →
              </Link>
            </>
          ) : m.usersAccess === "error" ? (
            <p className="mt-2 text-sm text-amber-800">Could not load user administration metrics.</p>
          ) : (
            <>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{m.pendingInvites ?? "—"}</p>
              <p className="mt-1 text-sm text-slate-600">Pending invitations (not yet accepted)</p>
              <p className="mt-2 text-sm text-slate-600">
                Invited accounts (not yet active):{" "}
                <span className="font-semibold text-slate-900">{m.invitedUsers ?? "—"}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href="/dashboard/users" className="text-sm font-semibold text-brand hover:underline">
                  Users →
                </Link>
                <Link href="/dashboard/users/new" className="text-sm font-semibold text-brand hover:underline">
                  Invite user →
                </Link>
              </div>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audit activity</p>
          {m.auditError ? (
            <p className="mt-2 text-sm text-amber-800">{m.auditError}</p>
          ) : m.auditPreview ? (
            <>
              <p className="mt-2 text-sm font-medium text-slate-900">Latest: {m.auditPreview.action}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(m.auditPreview.createdAt).toLocaleString()} · {m.auditPreview.actorLabel}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No recent events returned.</p>
          )}
          <Link href="/dashboard/audit" className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">
            Full audit log →
          </Link>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Quick links</h2>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/dashboard/reports" className="font-semibold text-brand hover:underline">
            Reports catalog
          </Link>
          <Link href="/dashboard/payroll/periods" className="font-semibold text-brand hover:underline">
            Pay periods
          </Link>
          <Link href="/dashboard/time/entries" className="font-semibold text-brand hover:underline">
            Time entries
          </Link>
          <Link href="/dashboard/finance/accounts" className="font-semibold text-brand hover:underline">
            Chart of accounts
          </Link>
        </div>
      </section>
    </div>
  );
}
