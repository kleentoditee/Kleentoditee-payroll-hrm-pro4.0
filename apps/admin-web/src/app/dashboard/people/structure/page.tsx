"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type MasterKind = "departments" | "positions" | "cost-centres" | "locations" | "work-schedules";

type MasterRow = {
  id: string;
  code?: string;
  name: string;
  active: boolean;
  parentId?: string | null;
  address?: string;
  glAccountId?: string | null;
  description?: string;
  standardHoursPerWeek?: number;
};

type Reminder = {
  kind: "contract_end" | "work_permit" | "document_expiry";
  employeeId: string;
  employeeName: string;
  label: string;
  date: string;
  daysUntil: number;
};

type ReportRow = {
  id: string | null;
  code: string;
  name: string;
  headcount: number;
  gross: number;
  net: number;
};

type StructureReport = {
  dimension: string;
  payRunId: string | null;
  rows: ReportRow[];
  totals: { headcount: number; gross: number; net: number };
};

type PayRunOption = { id: string; status: string; period?: { label?: string } };

const KINDS: Array<{ id: MasterKind; label: string }> = [
  { id: "departments", label: "Departments" },
  { id: "positions", label: "Positions" },
  { id: "cost-centres", label: "Cost centres" },
  { id: "locations", label: "Locations" },
  { id: "work-schedules", label: "Work schedules" }
];

