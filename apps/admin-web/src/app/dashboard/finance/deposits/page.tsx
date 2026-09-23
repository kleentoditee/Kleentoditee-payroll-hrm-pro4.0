"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DepositRow = {
  id: string;
  number: string;
  status: "draft" | "open" | "void";
  depositDate: string;
  total: number;
  bankAccount: { id: string; code: string; name: string };
  _count: { lines: number };
};

const STATUS_CLASS: Record<DepositRow["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-800"
};

const SORT_OPTIONS = [
  { value: "", label: "Deposit date (newest)" },
  { value: "depositDate", label: "Deposit date (oldest)" },
  { value: "number", label: "Number (A–Z)" },
  { value: "-total", label: "Total (high–low)" },
  { value: "total", label: "Total (low–high)" },
  { value: "status", label: "Status" }
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function DepositsListPage() {
  const list = useListQuery(["status"]);
  const status = list.filter("status");

  const [items, setItems] = useState<DepositRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/deposits${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: DepositRow[]; pagination: PaginationMeta }>(res);
        if (seq !== loadSeq.current) return;
        setItems(data.items);
        setPagination(data.pagination);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      }
    })();
  }, [list.queryString, nonce]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Deposits</h2>
        </div>
        <Link
          href="/dashboard/finance/deposits/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New deposit
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search deposits</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search number or memo"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Status
              <select
                value={status}
                onChange={(e) => list.setFilter("status", e.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none ring-[#006D77] focus-visible:ring-2"
              >
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="open">Posted</option>
                <option value="void">Void</option>
              </select>
            </label>
            <SortSelect id="deposits-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
          </div>
        </div>
      </section>

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
          noun="deposits"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <p className="text-sm text-slate-600">
          {list.q || status
            ? "No deposits match the current search or filters."
            : "No deposits yet. Record customer payments first, then group them here."}
        </p>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <Link href={`/dashboard/finance/deposits/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>
                </p>
                <p className="text-sm text-slate-600">
                  {fmtDate(row.depositDate)} · {row.bankAccount.code} {row.bankAccount.name} ·{" "}
                  {row._count.lines} line{row._count.lines === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-sm font-semibold text-slate-900">${row.total.toFixed(2)}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    STATUS_CLASS[row.status]
                  }`}
                >
                  {row.status === "open" ? "posted" : row.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
