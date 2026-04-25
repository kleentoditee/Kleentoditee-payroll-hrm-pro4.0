"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useState } from "react";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function DepositsListPage() {
  const [items, setItems] = useState<DepositRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/deposits`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: DepositRow[] }>(res);
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
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Deposits</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Group undeposited customer payments into a single bank deposit. Posting a deposit
            stamps each linked payment so it can&rsquo;t be modified.
          </p>
        </div>
        <Link
          href="/dashboard/finance/deposits/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          New deposit
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          No deposits yet. Record customer payments first, then group them here.
        </p>
      ) : (
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
      )}
    </div>
  );
}
