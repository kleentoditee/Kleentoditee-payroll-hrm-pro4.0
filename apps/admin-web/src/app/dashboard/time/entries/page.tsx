"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  month: string;
  periodStart: string | null;
  periodEnd: string | null;
  site: string;
  startTime: string;
  endTime: string;
  status: string;
  daysWorked: number;
  hoursWorked: number;
  employee: { id: string; fullName: string };
  template: { name: string };
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatPeriod(row: Row): string {
  if (row.periodStart && row.periodEnd) {
    if (row.periodStart.slice(0, 10) === row.periodEnd.slice(0, 10)) return row.periodStart.slice(0, 10);
    return `${row.periodStart.slice(0, 10)} to ${row.periodEnd.slice(0, 10)}`;
  }
  return row.month;
}

export default function TimeEntriesListPage() {
  const [month, setMonth] = useState(currentMonth);
  const [allMonths, setAllMonths] = useState(false);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams();
          if (allMonths) {
            params.set("queue", "all");
          } else {
            params.set("month", month);
          }
          if (status) {
            params.set("status", status);
          }
          if (q.trim()) {
            params.set("q", q.trim());
          }
          const res = await fetch(`${apiBase()}/time/entries?${params}`, {
            headers: { ...authHeaders() }
          });
          if (!res.ok) {
            const j = (await res.json()) as { error?: string };
            throw new Error(j.error ?? res.statusText);
          }
          const data = (await res.json()) as { items: Row[] };
          if (!cancelled) {
            setItems(data.items);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
            setItems(null);
          }
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [month, allMonths, status, q]);

  async function submitEntry(entry: Row) {
    setSubmittingId(entry.id);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status: "submitted" })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not submit timesheet");
      }
      setItems((current) =>
        current?.map((row) => (row.id === entry.id ? { ...row, status: "submitted" } : row)) ?? null
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit timesheet");
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Time</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Timesheets</h2>
        </div>
        <Link
          href="/dashboard/time/entries/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Add work time
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={allMonths}
            onChange={(e) => setAllMonths(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-slate-700">All months (recent, up to 500)</span>
        </label>
        <label className={`text-sm ${allMonths ? "opacity-50" : ""}`}>
          <span className="text-slate-700">Payroll month</span>
          <input
            type="month"
            value={month}
            disabled={allMonths}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 disabled:cursor-not-allowed"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="text-slate-700">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Employee, site, notes"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No timesheets found.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <Link
                  href={`/dashboard/time/entries/${entry.id}`}
                  className="font-medium text-slate-900 hover:text-brand hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {entry.employee.fullName}
                </Link>
                <p className="text-sm text-slate-600">
                  {entry.site || "-"} | {formatPeriod(entry)} | {entry.startTime || "-"} to {entry.endTime || "-"} | {entry.hoursWorked}h
                </p>
                <p className="text-xs text-slate-500">{entry.template.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                  {entry.status}
                </span>
                {entry.status === "draft" ? (
                  <button
                    type="button"
                    onClick={() => submitEntry(entry)}
                    disabled={submittingId !== null}
                    className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingId === entry.id ? "Submitting..." : "Submit"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
