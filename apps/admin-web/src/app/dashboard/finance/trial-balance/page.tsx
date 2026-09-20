"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

type TrialBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  totalDebit: number;
  totalCredit: number;
  balance: number;
};

type TrialBalance = {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  asOf: string;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOf, setAsOf] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = asOf ? `?asOf=${encodeURIComponent(asOf)}` : "";
        const res = await fetch(`${apiBase()}/finance/reports/trial-balance${query}`, {
          headers: { ...authHeaders() }
        });
        const json = await readApiData<{ trialBalance: TrialBalance }>(res);
        if (!cancelled) {
          setData(json.trialBalance);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load trial balance");
          setData(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asOf]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Trial balance</h2>
          <p className="text-sm text-slate-600">
            Aggregated from posted journal lines — the ledger is the source of truth, not the documents.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          As of
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {data === null && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {data ? (
        <>
          <p
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              data.balanced ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
            }`}
          >
            {data.balanced
              ? `Balanced — total debits equal total credits ($${money(data.totalDebit)}).`
              : `OUT OF BALANCE — debits $${money(data.totalDebit)} vs credits $${money(data.totalCredit)}.`}
          </p>
          {data.rows.length === 0 ? (
            <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No posted journal activity yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Debits</th>
                    <th className="px-3 py-2 text-right">Credits</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.accountId} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.code}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 capitalize text-slate-600">{row.type}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(row.totalDebit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(row.totalCredit)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${row.balance < 0 ? "text-rose-600" : ""}`}>
                        ${money(row.balance)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">${money(data.totalDebit)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${money(data.totalCredit)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">As of {data.asOf.slice(0, 10)} · management-prepared, unaudited.</p>
        </>
      ) : null}
    </section>
  );
}
