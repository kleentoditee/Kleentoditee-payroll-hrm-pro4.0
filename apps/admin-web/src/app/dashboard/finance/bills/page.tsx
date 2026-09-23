"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type BillRow = {
  id: string;
  number: string;
  status: "draft" | "open" | "partial" | "paid" | "void";
  billDate: string;
  dueDate: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  supplier: { id: string; displayName: string };
  _count: { lines: number };
};

const STATUS_CLASS: Record<BillRow["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-sky-100 text-sky-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-800"
};

const SORT_OPTIONS = [
  { value: "", label: "Bill date (newest)" },
  { value: "billDate", label: "Bill date (oldest)" },
  { value: "number", label: "Number (A–Z)" },
  { value: "dueDate", label: "Due date (soonest)" },
  { value: "-total", label: "Total (high–low)" },
  { value: "total", label: "Total (low–high)" },
  { value: "-balance", label: "Balance (high–low)" },
  { value: "status", label: "Status" }
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

export default function BillsListPage() {
  const list = useListQuery(["status"]);
  const status = list.filter("status");

  const [items, setItems] = useState<BillRow[] | null>(null);
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
        const res = await fetch(`${apiBase()}/finance/bills${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: BillRow[]; pagination: PaginationMeta }>(res);
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
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bills</h2>
        </div>
        <Link
          href="/dashboard/finance/bills/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New bill
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search bills</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search number, memo, or supplier"
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
                <option value="open">Open</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="void">Void</option>
              </select>
            </label>
            <SortSelect id="bills-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
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
          noun="bills"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <p className="text-sm text-slate-600">
          {list.q || status
            ? "No bills match the current search or filters."
            : "No bills yet. Create one above — you’ll need at least one supplier and one expense account first."}
        </p>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <Link href={`/dashboard/finance/bills/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>{" "}
                  <span className="text-slate-500">· {row.supplier.displayName}</span>
                </p>
                <p className="text-sm text-slate-600">
                  Bill {fmtDate(row.billDate)} · Due {fmtDate(row.dueDate)} ·{" "}
                  {row._count.lines} line{row._count.lines === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">${fmtMoney(row.total)}</p>
                  <p className="text-xs text-slate-500">Balance ${fmtMoney(row.balance)}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_CLASS[row.status]}`}>
                  {row.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
