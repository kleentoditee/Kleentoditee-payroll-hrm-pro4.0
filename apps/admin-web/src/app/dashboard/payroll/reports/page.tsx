"use client";

import { apiBase, apiFetch, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type RunOption = {
  id: string;
  status: string;
  period: { label: string; schedule: string; startDate: string; endDate: string };
  summary: { gross: number; net: number };
  itemCount: number;
};

type RegisterLine = {
  employeeName: string;
  employeeRole: string;
  paySchedule: string;
  payBasis: string;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  employerCost: number;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  issues: string[];
};

type Register = {
  run: { id: string; status: string };
  period: { label: string; schedule: string; startDate: string; endDate: string; payDate: string | null };
  lines: RegisterLine[];
  totals: Omit<RegisterLine, "employeeName" | "employeeRole" | "paySchedule" | "payBasis" | "issues"> & {
    employees: number;
  };
  checks: string[];
  draft: boolean;
};

type YearRow = {
  employeeId: string;
  employeeName: string;
  paySchedule: string;
  active: boolean;
  openingGross: number;
  runsGross: number;
  runCount: number;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  manualDeductions: number;
  totalDeductions: number;
  net: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  employerCost: number;
};

type YearSummary = {
  year: number;
  rows: YearRow[];
  totals: Omit<YearRow, "employeeId" | "employeeName" | "paySchedule" | "active"> & { employees: number };
  runs: Array<{ id: string; status: string; periodLabel: string; gross: number; net: number; itemCount: number }>;
  checks: string[];
  warnings: string[];
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const fmt = (value: number) => money.format(value ?? 0);
const num = (value: number) => (value ? String(Math.round(value * 100) / 100) : "—");

export default function PayrollReportsPage() {
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [runId, setRunId] = useState("");
  const [register, setRegister] = useState<Register | null>(null);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [summary, setSummary] = useState<YearSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch("/payroll/runs", { headers: { ...authHeaders() } })
      .then((res) => readApiData<{ items: RunOption[] }>(res))
      .then((data) => {
        const usable = data.items.filter((run) => run.status !== "void");
        setRuns(usable);
        if (usable.length && !runId) {
          setRunId(usable[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load pay runs."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRegister = useCallback(async (id: string) => {
    if (!id) {
      setRegister(null);
      return;
    }
    const res = await apiFetch(`/payroll/reports/register?runId=${encodeURIComponent(id)}`, {
      headers: { ...authHeaders() }
    });
    const data = await readApiData<{ register: Register }>(res);
    setRegister(data.register);
  }, []);

  useEffect(() => {
    loadRegister(runId).catch((e) =>
      setError(e instanceof Error ? e.message : "Could not load the payroll register.")
    );
  }, [runId, loadRegister]);

  const loadSummary = useCallback(async (targetYear: number) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/payroll/reports/year-summary?year=${targetYear}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ summary: YearSummary }>(res);
      setSummary(data.summary);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadSummary(year).catch((e) =>
      setError(e instanceof Error ? e.message : "Could not load the year summary.")
    );
  }, [year, loadSummary]);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">Payroll reporting</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">Register &amp; reconciliation</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          The payroll register lists every employee line of a run with deductions and employer cost. The year
          summary combines posted runs with imported YTD opening balances and reconciles every frozen line
          (gross = net + deductions, opening + runs = YTD).
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl text-slate-950">Payroll register</h3>
            <label className="mt-2 block text-sm font-semibold text-slate-700">
              Pay run
              <select
                value={runId}
                onChange={(e) => setRunId(e.target.value)}
                className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal"
              >
                {runs.length === 0 && <option value="">No runs yet</option>}
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.period.label} · {run.status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {register && (
            <a
              href={`${apiBase()}/payroll/reports/register?runId=${encodeURIComponent(runId)}&format=csv`}
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white"
            >
              Download register CSV
            </a>
          )}
        </div>

        {register && (
          <>
            {register.draft && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                This run is still a draft — lines will change when it is rebuilt or finalized.
              </p>
            )}
            {register.checks.length > 0 ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                Reconciliation issues: {register.checks.join(" · ")}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Reconciliation passed: every line balances (gross = net + deductions).
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3 text-right">Days</th>
                    <th className="py-2 pr-3 text-right">Hours</th>
                    <th className="py-2 pr-3 text-right">Gross</th>
                    <th className="py-2 pr-3 text-right">NHI</th>
                    <th className="py-2 pr-3 text-right">SSB</th>
                    <th className="py-2 pr-3 text-right">Payroll tax</th>
                    <th className="py-2 pr-3 text-right">Other ded.</th>
                    <th className="py-2 pr-3 text-right">Total ded.</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 text-right">Employer cost</th>
                  </tr>
                </thead>
                <tbody>
                  {register.lines.map((line) => (
                    <tr key={line.employeeName} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        {line.employeeName}
                        <span className="block text-xs text-slate-400">
                          {line.paySchedule} · {line.payBasis}
                        </span>
                        {line.issues.length > 0 && (
                          <span className="block text-xs font-semibold text-rose-700">{line.issues.join(" ")}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{num(line.daysWorked)}</td>
                      <td className="py-2 pr-3 text-right">{num(line.hoursWorked)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.gross)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.nhi)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.ssb)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.payrollTax)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.manualDeductions)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(line.totalDeductions)}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{fmt(line.net)}</td>
                      <td className="py-2 text-right">{fmt(line.employerCost)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2 pr-3">Totals ({register.totals.employees} employees)</td>
                    <td className="py-2 pr-3 text-right">{num(register.totals.daysWorked)}</td>
                    <td className="py-2 pr-3 text-right">{num(register.totals.hoursWorked)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.gross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.nhi)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.ssb)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.payrollTax)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.manualDeductions)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.totalDeductions)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(register.totals.net)}</td>
                    <td className="py-2 text-right">{fmt(register.totals.employerCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <h3 className="font-serif text-xl text-slate-950">Year summary &amp; reconciliation</h3>
          <label className="text-sm font-semibold text-slate-700">
            Year
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isInteger(next) && next >= 2000 && next <= 2100) setYear(next);
              }}
              className="ml-2 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {summary && (
          <>
            {summary.warnings.length > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                {summary.warnings.join(" ")}
              </p>
            )}
            {summary.checks.length > 0 ? (
              <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                Reconciliation issues: {summary.checks.join(" · ")}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                Reconciliation passed for {summary.year}: all posted lines balance and opening + runs = YTD gross
                for every employee.
              </p>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Employee</th>
                    <th className="py-2 pr-3 text-right">Opening YTD</th>
                    <th className="py-2 pr-3 text-right">Runs gross</th>
                    <th className="py-2 pr-3 text-right">YTD gross</th>
                    <th className="py-2 pr-3 text-right">NHI</th>
                    <th className="py-2 pr-3 text-right">SSB</th>
                    <th className="py-2 pr-3 text-right">Payroll tax</th>
                    <th className="py-2 pr-3 text-right">Total ded.</th>
                    <th className="py-2 pr-3 text-right">Net</th>
                    <th className="py-2 text-right">Employer cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows
                    .filter((row) => row.gross > 0 || row.runCount > 0)
                    .map((row) => (
                      <tr key={row.employeeId} className="border-b border-slate-100">
                        <td className="py-2 pr-3">
                          {row.employeeName}
                          <span className="block text-xs text-slate-400">
                            {row.paySchedule}
                            {row.active ? "" : " · inactive"} · {row.runCount} run line(s)
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">{row.openingGross ? fmt(row.openingGross) : "—"}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.runsGross)}</td>
                        <td className="py-2 pr-3 text-right font-semibold">{fmt(row.gross)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.nhi)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.ssb)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.payrollTax)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.totalDeductions)}</td>
                        <td className="py-2 pr-3 text-right">{fmt(row.net)}</td>
                        <td className="py-2 text-right">{fmt(row.employerCost)}</td>
                      </tr>
                    ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="py-2 pr-3">Totals ({summary.totals.employees} employees)</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.openingGross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.runsGross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.gross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.nhi)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.ssb)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.payrollTax)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.totalDeductions)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(summary.totals.net)}</td>
                    <td className="py-2 text-right">{fmt(summary.totals.employerCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {summary.rows.every((row) => row.gross === 0 && row.runCount === 0) && (
              <p className="mt-3 text-sm text-slate-500">
                No posted payroll activity in {summary.year}. Draft runs appear here once finalized.
              </p>
            )}
            <p className="mt-4 text-xs text-slate-500">
              {summary.runs.length} posted run(s) in {summary.year}:{" "}
              {summary.runs.map((run) => `${run.periodLabel} (${run.status}, ${fmt(run.gross)})`).join(" · ") ||
                "none"}
            </p>
          </>
        )}
        {busy && !summary && <p className="mt-3 text-sm text-slate-500">Loading…</p>}
      </section>
    </div>
  );
}
