"use client";

import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type RunRow = {
  id: string;
  status: string;
  itemCount: number;
  summary: { gross: number; totalDeductions: number; net: number };
  period: {
    id: string;
    label: string;
    schedule: string;
    payDate: string | null;
  };
};

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export default function PayrollRunsPage() {
  const [status, setStatus] = useState("");
  const [schedule, setSchedule] = useState("");
  const [items, setItems] = useState<RunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        if (status) {
          params.set("status", status);
        }
        if (schedule) {
          params.set("schedule", schedule);
        }
        const qs = params.toString() ? `?${params}` : "";
        const res = await authenticatedFetch(`/payroll/runs${qs}`);
        const data = (await res.json()) as { error?: string; items?: RunRow[] };
        if (!res.ok || !data.items) {
          throw new Error(data.error ?? "Load failed");
        }
        if (!cancelled) {
          setItems(data.items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
          setItems(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, schedule]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payroll</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Pay runs</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Draft runs can be rebuilt from approved time. Finalized runs become the source of truth for exports,
          paystubs, and paid status.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="exported">Exported</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Schedule</span>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No pay runs yet. Create a pay period first.</p>
      ) : (
        <div className="grid gap-4">
          {items.map((run) => (
            <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-serif text-xl text-slate-900">{run.period.label}</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {run.period.schedule} | {run.status} | {run.itemCount} employees
                    {run.period.payDate ? ` | pay date ${run.period.payDate.slice(0, 10)}` : ""}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Gross {formatMoney(run.summary.gross)} | Deductions {formatMoney(run.summary.totalDeductions)} |
                    Net {formatMoney(run.summary.net)}
                  </p>
                </div>
                <Link
                  href={`/dashboard/payroll/runs/${run.id}`}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  Open run
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
