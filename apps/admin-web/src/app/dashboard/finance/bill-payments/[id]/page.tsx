"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type BillPaymentDetail = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  reference: string;
  memo: string;
  amount: number;
  applied: number;
  unapplied: number;
  supplier: { id: string; displayName: string; email: string };
  sourceAccount: { id: string; code: string; name: string };
  applications: Array<{
    id: string;
    amount: number;
    bill: {
      id: string;
      number: string;
      total: number;
      amountPaid: number;
      balance: number;
      status: string;
    };
  }>;
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function BillPaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [billPayment, setBillPayment] = useState<BillPaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`/finance/bill-payments/${id}`);
      const data = await readApiData<{ billPayment: BillPaymentDetail }>(res);
      setBillPayment(data.billPayment);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setBillPayment(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unapply(applicationId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await authenticatedFetch(`/finance/bill-payments/${id}/unapply/${applicationId}`, { method: "POST" });
      if (!res.ok) {
        await readApiData<{ error?: string }>(res);
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteBillPayment() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await authenticatedFetch(`/finance/bill-payments/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        await readApiData<{ error?: string }>(res);
      }
      router.push("/dashboard/finance/bill-payments");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }
  if (!billPayment) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bill payment {billPayment.number}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {billPayment.supplier.displayName}
            {billPayment.supplier.email ? ` · ${billPayment.supplier.email}` : ""}
          </p>
          <p className="text-sm text-slate-600">
            {fmtDate(billPayment.paymentDate)} · {billPayment.method}
            {billPayment.reference ? ` · ref ${billPayment.reference}` : ""}
          </p>
          <p className="text-sm text-slate-600">
            Paid from {billPayment.sourceAccount.code} {billPayment.sourceAccount.name}
          </p>
          {billPayment.memo ? <p className="mt-2 text-sm text-slate-600">{billPayment.memo}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">${billPayment.amount.toFixed(2)}</p>
          <p className="text-xs text-slate-500">
            applied ${billPayment.applied.toFixed(2)} · unapplied ${billPayment.unapplied.toFixed(2)}
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Bill</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Bill total</th>
              <th className="px-4 py-2 text-right">New balance</th>
              <th className="px-4 py-2 text-right">Applied</th>
              <th className="px-4 py-2 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {billPayment.applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                  Unapplied — no bills linked yet.
                </td>
              </tr>
            ) : (
              billPayment.applications.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/finance/bills/${app.bill.id}`}
                      className="font-medium text-slate-900 hover:text-brand"
                    >
                      {app.bill.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">{app.bill.status}</td>
                  <td className="px-4 py-2 text-right">${app.bill.total.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${app.bill.balance.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium">${app.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => unapply(app.id)}
                      disabled={busy}
                      className="text-xs font-semibold text-slate-500 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unapply
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/bill-payments"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={deleteBillPayment}
          disabled={busy}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete bill payment
        </button>
      </div>
    </div>
  );
}
