"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

export default function BillsListPage() {
  const [items, setItems] = useState<BillRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | BillRow["status"]>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = status ? `?status=${status}` : "";
        const res = await authenticatedFetch(`/finance/bills${qs}`);
        const data = await readApiData<{ items: BillRow[] }>(res);
        if (!cancelled) {
          setItems(data.items);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setItems(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bills</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Supplier bills (AP). Enter a draft from a supplier&rsquo;s invoice, then receive it to
            start tracking the balance.
          </p>
        </div>
        <Link
          href="/dashboard/finance/bills/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New bill
        </Link>
      </div>

      <label className="block max-w-xs text-sm">
        <span className="text-slate-700">Status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
        >
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </select>
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          No bills yet. Create one above — you&rsquo;ll need at least one supplier and one expense
          account first.
        </p>
      ) : (
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
      )}
    </div>
  );
}
