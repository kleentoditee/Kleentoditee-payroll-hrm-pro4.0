"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Status = "draft" | "open" | "void";

type DepositDetail = {
  id: string;
  number: string;
  status: Status;
  depositDate: string;
  memo: string;
  total: number;
  postedAt: string | null;
  voidedAt: string | null;
  bankAccount: { id: string; code: string; name: string };
  lines: Array<{
    id: string;
    position: number;
    description: string;
    amount: number;
    payment: {
      id: string;
      number: string;
      paymentDate: string;
      method: string;
      amount: number;
      customer: { id: string; displayName: string };
    } | null;
  }>;
};

const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-800"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function DepositDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [deposit, setDeposit] = useState<DepositDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/deposits/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ deposit: DepositDetail }>(res);
      setDeposit(data.deposit);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setDeposit(null);
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
  if (!deposit) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Deposit {deposit.number}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {fmtDate(deposit.depositDate)} · {deposit.bankAccount.code} {deposit.bankAccount.name}
            {deposit.postedAt ? ` · posted ${fmtDate(deposit.postedAt)}` : ""}
          </p>
          {deposit.memo ? <p className="mt-2 text-sm text-slate-600">{deposit.memo}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">${deposit.total.toFixed(2)}</p>
          <span
            className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${
              STATUS_CLASS[deposit.status]
            }`}
          >
            {deposit.status === "open" ? "posted" : deposit.status}
          </span>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {deposit.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 text-slate-500">{line.position}</td>
                <td className="px-4 py-2">
                  {line.payment ? (
                    <Link
                      href={`/dashboard/finance/payments/${line.payment.id}`}
                      className="font-medium text-slate-900 hover:text-brand"
                    >
                      {line.payment.number}
                    </Link>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  {line.payment?.customer.displayName ?? "—"}
                </td>
                <td className="px-4 py-2 text-slate-600">{line.description || "—"}</td>
                <td className="px-4 py-2 text-right font-medium">${line.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-right text-slate-700">
                Total
              </td>
              <td className="px-4 py-2 text-right font-bold">${deposit.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/deposits"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </Link>
        {deposit.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={() => doAction(`/finance/deposits/${deposit.id}/post`, "POST")}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Post deposit
            </button>
            <button
              type="button"
              onClick={() =>
                doAction(`/finance/deposits/${deposit.id}`, "DELETE", () =>
                  router.push("/dashboard/finance/deposits")
                )
              }
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete draft
            </button>
          </>
        ) : null}
        {deposit.status === "open" ? (
          <button
            type="button"
            onClick={() => doAction(`/finance/deposits/${deposit.id}/void`, "POST")}
            disabled={busy}
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reverse deposit
          </button>
        ) : null}
      </div>
    </div>
  );
}
