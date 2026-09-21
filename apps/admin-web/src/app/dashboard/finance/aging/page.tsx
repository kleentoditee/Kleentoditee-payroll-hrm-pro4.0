"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type AgingRow = { id: string; number: string; name: string; dueDate: string; balance: number; daysOverdue: number };
type AgingSide = { asOf: string; rows: AgingRow[]; buckets: { current: number; days1to30: number; days31to60: number; days61to90: number; over90: number }; total: number };
type Aging = { ar: AgingSide; ap: AgingSide };

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function BucketBar({ side }: { side: AgingSide }) {
  const entries: Array<[string, number]> = [
    ["Current", side.buckets.current],
    ["1–30", side.buckets.days1to30],
    ["31–60", side.buckets.days31to60],
    ["61–90", side.buckets.days61to90],
    ["90+", side.buckets.over90]
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className={`text-base font-semibold tabular-nums ${label !== "Current" && value > 0 ? "text-amber-700" : "text-slate-900"}`}>
            ${money(value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function AgingTable({ side }: { side: AgingSide }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Number</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Due date</th>
            <th className="px-3 py-2 text-right">Days overdue</th>
            <th className="px-3 py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {side.rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium">{r.number}</td>
              <td className="px-3 py-2">{r.name}</td>
              <td className="px-3 py-2">{r.dueDate}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${r.daysOverdue > 0 ? "text-amber-700" : ""}`}>{r.daysOverdue}</td>
              <td className="px-3 py-2 text-right tabular-nums">${money(r.balance)}</td>
            </tr>
          ))}
          {side.rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-500">Nothing open.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

export default function AgingPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [aging, setAging] = useState<Aging | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/statements/aging?asOf=${asOf}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ aging: Aging }>(res);
      setAging(json.aging);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load aging");
    }
  }, [asOf]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">AR / AP aging</h2>
          <p className="text-sm text-slate-600">Open invoice and bill balances bucketed by days past due.</p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          As of
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        </label>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {aging ? (
        <>
          <h3 className="text-sm font-semibold text-slate-900">Accounts receivable — total ${money(aging.ar.total)}</h3>
          <BucketBar side={aging.ar} />
          <AgingTable side={aging.ar} />
          <h3 className="pt-2 text-sm font-semibold text-slate-900">Accounts payable — total ${money(aging.ap.total)}</h3>
          <BucketBar side={aging.ap} />
          <AgingTable side={aging.ap} />
        </>
      ) : null}
    </section>
  );
}
