"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type ExpenseRow = {
  id: string;
  number: string;
  status: "draft" | "open" | "partial" | "paid" | "void";
  expenseDate: string;
  method: string;
  payeeName: string;
  total: number;
  reference: string;
  supplier: { id: string; displayName: string } | null;
  paymentAccount: { id: string; code: string; name: string };
  _count: { lines: number };
};

const STATUS_CLASS: Record<ExpenseRow["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-800"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function ExpensesListPage() {
  const [items, setItems] = useState<ExpenseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"" | "draft" | "open" | "void">("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = status ? `?status=${status}` : "";
        const res = await authenticatedFetch(`/finance/expenses${qs}`);
        const data = await readApiData<{ items: ExpenseRow[] }>(res);
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
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Expenses</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Direct disbursements that aren&rsquo;t tied to a bill — card purchases, cash payouts,
            ACH transfers. Posting an expense moves it onto the books immediately.
          </p>
        </div>
        <Link
          href="/dashboard/finance/expenses/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New expense
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
          <option value="open">Posted</option>
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
          No expenses recorded yet. Add one from the button above.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <Link href={`/dashboard/finance/expenses/${row.id}`} className="hover:text-brand">
                    {row.number}
                  </Link>{" "}
                  <span className="text-slate-500">
                    · {row.supplier?.displayName ?? row.payeeName ?? "—"}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  {fmtDate(row.expenseDate)} · {row.method}
                  {row.reference ? ` · ref ${row.reference}` : ""} ·{" "}
                  {row._count.lines} line{row._count.lines === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-slate-500">
                  Paid from {row.paymentAccount.code} {row.paymentAccount.name}
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
      )}
    </div>
  );
}
