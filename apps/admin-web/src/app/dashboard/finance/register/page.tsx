"use client";

import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { PaginationControls } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { type PaginationMeta, useListQuery } from "@/lib/use-list-query";
import { useCallback, useEffect, useRef, useState } from "react";

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
  pageOpeningBalance: number;
  pageClosingBalance: number;
  total: number;
  rows: RegisterRow[];
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BankRegisterPage() {
  const list = useListQuery(["from", "to"]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [register, setRegister] = useState<Register | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  useEffect(() => {
    (async () => {
      const res = await fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items?: Account[]; accounts?: Account[] }>(res);
      const all = json.items ?? json.accounts ?? [];
      const banks = all.filter((account) => account.type === "asset" && /bank|cash/i.test(account.subtype ?? ""));
      const available = banks.length > 0 ? banks : all.filter((account) => account.type === "asset");
      setAccounts(available);
      if (available.length > 0) setAccountId(available[0].id);
      if (available.length === 0) setLoading(false);
    })().catch(() => {
      setError("Failed to load accounts");
      setLoading(false);
    });
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const query = new URLSearchParams(list.queryString.slice(1));
      query.set("_refresh", String(nonce));
      const res = await fetch(`${apiBase()}/finance/banking/register/${accountId}?${query.toString()}`, {
        headers: { ...authHeaders() }
      });
      const json = await readApiData<{ register: Register; pagination: PaginationMeta }>(res);
      if (seq !== loadSeq.current) return;
      setRegister(json.register);
      setPagination(json.pagination);
      setError(null);
      setLoading(false);
    } catch (loadError) {
      if (seq !== loadSeq.current) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load register");
      setRegister(null);
      setLoading(false);
    }
  }, [accountId, list.queryString, nonce]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bank register</h2>
        <p className="text-sm text-slate-600">
          Posted account movements with running balances and reconciliation status.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">
        <label className="text-sm font-medium text-slate-700">
          Account
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value);
              list.setPage(1);
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            value={list.filter("from")}
            onChange={(event) => list.setFilter("from", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            value={list.filter("to")}
            onChange={(event) => list.setFilter("to", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      {pagination || loading || error ? (
        <PaginationControls
          page={list.page}
          pageSize={list.pageSize}
          total={pagination?.total ?? 0}
          loading={loading}
          error={error}
          onRetry={() => setNonce((value) => value + 1)}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          noun="register entries"
        />
      ) : null}

      {register ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase text-slate-500">Opening balance</p>
              <p className="text-lg font-semibold tabular-nums">${money(register.openingBalance)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase text-slate-500">Closing balance</p>
              <p className="text-lg font-semibold tabular-nums">${money(register.closingBalance)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs uppercase text-slate-500">Entries in range</p>
              <p className="text-lg font-semibold tabular-nums">{pagination?.total ?? register.total}</p>
            </div>
          </div>

          {register.rows.length === 0 && !loading ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No activity was found for this account and date range.
            </p>
          ) : null}

          {register.rows.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <RecordCardList>
                {register.rows.map((row, index) => (
                  <RecordCard key={`${row.entryId}-${index}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-slate-950">{row.lineMemo || row.memo || "Ledger entry"}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.date.slice(0, 10)} · {row.sourceType}</p>
                      </div>
                      <span className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${row.reconciled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {row.reconciled ? "Reconciled" : "Open"}
                      </span>
                    </div>
                    <RecordCardFields>
                      <RecordCardField label="Debit">{row.debit > 0 ? `$${money(row.debit)}` : "-"}</RecordCardField>
                      <RecordCardField label="Credit">{row.credit > 0 ? `$${money(row.credit)}` : "-"}</RecordCardField>
                      <RecordCardField label="Balance">
                        <span className={row.runningBalance < 0 ? "text-rose-600" : ""}>${money(row.runningBalance)}</span>
                      </RecordCardField>
                    </RecordCardFields>
                  </RecordCard>
                ))}
              </RecordCardList>
              <BoundedTable>
                <table className="min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Memo</th>
                      <th className="px-3 py-2 text-right">Debit</th>
                      <th className="px-3 py-2 text-right">Credit</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {register.rows.map((row, index) => (
                      <tr key={`${row.entryId}-${index}`} className="border-b border-slate-100">
                        <td className="whitespace-nowrap px-3 py-2">{row.date.slice(0, 10)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.sourceType}</td>
                        <td className="max-w-sm break-words px-3 py-2">{row.lineMemo || row.memo}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.debit > 0 ? `$${money(row.debit)}` : ""}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.credit > 0 ? `$${money(row.credit)}` : ""}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${row.runningBalance < 0 ? "text-rose-600" : ""}`}>
                          ${money(row.runningBalance)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${row.reconciled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                            {row.reconciled ? "Reconciled" : "Open"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </BoundedTable>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
