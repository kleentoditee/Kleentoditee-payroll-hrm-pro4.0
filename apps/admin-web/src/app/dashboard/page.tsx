"use client";

import { BusinessOperatingDashboard, type AuditDay, type BusinessOverviewData } from "@/components/business-operating-dashboard";
import { authenticatedFetch, readApiData } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

type EmployeeRow = { active: boolean };

type MeResponse = { user: { roles: string[] } };

type PayPeriodItem = { label: string; endDate: string; payDate: string | null };

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function bucketAuditLast7Days(
  items: { createdAt: string }[]
): AuditDay[] {
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayKeys.push(key);
  }
  const counts = new Map<string, number>();
  for (const k of dayKeys) {
    counts.set(k, 0);
  }
  for (const it of items) {
    const k = it.createdAt.slice(0, 10);
    if (counts.has(k)) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return dayKeys.map((dayKey) => ({ dayKey, count: counts.get(dayKey) ?? 0 }));
}

function pickNextPayroll(periods: PayPeriodItem[]): { label: string; payDate: string } | null {
  const start = startOfTodayMs();
  const future = periods
    .filter((p) => p.payDate)
    .map((p) => {
      const t = new Date(p.payDate as string).getTime();
      return { label: p.label, payDate: p.payDate as string, t };
    })
    .filter((p) => !Number.isNaN(p.t) && p.t >= start)
    .sort((a, b) => a.t - b.t);
  if (future[0]) {
    return { label: future[0].label, payDate: future[0].payDate };
  }
  return null;
}

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
  const [m, setM] = useState<BusinessOverviewData | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<{ data: BusinessOverviewData; roles: string[] }> => {
    const [
      meRes,
      empRes,
      timeRes,
      runRes,
      invRes,
      billsRes,
      pendRes,
      usersRes,
      auditRes,
      periodsRes
    ] = await Promise.all([
      authenticatedFetch("/auth/me"),
      authenticatedFetch("/people/employees"),
      authenticatedFetch("/time/entries/count?queue=all&status=submitted"),
      authenticatedFetch("/payroll/runs?status=draft"),
      authenticatedFetch("/finance/invoices"),
      authenticatedFetch("/finance/bills"),
      authenticatedFetch("/admin/users/invitations/pending"),
      authenticatedFetch("/admin/users"),
      authenticatedFetch("/audit/recent?take=120"),
      authenticatedFetch("/payroll/periods")
    ]);

    const me = await safeJson<MeResponse>(meRes);
    const roles = me?.user?.roles ?? [];

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

    let billsCount: number | null = null;
    let billsError: string | null = null;
    if (billsRes.ok) {
      const data = await safeJson<{ items: unknown[] }>(billsRes);
      billsCount = data?.items?.length ?? 0;
    } else if (billsRes.status === 403) {
      billsError = "No access to finance lists with current roles.";
    } else {
      billsError = "Could not load bills.";
    }

    let pendingInvites: number | null = null;
    let invitedUsers: number | null = null;
    let usersAccess: BusinessOverviewData["usersAccess"] = "ok";
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

    let auditPreview: BusinessOverviewData["auditPreview"] = null;
    let auditError: string | null = null;
    let auditByDay: AuditDay[] = [];
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
      auditByDay = bucketAuditLast7Days(a?.items ?? []);
    } else if (auditRes.status === 403) {
      auditError = "Audit log requires appropriate role.";
    } else {
      auditError = "Could not load recent audit events.";
    }

    let periodCount: number | null = null;
    let latestPeriod: BusinessOverviewData["latestPeriod"] = null;
    let nextPayroll: BusinessOverviewData["nextPayroll"] = null;
    let periodsError: string | null = null;
    if (periodsRes.ok) {
      const p = await safeJson<{ items: PayPeriodItem[] }>(periodsRes);
      const items = p?.items ?? [];
      periodCount = items.length;
      if (items[0]) {
        latestPeriod = {
          label: items[0].label,
          payDate: items[0].payDate,
          endDate: items[0].endDate
        };
      }
      nextPayroll = pickNextPayroll(items);
    } else if (periodsRes.status === 403) {
      periodsError = "Could not load pay periods with current role.";
    } else {
      periodsError = "Could not load pay periods.";
    }

    const data: BusinessOverviewData = {
      activeEmployees,
      employeesError,
      submittedTime,
      timeError,
      draftRuns,
      payrollError,
      invoiceCount,
      financeError,
      billsCount,
      billsError,
      pendingInvites,
      invitedUsers,
      usersAccess,
      auditPreview,
      auditError,
      auditByDay,
      periodCount,
      latestPeriod,
      nextPayroll,
      periodsError
    };

    return { data, roles };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, roles } = await load();
        if (!cancelled) {
          setM(data);
          setUserRoles(roles);
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
      <div className="rounded-2xl border border-slate-200/90 bg-white p-10 text-sm text-slate-600 shadow-sm shadow-slate-200/50">
        {loadError ? <p className="text-red-700">{loadError}</p> : <p>Loading your operating dashboard…</p>}
      </div>
    );
  }

  return <BusinessOperatingDashboard data={m} userRoles={userRoles} />;
}
