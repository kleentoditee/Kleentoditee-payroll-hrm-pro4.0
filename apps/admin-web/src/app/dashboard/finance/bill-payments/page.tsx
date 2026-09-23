"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type BillPaymentRow = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  amount: number;
  applied: number;
  unapplied: number;
  reference: string;
  supplier: { id: string; displayName: string };
  sourceAccount: { id: string; code: string; name: string };
  _count: { applications: number };
};

const SORT_OPTIONS = [
  { value: "", label: "Payment date (newest)" },
  { value: "paymentDate", label: "Payment date (oldest)" },
  { value: "number", label: "Number (A–Z)" },
  { value: "-amount", label: "Amount (high–low)" },
  { value: "amount", label: "Amount (low–high)" },
  { value: "method", label: "Method" },
  { value: "createdAt", label: "Created (oldest)" }
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function BillPaymentsListPage() {
  const list = useListQuery();
  const [items, setItems] = useState<BillPaymentRow[] | null>(null);
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
        const res = await fetch(`${apiBase()}/finance/bill-payments${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: BillPaymentRow[]; pagination: PaginationMeta }>(res);
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
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bill payments</h2>
        </div>
        <Link
          href="/dashboard/finance/bill-payments/new"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Pay bills
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search bill payments</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search number, reference, memo, or supplier"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <SortSelect id="bill-payments-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
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
          noun="bill payments"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <p className="text-sm text-slate-600">
          {list.q ? "No bill payments match the current search." : "No bill payments recorded yet."}
        </p>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-col items-stretch gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words font-medium text-slate-900">
                  <Link href={`/dashboard/finance/bill-payments/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>{" "}
                  <span className="text-slate-500">· {row.supplier.displayName}</span>
                </p>
                <p className="break-words text-sm text-slate-600">
                  {fmtDate(row.paymentDate)} · {row.method}
                  {row.reference ? ` · ref ${row.reference}` : ""} ·{" "}
                  {row._count.applications} application{row._count.applications === 1 ? "" : "s"}
                </p>
                <p className="break-words text-xs text-slate-500">
                  Paid from {row.sourceAccount.code} {row.sourceAccount.name}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-sm font-semibold text-slate-900">${row.amount.toFixed(2)}</p>
                <p className="text-xs text-slate-500">
                  applied ${row.applied.toFixed(2)} · unapplied ${row.unapplied.toFixed(2)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
