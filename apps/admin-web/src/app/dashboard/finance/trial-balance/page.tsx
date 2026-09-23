"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList, RecordCardTotals } from "@/components/finance/record-cards";
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

type ControlRow = {
  code: string;
  name: string;
  accountPresent: boolean;
  glBalance: number;
  subledgerBalance: number;
  difference: number;
  status: "ok" | "mismatch";
};

type ControlReconciliation = {
  rows: ControlRow[];
  allOk: boolean;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalance | null>(null);
  const [recon, setRecon] = useState<ControlReconciliation | null>(null);
  const [reconError, setReconError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/reports/control-reconciliation`, {
          headers: { ...authHeaders() }
        });
        const json = await readApiData<ControlReconciliation>(res);
        if (!cancelled) {
          setRecon(json);
          setReconError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setReconError(e instanceof Error ? e.message : "Failed to load control reconciliation");
          setRecon(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <RecordCardList>
                {data.rows.map((row) => (
                  <RecordCard key={row.accountId}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-slate-500">{row.code}</p>
                        <p className="break-words font-semibold text-slate-950">{row.name}</p>
                      </div>
                      <span className="shrink-0 rounded bg-slate-100 px-2 py-1 text-xs capitalize text-slate-700">{row.type}</span>
                    </div>
                    <RecordCardFields>
                      <RecordCardField label="Debits">${money(row.totalDebit)}</RecordCardField>
                      <RecordCardField label="Credits">${money(row.totalCredit)}</RecordCardField>
                      <RecordCardField label="Balance">
                        <span className={row.balance < 0 ? "text-rose-600" : ""}>${money(row.balance)}</span>
                      </RecordCardField>
                    </RecordCardFields>
                  </RecordCard>
                ))}
              </RecordCardList>
              <RecordCardTotals
                items={[
                  { label: "Total debits", value: `$${money(data.totalDebit)}`, strong: true },
                  { label: "Total credits", value: `$${money(data.totalCredit)}`, strong: true }
                ]}
              />
              <BoundedTable>
              <table className="min-w-[760px] text-sm">
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
              </BoundedTable>
            </div>
          )}
          <p className="text-xs text-slate-500">As of {data.asOf.slice(0, 10)} · management-prepared, unaudited.</p>
        </>
      ) : null}

      <div className="space-y-3 border-t border-slate-200 pt-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Control account reconciliation</h3>
          <p className="text-sm text-slate-600">
            Posted GL control balances vs the operational subledgers (open documents and pay runs).
          </p>
        </div>
        {reconError ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{reconError}</p>
        ) : null}
        {recon === null && !reconError ? <p className="text-sm text-slate-500">Loading…</p> : null}
        {recon ? (
          <>
            <p
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                recon.allOk ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
              }`}
            >
              {recon.allOk
                ? "All control accounts reconcile to their subledgers."
                : "One or more control accounts differ from the subledger — review the rows below."}
            </p>
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <RecordCardList>
                {recon.rows.map((row) => (
                  <RecordCard key={row.code}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-slate-500">{row.code}</p>
                        <p className="break-words font-semibold text-slate-950">{row.name}</p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${row.status === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                        {row.status}
                      </span>
                    </div>
                    {!row.accountPresent ? <p className="mt-2 text-xs font-medium text-amber-800">Not in chart of accounts</p> : null}
                    <RecordCardFields>
                      <RecordCardField label="GL balance">${money(row.glBalance)}</RecordCardField>
                      <RecordCardField label="Subledger">${money(row.subledgerBalance)}</RecordCardField>
                      <RecordCardField label="Difference">
                        <span className={row.status === "mismatch" ? "text-rose-600" : ""}>${money(row.difference)}</span>
                      </RecordCardField>
                    </RecordCardFields>
                  </RecordCard>
                ))}
              </RecordCardList>
              <BoundedTable>
              <table className="min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Control account</th>
                    <th className="px-3 py-2 text-right">GL balance</th>
                    <th className="px-3 py-2 text-right">Subledger</th>
                    <th className="px-3 py-2 text-right">Difference</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recon.rows.map((row) => (
                    <tr key={row.code} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{row.code}</td>
                      <td className="px-3 py-2">
                        {row.name}
                        {!row.accountPresent ? (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                            not in chart
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(row.glBalance)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">${money(row.subledgerBalance)}</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          row.status === "mismatch" ? "font-medium text-rose-600" : ""
                        }`}
                      >
                        ${money(row.difference)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            row.status === "ok"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </BoundedTable>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
