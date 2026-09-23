"use client";

import { BusinessOperatingDashboard, type AuditDay, type BusinessOverviewData } from "@/components/business-operating-dashboard";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type EmployeeRow = { active: boolean };

type MeResponse = { user: { name: string; email: string; roles: string[] } };

type PayPeriodItem = { label: string; endDate: string; payDate: string | null };
type PayRunItem = {
  id: string;
  status: string;
  itemCount: number;
  summary: { gross: number; totalDeductions: number; net: number; employerCost: number };
  period: { label: string; schedule: string; payDate: string | null };
};

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
    // bucket on the UTC calendar to match createdAt.slice(0, 10) from the API
    const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
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
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<{ data: BusinessOverviewData; roles: string[]; name: string; email: string }> => {
    const headers = { ...authHeaders() };
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
      periodsRes,
      settingsRes
    ] = await Promise.all([
      fetch(`${apiBase()}/auth/me`, { headers }),
      fetch(`${apiBase()}/people/employees`, { headers }),
      fetch(`${apiBase()}/time/entries/count?queue=all&status=submitted`, { headers }),
      fetch(`${apiBase()}/payroll/runs`, { headers }),
      fetch(`${apiBase()}/finance/invoices`, { headers }),
      fetch(`${apiBase()}/finance/bills`, { headers }),
      fetch(`${apiBase()}/admin/users/invitations/pending`, { headers }),
      fetch(`${apiBase()}/admin/users`, { headers }),
      fetch(`${apiBase()}/audit/recent?take=120`, { headers }),
      fetch(`${apiBase()}/payroll/periods`, { headers }),
      fetch(`${apiBase()}/settings/org`, { headers })
    ]);

    const me = await safeJson<MeResponse>(meRes);
    const roles = me?.user?.roles ?? [];
    const name = me?.user?.name ?? "";
    const email = me?.user?.email ?? "";

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
    let recentRuns: PayRunItem[] = [];
    let payrollSummary: BusinessOverviewData["payrollSummary"] = null;
    let payrollError: string | null = null;
    try {
      if (runRes.ok) {
        const r = await readApiData<{ items: PayRunItem[] }>(runRes, "payroll runs");
        draftRuns = r.items.filter((run) => run.status === "draft").length;
        recentRuns = r.items.slice(0, 5);
        const source = r.items[0];
        if (source) {
          payrollSummary = {
            gross: source.summary.gross,
            deductions: source.summary.totalDeductions,
            net: source.summary.net,
            employerCost: source.summary.employerCost,
            sourceLabel: source.period.label
          };
        }
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

    let statutoryReady: boolean | null = null;
    let statutoryError: string | null = null;
    if (settingsRes.ok) {
      const result = await safeJson<{
        settings: {
          companyLegalName: string;
          ssbEnabled: boolean;
          ssbEmployeeRate: number;
          ssbEmployerRate: number;
          ssbAnnualCeiling: number;
          nhiEnabled: boolean;
          nhiEmployeeRate: number;
          nhiEmployerRate: number;
          nhiAnnualCeiling: number;
          payrollTaxEnabled: boolean;
          payrollTaxEmployeeRate: number;
          payrollTaxEmployerClass: string;
          statutoryEffectiveYear: number;
        };
      }>(settingsRes);
      const s = result?.settings;
      statutoryReady = Boolean(
        s?.companyLegalName.trim() &&
          (!s.ssbEnabled || (s.ssbEmployeeRate > 0 && s.ssbEmployerRate > 0 && s.ssbAnnualCeiling > 0)) &&
          (!s.nhiEnabled || (s.nhiEmployeeRate > 0 && s.nhiEmployerRate > 0 && s.nhiAnnualCeiling > 0)) &&
          (!s.payrollTaxEnabled || (s.payrollTaxEmployeeRate > 0 && s.payrollTaxEmployerClass !== "NOT_SET")) &&
          s.statutoryEffectiveYear >= 2020
      );
    } else {
      statutoryError = "Could not verify payroll settings.";
    }

    const data: BusinessOverviewData = {
      activeEmployees,
      employeesError,
      submittedTime,
      timeError,
      draftRuns,
      payrollError,
      payrollSummary,
      recentRuns,
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
      periodsError,
      statutoryReady,
      statutoryError
    };

    return { data, roles, name, email };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, roles, name, email } = await load();
        if (!cancelled) {
          setM(data);
          setUserRoles(roles);
          setUserName(name);
          setUserEmail(email);
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

  return <BusinessOperatingDashboard data={m} userRoles={userRoles} userName={userName} userEmail={userEmail} />;
}
