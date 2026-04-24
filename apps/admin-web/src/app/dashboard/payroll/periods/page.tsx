"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type RunSummary = {
  id: string;
  status: string;
  itemCount: number;
  summary: { gross: number; totalDeductions: number; net: number };
};

type Period = {
  id: string;
  label: string;
  schedule: "weekly" | "biweekly" | "monthly";
  startDate: string;
  endDate: string;
  payDate: string | null;
  notes: string;
  runs: RunSummary[];
};

function monthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function monthEnd(): string {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export default function PayrollPeriodsPage() {
  const [scheduleFilter, setScheduleFilter] = useState("");
  const [items, setItems] = useState<Period[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [label, setLabel] = useState("");
  const [schedule, setSchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());
  const [payDate, setPayDate] = useState(monthEnd());
  const [notes, setNotes] = useState("");

  const loadPeriods = useCallback(async () => {
    try {
      const qs = scheduleFilter ? `?schedule=${scheduleFilter}` : "";
      const res = await fetch(`${apiBase()}/payroll/periods${qs}`, {
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? res.statusText);
      }
      const data = (await res.json()) as { items: Period[] };
      setItems(data.items);
      setError(null);
    } catch (e) {
      setItems(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [scheduleFilter]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          label,
          schedule,
          startDate,
          endDate,
          payDate,
          notes
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Create failed");
      }
      setLabel("");
      setNotes("");
      await loadPeriods();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payroll</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Pay periods</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Create monthly, weekly, or biweekly periods. Each period can produce one immutable pay run with
          printable paystubs and a general payroll CSV export.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <form onSubmit={onCreate} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-5">
        <label className="text-sm">
          <span className="text-slate-700">Schedule</span>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as typeof schedule)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Pay date</span>
          <input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Label (optional)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Auto-generated if blank"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm lg:col-span-4">
          <span className="text-slate-700">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create period"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-3">
        <label className="text-sm">
          <span className="text-slate-700">Filter</span>
          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="ml-2 rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All schedules</option>
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
      </div>

      {!items ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No pay periods yet. Create the first one above.</p>
      ) : (
        <div className="grid gap-4">
          {items.map((period) => {
            const latestRun = period.runs[0] ?? null;
            return (
              <article key={period.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="font-serif text-xl text-slate-900">{period.label}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {period.schedule} | {period.startDate.slice(0, 10)} to {period.endDate.slice(0, 10)}
                      {period.payDate ? ` | pay date ${period.payDate.slice(0, 10)}` : ""}
                    </p>
                    {period.notes ? <p className="mt-2 text-sm text-slate-500">{period.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-slate-500">Runs</p>
                    <p className="text-2xl font-semibold text-slate-900">{period.runs.length}</p>
                    <Link
                      href={`/dashboard/payroll/periods/${period.id}`}
                      className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
                    >
                      Open period
                    </Link>
                  </div>
                </div>

                {latestRun ? (
                  <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Latest run: {latestRun.status}</p>
                    <p className="mt-1">
                      {latestRun.itemCount} employee lines | gross {formatMoney(latestRun.summary.gross)} | net{" "}
                      {formatMoney(latestRun.summary.net)}
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
