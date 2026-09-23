"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

const SORT_OPTIONS = [
  { value: "", label: "Created (newest)" },
  { value: "-statementEndingDate", label: "Statement end (newest)" },
  { value: "statementEndingDate", label: "Statement end (oldest)" },
  { value: "status", label: "Status" },
  { value: "createdAt", label: "Created (oldest)" }
];

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReconciliationsPage() {
  const router = useRouter();
  const list = useListQuery();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<ReconRow[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bankAccountId, setBankAccountId] = useState("");
  const [endingDate, setEndingDate] = useState("");
  const [endingBalance, setEndingBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  // Bank accounts feed the start form + list filter; legacy unpaginated
  // response is intentional so every bank account stays selectable.
  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items?: Account[]; accounts?: Account[] }>(res);
      const all = json.items ?? json.accounts ?? [];
      const banks = all.filter((a) => a.type === "asset" && /bank|cash/i.test(a.subtype ?? ""));
      const options = banks.length > 0 ? banks : all.filter((a) => a.type === "asset");
      setAccounts(options);
      if (options.length > 0) setBankAccountId(options[0].id);
    })().catch(() => setError("Failed to load accounts"));
  }, []);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const extra = bankAccountId ? `&bankAccountId=${encodeURIComponent(bankAccountId)}` : "";
        const res = await fetch(`${apiBase()}/finance/banking/reconciliations${list.queryString}${extra}`, {
          headers: { ...authHeaders() }
        });
        const json = await readApiData<{ items: ReconRow[]; pagination: PaginationMeta }>(res);
        if (seq !== loadSeq.current) return;
        setItems(json.items);
        setPagination(json.pagination);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : "Failed to load reconciliations");
        setLoading(false);
      }
    })();
  }, [list.queryString, bankAccountId, nonce]);

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

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
        <label className="text-sm font-medium text-slate-700">
          Bank account
          <select
            value={bankAccountId}
            onChange={(e) => {
              setBankAccountId(e.target.value);
              list.setPage(1);
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Ending balance
          <input
            type="number"
            step="0.01"
            value={endingBalance}
            onChange={(e) => setEndingBalance(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy || !bankAccountId || !endingDate || endingBalance === ""}
          onClick={() => void start()}
          className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2 xl:col-span-1"
        >
          Start reconciliation
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <SortSelect id="reconciliations-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
      </div>

      {pagination || loading || error ? (
        <PaginationControls
          page={list.page}
          pageSize={list.pageSize}
          total={pagination?.total ?? 0}
          loading={loading}
          error={error}
          onRetry={() => setNonce((n) => n + 1)}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          noun="reconciliations"
        />
      ) : null}

      {!error && !loading && items.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No reconciliations yet — start one above.
        </p>
      ) : null}

      {!error && items.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <RecordCardList>
            {items.map((item) => (
              <RecordCard key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/finance/reconciliations/${item.id}`} className="break-words font-semibold text-sky-700 hover:underline">
                      {item.bankAccount.code} - {item.bankAccount.name}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Statement ending {item.statementEndingDate.slice(0, 10)}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${item.status === "completed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {item.status === "completed" ? "Completed" : "In progress"}
                  </span>
                </div>
                <RecordCardFields>
                  <RecordCardField label="Opening">${money(item.openingBalance)}</RecordCardField>
                  <RecordCardField label="Cleared">${money(item.clearedNet)}</RecordCardField>
                  <RecordCardField label="Ending">${money(item.statementEndingBalance)}</RecordCardField>
                  <RecordCardField label="Difference">
                    <span className={Math.abs(item.difference) > 0.005 ? "text-rose-600" : ""}>${money(item.difference)}</span>
                  </RecordCardField>
                  <RecordCardField label="Lines">{item._count.lines}</RecordCardField>
                </RecordCardFields>
              </RecordCard>
            ))}
          </RecordCardList>
          <BoundedTable>
          <table className="min-w-[1040px] text-sm">
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
            </tbody>
          </table>
          </BoundedTable>
        </div>
      ) : null}
    </section>
  );
}
