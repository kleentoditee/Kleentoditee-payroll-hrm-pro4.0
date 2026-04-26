"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  month: string;
  periodStart: string | null;
  periodEnd: string | null;
  site: string;
  status: string;
  daysWorked: number;
  hoursWorked: number;
  employee: { id: string; fullName: string };
  template: { name: string };
};

function formatPeriod(row: Row): string {
  if (row.periodStart && row.periodEnd) {
    return `${row.periodStart.slice(0, 10)} → ${row.periodEnd.slice(0, 10)}`;
  }
  return row.month;
}

export default function TimeApprovalsPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ queue: "all", status: "submitted" });
    if (q.trim()) {
      params.set("q", q.trim());
    }
    const res = await fetch(`${apiBase()}/time/entries?${params}`, {
      headers: { ...authHeaders() }
    });
    const data = (await res.json()) as { error?: string; items?: Row[] };
    if (!res.ok) {
      throw new Error(data.error ?? res.statusText);
    }
    return data.items ?? [];
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const rows = await load();
          if (!cancelled) {
            setItems(rows);
            setError(null);
            setSelected(new Set());
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
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    if (!items?.length) {
      return;
    }
    setSelected(new Set(items.map((r) => r.id)));
  }

  async function approveSelected() {
    const ids = [...selected];
    if (ids.length === 0) {
      return;
    }
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`${apiBase()}/time/entries/bulk-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ids })
      });
      const j = (await res.json()) as { error?: string; updated?: number; skipped?: string[] };
      if (!res.ok) {
        throw new Error(j.error ?? res.statusText);
      }
      setToast(`Approved ${j.updated ?? 0} timesheet(s).`);
      const rows = await load();
      setItems(rows);
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Time</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Approval queue</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Submitted timesheets across all payroll months. Approve here so they become eligible for pay runs.
          Managers and payroll roles can approve; finance-only viewers cannot.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="text-slate-700">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Employee, site, notes"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <button
          type="button"
          onClick={selectAllVisible}
          disabled={!items?.length}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={approveSelected}
          disabled={busy || selected.size === 0}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? "Working…" : `Approve selected (${selected.size})`}
        </button>
      </div>

      {toast ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {toast}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No submitted timesheets. Everything is caught up.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center gap-3 px-4 py-4">
              <input
                type="checkbox"
                checked={selected.has(entry.id)}
                onChange={() => toggle(entry.id)}
                className="h-4 w-4 rounded border-slate-300"
                aria-label={`Select ${entry.employee.fullName}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{entry.employee.fullName}</p>
                <p className="text-sm text-slate-600">
                  {entry.site || "—"} · {formatPeriod(entry)} · {entry.daysWorked}d / {entry.hoursWorked}h
                </p>
                <p className="text-xs text-slate-500">{entry.template.name}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {entry.status}
              </span>
              <Link
                href={`/dashboard/time/entries/${entry.id}`}
                className="text-sm font-semibold text-brand hover:underline"
              >
                Review
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
