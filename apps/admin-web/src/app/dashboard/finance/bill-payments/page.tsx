"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function BillPaymentsListPage() {
  const [items, setItems] = useState<BillPaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/finance/bill-payments");
        const data = await readApiData<{ items: BillPaymentRow[] }>(res);
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
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bill payments</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Payments made to suppliers. Record a disbursement and apply it to one or more open
            bills.
          </p>
        </div>
        <Link
          href="/dashboard/finance/bill-payments/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Pay bills
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No bill payments recorded yet.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <Link href={`/dashboard/finance/bill-payments/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>{" "}
                  <span className="text-slate-500">· {row.supplier.displayName}</span>
                </p>
                <p className="text-sm text-slate-600">
                  {fmtDate(row.paymentDate)} · {row.method}
                  {row.reference ? ` · ref ${row.reference}` : ""} ·{" "}
                  {row._count.applications} application{row._count.applications === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500">
                  Paid from {row.sourceAccount.code} {row.sourceAccount.name}
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
      )}
    </div>
  );
}
