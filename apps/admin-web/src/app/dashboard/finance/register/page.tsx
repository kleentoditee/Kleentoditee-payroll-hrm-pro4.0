"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type Account = { id: string; code: string; name: string; type: string; subtype?: string };

type RegisterRow = {
  entryId: string;
  date: string;
  memo: string;
  sourceType: string;
  sourceId: string;
  lineMemo: string;
  debit: number;
  credit: number;
  runningBalance: number;
  entityType: string | null;
  reconciled: boolean;
};

type Register = {
  account: { id: string; code: string; name: string; type: string };
  openingBalance: number;
  closingBalance: number;
  rows: RegisterRow[];
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankRegisterPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [register, setRegister] = useState<Register | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items?: Account[]; accounts?: Account[] }>(res);
      const all = json.items ?? json.accounts ?? [];
      const banks = all.filter((a) => a.type === "asset" && /bank|cash/i.test(a.subtype ?? ""));
      const list = banks.length > 0 ? banks : all.filter((a) => a.type === "asset");
      setAccounts(list);
      if (list.length > 0) setAccountId(list[0].id);
    })().catch(() => setError("Failed to load accounts"));
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch(`${apiBase()}/finance/banking/register/${accountId}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ register: Register }>(res);
      setRegister(json.register);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load register");
      setRegister(null);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Bank register</h2>
          <p className="text-sm text-slate-600">
            Every posted movement on the account with a running balance — the ledger view, annotated with
            reconciliation state.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Account
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {register ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Opening</p>
              <p className="text-lg font-semibold tabular-nums">${money(register.openingBalance)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Closing</p>
              <p className="text-lg font-semibold tabular-nums">${money(register.closingBalance)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Reconciled rows</p>
              <p className="text-lg font-semibold tabular-nums">
                {register.rows.filter((r) => r.reconciled).length} / {register.rows.length}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Memo</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2">Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {register.rows.map((r, i) => (
                  <tr key={`${r.entryId}-${i}`} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">{r.date.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.sourceType}</td>
                    <td className="px-3 py-2">{r.lineMemo || r.memo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.debit > 0 ? `$${money(r.debit)}` : ""}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.credit > 0 ? `$${money(r.credit)}` : ""}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${r.runningBalance < 0 ? "text-rose-600" : ""}`}>
                      ${money(r.runningBalance)}
                    </td>
                    <td className="px-3 py-2">
                      {r.reconciled ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">✓</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {register.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                      No activity on this account yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
