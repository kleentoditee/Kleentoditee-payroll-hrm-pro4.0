"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RunItem = {
  id: string;
  employeeName: string;
  employeeRole: string;
  defaultSite: string;
  paySchedule: string;
  gross: number;
  totalDeductions: number;
  net: number;
  paystub: { id: string; stubNumber: string } | null;
};

type RunDetail = {
  id: string;
  status: string;
  finalizedAt: string | null;
  exportedAt: string | null;
  paidAt: string | null;
  summary: { count: number; gross: number; totalDeductions: number; net: number };
  period: {
    id: string;
    label: string;
    schedule: string;
    startDate: string;
    endDate: string;
    payDate: string | null;
  };
  items: RunItem[];
  exports: Array<{ id: string; fileName: string; createdAt: string }>;
};

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export default function PayrollRunDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [run, setRun] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const loadRun = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/payroll/runs/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = (await res.json()) as { error?: string; run?: RunDetail };
      if (!res.ok || !data.run) {
        throw new Error(data.error ?? "Load failed");
      }
      setRun(data.run);
      setError(null);
    } catch (e) {
      setRun(null);
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  async function postAction(path: string, action: string) {
    setWorking(action);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() }
      });
      const data = (await res.json()) as { error?: string; csv?: string; fileName?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `${action} failed`);
      }
      if (data.csv && data.fileName) {
        downloadCsv(data.fileName, data.csv);
      }
      await loadRun();
    } catch (e) {
      setError(e instanceof Error ? e.message : `${action} failed`);
    } finally {
      setWorking(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!run) {
    return <p className="text-sm text-slate-600">Pay run not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payroll</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">{run.period.label}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {run.period.schedule} | {run.period.startDate.slice(0, 10)} to {run.period.endDate.slice(0, 10)} |{" "}
            {run.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/payroll/runs" className="text-sm font-semibold text-brand hover:underline">
            {"<-"} Back to runs
          </Link>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-500">Employees</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{run.summary.count}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-500">Gross</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(run.summary.gross)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-500">Deductions</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(run.summary.totalDeductions)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-slate-500">Net</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatMoney(run.summary.net)}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={working !== null || run.status !== "draft"}
            onClick={() => void postAction(`/payroll/runs/${run.id}/rebuild`, "Rebuild")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {working === "Rebuild" ? "Rebuilding..." : "Rebuild from approved time"}
          </button>
          <button
            type="button"
            disabled={working !== null || run.status !== "draft"}
            onClick={() => void postAction(`/payroll/runs/${run.id}/finalize`, "Finalize")}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {working === "Finalize" ? "Finalizing..." : "Finalize run"}
          </button>
          <button
            type="button"
            disabled={working !== null || run.status === "draft"}
            onClick={() => void postAction(`/payroll/runs/${run.id}/export`, "Export")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {working === "Export" ? "Exporting..." : "Export CSV"}
          </button>
          <button
            type="button"
            disabled={working !== null || run.status === "draft" || run.status === "paid"}
            onClick={() => void postAction(`/payroll/runs/${run.id}/mark-paid`, "Mark paid")}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
          >
            {working === "Mark paid" ? "Marking paid..." : "Mark paid"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl text-slate-900">Employee lines</h3>
            <p className="mt-1 text-sm text-slate-600">
              These values are frozen snapshots of the approved time imported into this run.
            </p>
          </div>
        </div>
        {run.items.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No employees were imported into this run.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Schedule</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Gross</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Deductions</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-700">Net</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">Paystub</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {run.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{item.employeeName}</p>
                      <p className="text-xs text-slate-500">
                        {item.employeeRole || "-"} | {item.defaultSite || "-"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{item.paySchedule}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatMoney(item.gross)}</td>
                    <td className="px-3 py-3 text-right text-slate-700">{formatMoney(item.totalDeductions)}</td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatMoney(item.net)}</td>
                    <td className="px-3 py-3">
                      {item.paystub ? (
                        <Link
                          href={`/dashboard/payroll/paystubs/${item.paystub.id}`}
                          className="text-sm font-semibold text-brand hover:underline"
                        >
                          {item.paystub.stubNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">Available after finalize</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-900">Exports</h3>
        {run.exports.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No exports yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {run.exports.map((exportRow) => (
              <li key={exportRow.id}>
                {exportRow.fileName} | {exportRow.createdAt.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
