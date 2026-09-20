"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

const TEMPLATE_CSV =
  "email,employee_name,gross,nhi,ssb,income_tax,payroll_tax,employer_nhi,employer_ssb,employer_payroll_tax,net,notes\n" +
  "maria@example.com,Maria Example,12450.00,373.50,560.25,0,622.50,373.50,560.25,622.50,10893.75,Imported from legacy payroll\n";

type EmployeeRef = {
  id: string;
  fullName: string;
  email: string;
  paySchedule: string;
  active?: boolean;
};

type Balance = {
  id: string;
  employeeId: string;
  year: number;
  gross: number;
  nhi: number;
  ssb: number;
  incomeTax: number;
  payrollTax: number;
  employerNhi: number;
  employerSsb: number;
  employerPayrollTax: number;
  net: number;
  source: string;
  notes: string;
  updatedAt: string;
  employee: EmployeeRef;
};

type ListResponse = {
  year: number;
  balances: Balance[];
  employeesWithoutBalance: EmployeeRef[];
};

type PlannedRow = {
  rowNumber: number;
  email: string;
  employeeName: string;
  amounts: {
    gross: number;
    nhi: number;
    ssb: number;
    incomeTax: number;
    payrollTax: number;
    employerNhi: number;
    employerSsb: number;
    employerPayrollTax: number;
    net: number;
  };
  notes: string;
  errors: string[];
  employeeId: string | null;
  matchedEmployeeName: string | null;
  existingBalanceId: string | null;
  willOverwrite: boolean;
};

type Plan = {
  year: number;
  rows: PlannedRow[];
  errors: string[];
  ready: number;
  rejected: number;
};

type CommitResult = { year: number; created: number; updated: number; total: number };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function fmt(value: number): string {
  return money.format(value ?? 0);
}

export default function PayrollYtdImportPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [list, setList] = useState<ListResponse | null>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (targetYear: number) => {
    const res = await apiFetch(`/payroll/ytd-opening-balances?year=${targetYear}`, {
      headers: { ...authHeaders() }
    });
    const data = await readApiData<ListResponse>(res);
    setList(data);
  }, []);

  useEffect(() => {
    setError(null);
    load(year).catch((e) => setError(e instanceof Error ? e.message : "Could not load opening balances."));
  }, [year, load]);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPlan(null);
    setResult(null);
    setError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are accepted for the YTD opening-balance import.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("CSV file is too large. Maximum size is 1 MB.");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function preview() {
    if (!csv.trim()) {
      setError("Paste CSV content or choose a .csv file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/payroll/ytd-opening-balances/preview", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ year, csv })
      });
      const data = await readApiData<{ plan: Plan }>(res);
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview this CSV.");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!plan || !csv.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/payroll/ytd-opening-balances/commit", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ year, csv })
      });
      const data = await readApiData<{ result: CommitResult }>(res);
      setResult(data.result);
      setPlan(null);
      setCsv("");
      setFileName("");
      await load(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import opening balances.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/payroll/ytd-opening-balances/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() }
      });
      await readApiData<{ ok: boolean }>(res);
      await load(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete opening balance.");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ytd-opening-balances-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const commitBlocked = !plan || plan.ready === 0 || plan.rejected > 0 || plan.errors.length > 0;

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">Payroll migration</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">Historical / YTD opening balances</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Import gross pay (and statutory components) that employees earned earlier this calendar year under a
          previous payroll system. The imported gross is added to each employee&apos;s year-to-date gross, so the
          BVI payroll-tax annual exemption is applied correctly for the rest of the year.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}
      {result && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Imported {result.total} opening balance(s) for {result.year}: {result.created} created, {result.updated}{" "}
          updated.
        </div>
      )}

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm font-semibold text-slate-700">
            Calendar year
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isInteger(next) && next >= 2000 && next <= 2100) {
                  setYear(next);
                  setPlan(null);
                  setResult(null);
                }
              }}
              className="ml-2 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Download CSV template
          </button>
          <label className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer">
            {fileName || "Choose .csv file"}
            <input type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          </label>
        </div>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPlan(null);
            setResult(null);
          }}
          rows={6}
          placeholder="Paste CSV here — first row must be the header: email,employee_name,gross,..."
          className="mt-4 w-full rounded-xl border border-slate-300 p-3 font-mono text-xs"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={preview}
            disabled={busy || !csv.trim()}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Preview import
          </button>
          {plan && (
            <button
              type="button"
              onClick={commit}
              disabled={busy || commitBlocked}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Commit {plan.ready} row(s)
            </button>
          )}
        </div>
      </section>

      {plan && (
        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-serif text-xl text-slate-950">Preview</h3>
          <p className="mt-1 text-sm text-slate-600">
            {plan.ready} ready · {plan.rejected} rejected
            {plan.errors.length > 0 ? ` · ${plan.errors.join(" ")}` : ""}
            {plan.rejected > 0 ? " — fix rejected rows before committing." : ""}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Row</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3 text-right">Gross</th>
                  <th className="py-2 pr-3 text-right">NHI</th>
                  <th className="py-2 pr-3 text-right">SSB</th>
                  <th className="py-2 pr-3 text-right">Payroll tax</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {plan.rows.map((row) => (
                  <tr key={row.rowNumber} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-500">{row.rowNumber}</td>
                    <td className="py-2 pr-3">
                      {row.matchedEmployeeName ?? row.employeeName ?? row.email ?? "—"}
                      {row.matchedEmployeeName && (row.employeeName || row.email) && (
                        <span className="block text-xs text-slate-400">{row.email || row.employeeName}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmt(row.amounts.gross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(row.amounts.nhi)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(row.amounts.ssb)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(row.amounts.payrollTax)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(row.amounts.net)}</td>
                    <td className="py-2 pr-3">
                      {row.errors.length ? (
                        <span className="text-xs font-semibold text-rose-700">{row.errors.join(" ")}</span>
                      ) : row.willOverwrite ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          Overwrites existing
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          New
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-950">Recorded opening balances for {year}</h3>
        {!list ? (
          <p className="mt-2 text-sm text-slate-500">Loading…</p>
        ) : list.balances.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No opening balances recorded for {year}. Employees who joined this system in January do not need one.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3 text-right">Gross</th>
                  <th className="py-2 pr-3 text-right">NHI</th>
                  <th className="py-2 pr-3 text-right">SSB</th>
                  <th className="py-2 pr-3 text-right">Payroll tax</th>
                  <th className="py-2 pr-3 text-right">Employer cost</th>
                  <th className="py-2 pr-3 text-right">Net</th>
                  <th className="py-2 pr-3">Notes</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {list.balances.map((balance) => (
                  <tr key={balance.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      {balance.employee.fullName}
                      <span className="block text-xs text-slate-400">{balance.employee.paySchedule}</span>
                    </td>
                    <td className="py-2 pr-3 text-right">{fmt(balance.gross)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(balance.nhi)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(balance.ssb)}</td>
                    <td className="py-2 pr-3 text-right">{fmt(balance.payrollTax)}</td>
                    <td className="py-2 pr-3 text-right">
                      {fmt(balance.employerNhi + balance.employerSsb + balance.employerPayrollTax)}
                    </td>
                    <td className="py-2 pr-3 text-right">{fmt(balance.net)}</td>
                    <td className="py-2 pr-3 text-xs text-slate-500">{balance.notes}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(balance.id)}
                        disabled={busy}
                        className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list && list.employeesWithoutBalance.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">
            Active employees with no opening balance for {year}:{" "}
            {list.employeesWithoutBalance.map((employee) => employee.fullName).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
