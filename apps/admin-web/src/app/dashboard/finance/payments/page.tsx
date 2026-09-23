"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type PaymentRow = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  amount: number;
  applied: number;
  unapplied: number;
  reference: string;
  depositedAt: string | null;
  customer: { id: string; displayName: string };
  depositAccount: { id: string; code: string; name: string };
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

export default function PaymentsListPage() {
  const list = useListQuery(["hasUnapplied"]);
  const onlyUnapplied = list.filter("hasUnapplied") === "true";

  const [items, setItems] = useState<PaymentRow[] | null>(null);
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
        const res = await fetch(`${apiBase()}/finance/payments${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: PaymentRow[]; pagination: PaginationMeta }>(res);
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
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Customer payments</h2>
        </div>
        <Link
          href="/dashboard/finance/payments/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Record payment
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <label className="block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search payments</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search number, reference, memo, or customer"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyUnapplied}
                onChange={(e) => list.setFilter("hasUnapplied", e.target.checked ? "true" : "")}
                className="h-4 w-4 rounded border-slate-300"
              />
              Show only payments with unapplied credit
            </label>
            <SortSelect id="payments-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
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
          noun="payments"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <p className="text-sm text-slate-600">
          {list.q || onlyUnapplied
            ? "No payments match the current search or filters."
            : "No payments recorded yet."}
        </p>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <Link href={`/dashboard/finance/payments/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>{" "}
                  <span className="text-slate-500">· {row.customer.displayName}</span>
                </p>
                <p className="text-sm text-slate-600">
                  {fmtDate(row.paymentDate)} · {row.method}
                  {row.reference ? ` · ref ${row.reference}` : ""} ·{" "}
                  {row._count.applications} application{row._count.applications === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500">
                  Deposited to {row.depositAccount.code} {row.depositAccount.name}
                  {row.depositedAt ? ` (on ${fmtDate(row.depositedAt)})` : ""}
                </p>
              </div>
              <div className="text-right">
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
