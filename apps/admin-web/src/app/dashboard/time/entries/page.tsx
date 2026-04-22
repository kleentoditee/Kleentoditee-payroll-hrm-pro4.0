"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  month: string;
  site: string;
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

export default function TimeEntriesListPage() {
  const [month, setMonth] = useState(currentMonth);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const params = new URLSearchParams({ month });
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
  }, [month, status, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Time</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Timesheets</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Monthly lines per employee (legacy-compatible). Multiple rows per employee/month are allowed for
            different sites.
          </p>
        </div>
        <Link
          href="/dashboard/time/entries/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Add timesheet
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="text-sm">
          <span className="text-slate-700">Payroll month</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
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
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No timesheets for this month. Add one or change the month.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-medium text-slate-900">{e.employee.fullName}</p>
                <p className="text-sm text-slate-600">
                  {e.site || "—"} · {e.daysWorked}d / {e.hoursWorked}h
                </p>
                <p className="text-xs text-slate-500">{e.template.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                  {e.status}
                </span>
                <Link href={`/dashboard/time/entries/${e.id}`} className="text-sm font-semibold text-brand hover:underline">
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