const REMINDER_LABEL: Record<Reminder["kind"], string> = {
  contract_end: "Contract ends",
  work_permit: "Work permit expires",
  document_expiry: "Document expires"
};

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HrStructurePage() {
  const [kind, setKind] = useState<MasterKind>("departments");
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [departments, setDepartments] = useState<MasterRow[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [days, setDays] = useState(30);
  const [payRuns, setPayRuns] = useState<PayRunOption[]>([]);
  const [payRunId, setPayRunId] = useState("");
  const [deptReport, setDeptReport] = useState<StructureReport | null>(null);
  const [ccReport, setCcReport] = useState<StructureReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // create form
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [address, setAddress] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("40");

  const get = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${apiBase()}${path}`, { headers: { ...authHeaders() } });
    return readApiData<T>(res);
  }, []);

  const loadMasters = useCallback(async () => {
    const data = await get<{ rows: MasterRow[] }>(`/hr-structure/masters/${kind}`);
    setRows(data.rows);
  }, [get, kind]);

  const loadReminders = useCallback(async () => {
    const data = await get<{ rows: Reminder[] }>(`/hr-structure/reminders?days=${days}`);
    setReminders(data.rows);
  }, [get, days]);

  const loadReports = useCallback(async () => {
    const q = payRunId ? `?payRunId=${encodeURIComponent(payRunId)}` : "";
    const [d, c] = await Promise.all([
      get<{ report: StructureReport }>(`/hr-structure/reports/departments${q}`),
      get<{ report: StructureReport }>(`/hr-structure/reports/cost-centres${q}`)
    ]);
    setDeptReport(d.report);
    setCcReport(c.report);
  }, [get, payRunId]);

  useEffect(() => {
    loadMasters().catch(() => setError("Could not load masters."));
  }, [loadMasters]);

  useEffect(() => {
    loadReminders().catch(() => setError("Could not load reminders."));
  }, [loadReminders]);

  useEffect(() => {
    loadReports().catch(() => setError("Could not load structure reports."));
  }, [loadReports]);

  useEffect(() => {
    get<{ rows: MasterRow[] }>("/hr-structure/masters/departments")
      .then((d) => setDepartments(d.rows))
      .catch(() => undefined);
    get<{ items: PayRunOption[] }>("/payroll/runs")
      .then((d) => setPayRuns(d.items.slice(0, 25)))
      .catch(() => undefined);
  }, [get]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function send(method: string, path: string, body?: Record<string, unknown>) {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readApiData<Record<string, unknown>>(res);
  }

  const createMaster = () =>
    run(async () => {
      const body: Record<string, unknown> = { code, name };
      if (kind === "departments" && parentId) body.parentId = parentId;
      if (kind === "locations" && address) body.address = address;
      if (kind === "work-schedules") {
        const perDay = Number(weeklyHours) / 5;
        body.pattern = ["mon", "tue", "wed", "thu", "fri"].map((day) => ({ day, hours: perDay }));
      }
      await send("POST", `/hr-structure/masters/${kind}`, body);
      setCode("");
      setName("");
      setParentId("");
      setAddress("");
      await loadMasters();
      if (kind === "departments") {
        const d = await get<{ rows: MasterRow[] }>("/hr-structure/masters/departments");
        setDepartments(d.rows);
      }
      setNotice("Created.");
    });

  const setActive = (row: MasterRow, active: boolean) =>
    run(async () => {
      await send("PATCH", `/hr-structure/masters/${kind}/${row.id}`, { active });
      await loadMasters();
      setNotice(active ? "Reactivated." : "Archived.");
    });

  const remove = (row: MasterRow) =>
    run(async () => {
      await send("DELETE", `/hr-structure/masters/${kind}/${row.id}`);
      await loadMasters();
      setNotice("Deleted.");
    });

  const runBackfill = () =>
    run(async () => {
      const data = await send("POST", "/hr-structure/backfill");
      const r = (data.result ?? {}) as Record<string, number>;
      await loadMasters();
      await loadReports();
      setNotice(
        `Backfill complete: ${r.positionsCreated ?? 0} positions, ${r.locationsCreated ?? 0} locations, ` +
          `${r.employeesLinked ?? 0} employees linked, ${r.contractsCreated ?? 0} initial contracts.`
      );
    });

  const reportTable = (title: string, report: StructureReport | null) => (
    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-2">Code</th>
            <th className="py-2 pr-2">Name</th>
            <th className="py-2 pr-2 text-right">Headcount</th>
            <th className="py-2 pr-2 text-right">Gross</th>
            <th className="py-2 text-right">Net</th>
          </tr>
        </thead>
        <tbody>
          {(report?.rows ?? []).map((r) => (
            <tr key={r.id ?? "unassigned"} className="border-b border-slate-100">
              <td className="py-2 pr-2 font-mono text-xs">{r.code}</td>
              <td className="py-2 pr-2">{r.name}</td>
              <td className="py-2 pr-2 text-right">{r.headcount}</td>
              <td className="py-2 pr-2 text-right">{money(r.gross)}</td>
              <td className="py-2 text-right">{money(r.net)}</td>
            </tr>
          ))}
          {report ? (
            <tr className="font-bold">
              <td className="py-2 pr-2" colSpan={2}>Company total</td>
              <td className="py-2 pr-2 text-right">{report.totals.headcount}</td>
              <td className="py-2 pr-2 text-right">{money(report.totals.gross)}</td>
              <td className="py-2 text-right">{money(report.totals.net)}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">People</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">HR Structure</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Departments (org chart), positions, cost centres (GL rollups), locations (sites), and weekly work
          schedules. Run the one-time backfill to convert existing role/site text into masters and create
          initial employment contracts — historical terms are preserved from that point on.
        </p>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  kind === k.id ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                {kind !== "work-schedules" && <th className="py-2 pr-2">Code</th>}
                <th className="py-2 pr-2">Name</th>
                {kind === "departments" && <th className="py-2 pr-2">Parent</th>}
                {kind === "locations" && <th className="py-2 pr-2">Address</th>}
                {kind === "work-schedules" && <th className="py-2 pr-2 text-right">Hours/week</th>}
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  {kind !== "work-schedules" && <td className="py-2 pr-2 font-mono text-xs">{r.code}</td>}
                  <td className="py-2 pr-2">{r.name}</td>
                  {kind === "departments" && (
                    <td className="py-2 pr-2 text-xs text-slate-500">
                      {r.parentId ? departments.find((d) => d.id === r.parentId)?.name ?? "—" : "—"}
                    </td>
                  )}
                  {kind === "locations" && <td className="py-2 pr-2 text-xs text-slate-500">{r.address || "—"}</td>}
                  {kind === "work-schedules" && (
                    <td className="py-2 pr-2 text-right">{r.standardHoursPerWeek ?? 0}</td>
                  )}
                  <td className="py-2 pr-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {r.active ? "Active" : "Archived"}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setActive(r, !r.active)}
                      className="mr-2 text-xs font-semibold text-slate-600 hover:underline"
                    >
                      {r.active ? "Archive" : "Reactivate"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => remove(r)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className="py-3 text-sm text-slate-500" colSpan={6}>None yet.</td></tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
            {kind !== "work-schedules" && (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Code (e.g. OPS)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            )}
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {kind === "departments" && (
              <select
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">No parent</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
            {kind === "locations" && (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Address (optional)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
            {kind === "work-schedules" && (
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Hours per week (Mon–Fri)"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
              />
            )}
            <button
              type="button"
              disabled={busy || !name.trim() || (kind !== "work-schedules" && !code.trim())}
              onClick={createMaster}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={runBackfill}
            className="mt-4 rounded-lg border border-[#006D77] px-4 py-2 text-sm font-semibold text-[#006D77] hover:bg-[#006D77]/5 disabled:opacity-50"
          >
            Run one-time backfill (role/site text → masters + initial contracts)
          </button>
        </div>

        <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Expiry reminders</h3>
            <select
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>next {d} days</option>
              ))}
            </select>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {reminders.map((r, i) => (
              <li key={`${r.employeeId}-${r.kind}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <span className="font-semibold">{r.employeeName}</span>
                <span className="text-slate-500"> — {REMINDER_LABEL[r.kind]}: {r.label}</span>
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${r.daysUntil <= 7 ? "bg-rose-100 text-rose-700" : r.daysUntil <= 30 ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"}`}>
                  {r.daysUntil}d
                </span>
              </li>
            ))}
            {reminders.length === 0 && <li className="text-sm text-slate-500">Nothing expiring in this window.</li>}
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-bold text-slate-900">Structure reports</h3>
          <select
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
            value={payRunId}
            onChange={(e) => setPayRunId(e.target.value)}
          >
            <option value="">Headcount only (no pay run)</option>
            {payRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {r.period?.label ?? r.id} — {r.status}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {reportTable("By department", deptReport)}
          {reportTable("By cost centre", ccReport)}
        </div>
      </section>
    </div>
  );
}
