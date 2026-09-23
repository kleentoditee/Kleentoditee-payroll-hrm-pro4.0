"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
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
        <div key={y.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h3 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold uppercase text-slate-700">
            Fiscal year {y.year}
          </h3>
          <RecordCardList>
            {y.periods.map((period) => (
              <RecordCard key={period.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-950">{MONTHS[period.period - 1] ?? period.period} {period.year}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[period.status].badge}`}>
                    {STATUS_STYLE[period.status].label}
                  </span>
                </div>
                <RecordCardFields>
                  <RecordCardField label="Dates">{period.startDate.slice(0, 10)} to {period.endDate.slice(0, 10)}</RecordCardField>
                </RecordCardFields>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PeriodActions period={period} busy={busy} onAction={act} />
                </div>
              </RecordCard>
            ))}
          </RecordCardList>
          <BoundedTable>
          <table className="min-w-[720px] text-sm">
            <thead>
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
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2"><PeriodActions period={p} busy={busy} onAction={act} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </BoundedTable>
        </div>
      ))}
    </section>
  );
}

function PeriodActions({
  period,
  busy,
  onAction
}: {
  period: FiscalPeriodRow;
  busy: boolean;
  onAction: (id: string, action: "close" | "lock" | "reopen") => Promise<void>;
}) {
  const buttonClass = "inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50";
  if (period.status === "open") {
    return (
      <>
        <button disabled={busy} onClick={() => void onAction(period.id, "close")} className={`${buttonClass} text-amber-700`}>Close</button>
        <button disabled={busy} onClick={() => void onAction(period.id, "lock")} className={`${buttonClass} text-rose-700`}>Lock</button>
      </>
    );
  }
  if (period.status === "soft_closed") {
    return (
      <>
        <button disabled={busy} onClick={() => void onAction(period.id, "reopen")} className={`${buttonClass} text-teal-700`}>Reopen</button>
        <button disabled={busy} onClick={() => void onAction(period.id, "lock")} className={`${buttonClass} text-rose-700`}>Lock</button>
      </>
    );
  }
  return <button disabled={busy} onClick={() => void onAction(period.id, "reopen")} className={`${buttonClass} text-teal-700`}>Reopen (owner)</button>;
}
