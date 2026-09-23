"use client";

import { FinanceRecordBreadcrumbs } from "@/components/finance/record-breadcrumb";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaymentDetail = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  reference: string;
  memo: string;
  amount: number;
  applied: number;
  unapplied: number;
  depositedAt: string | null;
  customer: { id: string; displayName: string; email: string };
  depositAccount: { id: string; code: string; name: string };
  applications: Array<{
    id: string;
    amount: number;
    invoice: {
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

export default function PaymentDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/payments/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ payment: PaymentDetail }>(res);
      setPayment(data.payment);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setPayment(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function unapply(applicationId: string) {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(
        `${apiBase()}/finance/payments/${id}/unapply/${applicationId}`,
        { method: "POST", headers: { ...authHeaders() } }
      );
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

  async function deletePayment() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/payments/${id}`, {
        method: "DELETE",
        headers: { ...authHeaders() }
      });
      if (!res.ok) {
        await readApiData<{ error?: string }>(res);
      }
      router.push("/dashboard/finance/payments");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <div className="space-y-6"><FinanceRecordBreadcrumbs /><p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p></div>;
  }
  if (!payment) {
    return <div className="space-y-6"><FinanceRecordBreadcrumbs /><p className="text-sm text-slate-600">Loading…</p></div>;
  }

  return (
    <div className="space-y-6">
      <FinanceRecordBreadcrumbs recordLabel={payment.number} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Payment {payment.number}</h2>
          <p className="mt-2 break-words text-sm text-slate-600">
            {payment.customer.displayName}
            {payment.customer.email ? ` · ${payment.customer.email}` : ""}
          </p>
          <p className="break-words text-sm text-slate-600">
            {fmtDate(payment.paymentDate)} · {payment.method}
            {payment.reference ? ` · ref ${payment.reference}` : ""}
          </p>
          <p className="break-words text-sm text-slate-600">
            Deposited to {payment.depositAccount.code} {payment.depositAccount.name}
            {payment.depositedAt ? ` (on ${fmtDate(payment.depositedAt)})` : ""}
          </p>
          {payment.memo ? <p className="mt-2 break-words text-sm text-slate-600">{payment.memo}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-slate-900">${payment.amount.toFixed(2)}</p>
          <p className="text-xs text-slate-500">
            applied ${payment.applied.toFixed(2)} · unapplied ${payment.unapplied.toFixed(2)}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 p-3 md:hidden">
          {payment.applications.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Unapplied — no invoices linked yet.
            </p>
          ) : (
            payment.applications.map((app) => (
              <article key={app.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice</p>
                    <Link
                      href={`/dashboard/finance/invoices/${app.invoice.id}`}
                      className="mt-1 block font-bold text-slate-950 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2"
                    >
                      {app.invoice.number}
                    </Link>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-700">
                    {app.invoice.status}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Invoice total</dt>
                    <dd className="font-semibold text-slate-900">${app.invoice.total.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">New balance</dt>
                    <dd className="font-semibold text-slate-900">${app.invoice.balance.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Applied</dt>
                    <dd className="font-semibold text-slate-900">${app.amount.toFixed(2)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={() => unapply(app.id)}
                  disabled={busy || !!payment.depositedAt}
                  title={payment.depositedAt ? "Reverse the deposit first" : undefined}
                  className="mt-3 min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Unapply
                </button>
              </article>
            ))
          )}
        </div>
        <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Invoice total</th>
              <th className="px-4 py-2 text-right">New balance</th>
              <th className="px-4 py-2 text-right">Applied</th>
              <th className="px-4 py-2 text-right">&nbsp;</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payment.applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-center text-slate-500">
                  Unapplied — no invoices linked yet.
                </td>
              </tr>
            ) : (
              payment.applications.map((app) => (
                <tr key={app.id}>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/finance/invoices/${app.invoice.id}`}
                      className="font-medium text-slate-900 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2"
                    >
                      {app.invoice.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize text-slate-600">{app.invoice.status}</td>
                  <td className="px-4 py-2 text-right">${app.invoice.total.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">${app.invoice.balance.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium">${app.amount.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => unapply(app.id)}
                      disabled={busy || !!payment.depositedAt}
                      title={payment.depositedAt ? "Reverse the deposit first" : undefined}
                      className="text-xs font-semibold text-slate-500 outline-none ring-[#006D77] hover:text-rose-700 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unapply
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/payments"
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
        >
          Back
        </Link>
        <button
          type="button"
          onClick={deletePayment}
          disabled={busy || !!payment.depositedAt}
          title={payment.depositedAt ? "Reverse the deposit first" : undefined}
          className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 outline-none ring-[#006D77] hover:bg-red-50 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Delete payment
        </button>
      </div>
    </div>
  );
}
