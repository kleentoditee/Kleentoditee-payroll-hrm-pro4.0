"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Account = { id: string; code: string; name: string; type: string; subtype?: string };

type ReconRow = {
  id: string;
  statementEndingDate: string;
  statementEndingBalance: number;
  openingBalance: number;
  clearedNet: number;
  difference: number;
  status: "in_progress" | "completed";
  completedAt: string | null;
  bankAccount: { id: string; code: string; name: string };
  _count: { lines: number };
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReconciliationsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<ReconRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [endingDate, setEndingDate] = useState("");
  const [endingBalance, setEndingBalance] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items?: Account[]; accounts?: Account[] }>(res);
      const all = json.items ?? json.accounts ?? [];
      const banks = all.filter((a) => a.type === "asset" && /bank|cash/i.test(a.subtype ?? ""));
      const list = banks.length > 0 ? banks : all.filter((a) => a.type === "asset");
      setAccounts(list);
      if (list.length > 0) setBankAccountId(list[0].id);
    })().catch(() => setError("Failed to load accounts"));
  }, []);

  const load = useCallback(async () => {
    try {
      const q = bankAccountId ? `?bankAccountId=${bankAccountId}` : "";
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations${q}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items: ReconRow[] }>(res);
      setItems(json.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load reconciliations");
    }
  }, [bankAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          bankAccountId,
          statementEndingDate: endingDate,
          statementEndingBalance: Number(endingBalance)
        })
      });
      const json = await readApiData<{ reconciliation: { id: string } }>(res);
      router.push(`/dashboard/finance/reconciliations/${json.reconciliation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start reconciliation");
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bank reconciliation</h2>
        <p className="text-sm text-slate-600">
          Clear statement lines against the opening balance until the difference is zero, then complete to lock the
          session. Completed sessions can only be reopened by a controlled, audited unlock.
        </p>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          Bank account
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Statement ending date
          <input
            type="date"
            value={endingDate}
            onChange={(e) => setEndingDate(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Ending balance
          <input
            type="number"
            step="0.01"
            value={endingBalance}
            onChange={(e) => setEndingBalance(e.target.value)}
            className="ml-2 w-32 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || !bankAccountId || !endingDate || endingBalance === ""}
          onClick={() => void start()}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Start reconciliation
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Statement end</th>
              <th className="px-3 py-2 text-right">Opening</th>
              <th className="px-3 py-2 text-right">Cleared</th>
              <th className="px-3 py-2 text-right">Ending</th>
              <th className="px-3 py-2 text-right">Difference</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Lines</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/dashboard/finance/reconciliations/${r.id}`} className="text-sky-700 hover:underline">
                    {r.bankAccount.code} — {r.bankAccount.name}
                  </Link>
                </td>
                <td className="px-3 py-2">{r.statementEndingDate.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right tabular-nums">${money(r.openingBalance)}</td>
                <td className="px-3 py-2 text-right tabular-nums">${money(r.clearedNet)}</td>
                <td className="px-3 py-2 text-right tabular-nums">${money(r.statementEndingBalance)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${Math.abs(r.difference) > 0.005 ? "text-rose-600" : ""}`}>
                  ${money(r.difference)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.status === "completed" ? "completed" : "in progress"}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r._count.lines}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                  No reconciliations yet — start one above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
