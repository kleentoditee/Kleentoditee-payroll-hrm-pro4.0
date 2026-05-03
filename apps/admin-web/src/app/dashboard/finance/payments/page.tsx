"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function PaymentsListPage() {
  const [items, setItems] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyUnapplied, setOnlyUnapplied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = onlyUnapplied ? "?hasUnapplied=true" : "";
        const res = await authenticatedFetch(`/finance/payments${qs}`);
        const data = await readApiData<{ items: PaymentRow[] }>(res);
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
  }, [onlyUnapplied]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Customer payments</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Payments received from customers. Record a payment and apply it to one or more open
            invoices. Any leftover stays as unapplied credit on the customer.
          </p>
        </div>
        <Link
          href="/dashboard/finance/payments/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Record payment
        </Link>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={onlyUnapplied}
          onChange={(e) => setOnlyUnapplied(e.target.checked)}
        />
        Show only payments with unapplied credit
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No payments recorded yet.</p>
      ) : (
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
      )}
    </div>
  );
}
