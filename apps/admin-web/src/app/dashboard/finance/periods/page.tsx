"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

type FiscalPeriodRow = {
  id: string;
  year: number;
  period: number;
  startDate: string;
  endDate: string;
  status: "open" | "soft_closed" | "locked";
  closedAt: string | null;
};

type FiscalYearRow = {
  id: string;
  year: number;
  startDate: string;
  endDate: string;
  closedAt: string | null;
  periods: FiscalPeriodRow[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  open: { badge: "bg-emerald-100 text-emerald-800", label: "Open" },
  soft_closed: { badge: "bg-amber-100 text-amber-800", label: "Closed" },
  locked: { badge: "bg-rose-100 text-rose-700", label: "Locked" }
};

export default function FiscalPeriodsPage() {
  const [years, setYears] = useState<FiscalYearRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${apiBase()}/finance/periods`, { headers: { ...authHeaders() } });
      const data = await readApiData<{ items: FiscalYearRow[] }>(res);
      setYears(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fiscal periods");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(id: string, action: "close" | "lock" | "reopen") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/periods/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() }
      });
      await readApiData(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Fiscal periods</h2>
        <p className="text-sm text-slate-600">
          Posting is only allowed into open periods. Close a month to stop new postings; lock it when the period
          is final. Reopening a locked period requires the platform owner and is audit-logged.
        </p>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {years === null && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {years !== null && years.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No fiscal periods yet. Periods are created automatically when the first journal posts into a month.
        </p>
      ) : null}

      {years?.map((y) => (
        <div key={y.id} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2" colSpan={4}>Fiscal year {y.year}</th>
              </tr>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {y.periods.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{MONTHS[p.period - 1] ?? p.period} {p.year}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {p.startDate.slice(0, 10)} → {p.endDate.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status].badge}`}>
                      {STATUS_STYLE[p.status].label}
                    </span>
                  </td>
                  <td className="space-x-2 px-3 py-2">
                    {p.status === "open" ? (
                      <>
                        <button disabled={busy} onClick={() => void act(p.id, "close")} className="text-amber-700 hover:underline">Close</button>
                        <button disabled={busy} onClick={() => void act(p.id, "lock")} className="text-rose-700 hover:underline">Lock</button>
                      </>
                    ) : null}
                    {p.status === "soft_closed" ? (
                      <>
                        <button disabled={busy} onClick={() => void act(p.id, "reopen")} className="text-teal-700 hover:underline">Reopen</button>
                        <button disabled={busy} onClick={() => void act(p.id, "lock")} className="text-rose-700 hover:underline">Lock</button>
                      </>
                    ) : null}
                    {p.status === "locked" ? (
                      <button disabled={busy} onClick={() => void act(p.id, "reopen")} className="text-teal-700 hover:underline">Reopen (owner)</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
