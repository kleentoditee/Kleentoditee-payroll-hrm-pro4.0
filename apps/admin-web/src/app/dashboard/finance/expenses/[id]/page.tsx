"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Status = "draft" | "open" | "partial" | "paid" | "void";

type ExpenseDetail = {
  id: string;
  number: string;
  status: Status;
  expenseDate: string;
  method: string;
  reference: string;
  memo: string;
  payeeName: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  postedAt: string | null;
  voidedAt: string | null;
  supplier: { id: string; displayName: string; email: string } | null;
  paymentAccount: { id: string; code: string; name: string };
  lines: Array<{
    id: string;
    position: number;
    description: string;
    quantity: number;
    unitCost: number;
    amount: number;
    expenseAccount: { id: string; code: string; name: string };
  }>;
};

const STATUS_CLASS: Record<Status, string> = {
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

export default function ExpenseDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [expense, setExpense] = useState<ExpenseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/expenses/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ expense: ExpenseDetail }>(res);
      setExpense(data.expense);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setExpense(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function doAction(path: string, method: "POST" | "DELETE", onDone?: () => void) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        method,
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        await readApiData<{ error?: string }>(res);
      }
      if (onDone) onDone();
      else await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }
  if (!expense) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Expense {expense.number}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {expense.supplier?.displayName ?? expense.payeeName ?? "—"}
          </p>
          <p className="text-sm text-slate-600">
            {fmtDate(expense.expenseDate)} · {expense.method}
            {expense.reference ? ` · ref ${expense.reference}` : ""}
          </p>
          <p className="text-sm text-slate-600">
            Paid from {expense.paymentAccount.code} {expense.paymentAccount.name}
            {expense.postedAt ? ` · posted ${fmtDate(expense.postedAt)}` : ""}
          </p>
          {expense.memo ? <p className="mt-2 text-sm text-slate-600">{expense.memo}</p> : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
            STATUS_CLASS[expense.status]
          }`}
        >
          {expense.status === "open" ? "posted" : expense.status}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Expense acct</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit cost</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expense.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 text-slate-500">{line.position}</td>
                <td className="px-4 py-2 font-medium text-slate-900">{line.description || "—"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {line.expenseAccount.code} · {line.expenseAccount.name}
                </td>
                <td className="px-4 py-2 text-right">{line.quantity}</td>
                <td className="px-4 py-2 text-right">${line.unitCost.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-medium">${line.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right font-semibold">${expense.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-700">
                Total
              </td>
              <td className="px-4 py-2 text-right font-bold">${expense.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/expenses"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </Link>
        {expense.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={() => doAction(`/finance/expenses/${expense.id}/post`, "POST")}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Post
            </button>
            <button
              type="button"
              onClick={() =>
                doAction(`/finance/expenses/${expense.id}`, "DELETE", () =>
                  router.push("/dashboard/finance/expenses")
                )
              }
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete draft
            </button>
          </>
        ) : null}
        {expense.status === "open" ? (
          <button
            type="button"
            onClick={() => doAction(`/finance/expenses/${expense.id}/void`, "POST")}
            disabled={busy}
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Void
          </button>
        ) : null}
      </div>
    </div>
  );
}
