"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Status = "draft" | "open" | "partial" | "paid" | "void";

type InvoiceDetail = {
  id: string;
  number: string;
  status: Status;
  issueDate: string;
  dueDate: string | null;
  memo: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  sentAt: string | null;
  voidedAt: string | null;
  customer: {
    id: string;
    displayName: string;
    companyName: string;
    email: string;
    phone: string;
    billingAddress: string;
  };
  lines: Array<{
    id: string;
    position: number;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    taxable: boolean;
    taxAmount: number;
    product: { id: string; sku: string; name: string } | null;
    incomeAccount: { id: string; code: string; name: string };
  }>;
  applications: Array<{
    id: string;
    amount: number;
    createdAt: string;
    payment: {
      id: string;
      number: string;
      paymentDate: string;
      method: string;
      reference: string;
    };
  }>;
};

const STATUS_CLASS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-sky-100 text-sky-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-800"
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "Not provided";
  return new Date(iso).toISOString().slice(0, 10);
}

function fmtMoney(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

type DisplayStatus = "Paid in full" | "Open" | "Overdue" | "Draft" | "Void";

const DISPLAY_STATUS_CLASS: Record<DisplayStatus, string> = {
  "Paid in full": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Open: "bg-sky-100 text-sky-800 ring-sky-200",
  Overdue: "bg-orange-100 text-orange-800 ring-orange-200",
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  Void: "bg-rose-100 text-rose-800 ring-rose-200"
};

function displayStatus(invoice: InvoiceDetail): DisplayStatus {
  if (invoice.status === "draft") return "Draft";
  if (invoice.status === "void") return "Void";
  if (invoice.balance <= 0.005) return "Paid in full";
  if (invoice.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "Overdue";
  }
  return "Open";
}

function MissingValue() {
  return <span className="text-slate-400">Not provided</span>;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/invoices/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ invoice: InvoiceDetail }>(res);
      setInvoice(data.invoice);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setInvoice(null);
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
  if (!invoice) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }

  const currentStatus = displayStatus(invoice);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/finance/invoices"
          className="rounded text-sm font-semibold text-[#063E4A] outline-none ring-[#006D77] hover:underline focus-visible:ring-2"
        >
          Back to invoices
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${
            DISPLAY_STATUS_CLASS[currentStatus]
          }`}
        >
          {currentStatus}
        </span>
      </div>

      {currentStatus === "Paid in full" ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Paid in full</p>
          <h2 className="mt-1 text-2xl font-black text-emerald-950">
            This invoice has a {fmtMoney(0)} balance due.
          </h2>
          <p className="mt-2 text-sm text-emerald-800">
            Payments applied equal the invoice total. Linked payments are shown below.
          </p>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Invoice</p>
                <h2 className="mt-1 text-3xl font-black text-slate-950">{invoice.number}</h2>
                {invoice.memo ? <p className="mt-2 text-sm text-slate-600">{invoice.memo}</p> : null}
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:min-w-96">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice date</p>
                  <p className="mt-1 font-semibold text-slate-900">{fmtDate(invoice.issueDate)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Due date</p>
                  <p className="mt-1 font-semibold text-slate-900">{fmtDate(invoice.dueDate)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Terms</p>
                  <p className="mt-1 font-semibold text-slate-900">Not provided</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Stored status</p>
                  <p className={`mt-1 font-semibold capitalize ${STATUS_CLASS[invoice.status].split(" ").at(-1) ?? "text-slate-900"}`}>
                    {invoice.status}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer</p>
                <Link
                  href={`/dashboard/finance/customers/${invoice.customer.id}`}
                  className="mt-1 block text-lg font-bold text-slate-950 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2"
                >
                  {invoice.customer.displayName}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{invoice.customer.companyName || <MissingValue />}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer email</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {invoice.customer.email || <MissingValue />}
                </p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">Phone</p>
                <p className="mt-1 text-sm text-slate-700">{invoice.customer.phone || <MissingValue />}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Billing address</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {invoice.customer.billingAddress || <MissingValue />}
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-bold text-slate-950">Products and services</h3>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {invoice.lines.map((line) => (
                <article key={line.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-950">{line.product?.name ?? "Custom line"}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {line.product?.sku ?? `${line.incomeAccount.code} · ${line.incomeAccount.name}`}
                  </p>
                  <p className="mt-3 text-sm text-slate-700">{line.description || <MissingValue />}</p>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Quantity</dt>
                      <dd className="font-semibold text-slate-900">{line.quantity}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Rate</dt>
                      <dd className="font-semibold text-slate-900">{fmtMoney(line.unitPrice)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="font-semibold text-slate-900">{fmtMoney(line.amount)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product/service</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Quantity</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {line.product?.name ?? "Custom line"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {line.product?.sku ?? `${line.incomeAccount.code} · ${line.incomeAccount.name}`}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{line.description || <MissingValue />}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{line.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{fmtMoney(line.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmtMoney(line.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <div>
                <h3 className="text-base font-bold text-slate-950">Linked payments</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Payments applied to this invoice through the existing receive payment workflow.
                </p>
                <div className="mt-4 rounded-xl border border-slate-200">
                  {invoice.applications.length === 0 ? (
                    <p className="bg-slate-50 px-4 py-5 text-sm text-slate-600">
                      No payments are linked to this invoice yet.
                    </p>
                  ) : (
                    <>
                    <div className="space-y-3 p-3 md:hidden">
                      {invoice.applications.map((application) => (
                        <article key={application.id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Payment</p>
                              <Link
                                href={`/dashboard/finance/payments/${application.payment.id}`}
                                className="mt-1 block font-bold text-slate-950 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2"
                              >
                                {application.payment.number}
                              </Link>
                            </div>
                            <p className="font-bold text-slate-950">{fmtMoney(application.amount)}</p>
                          </div>
                          <dl className="mt-3 grid gap-2 text-sm">
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Payment date</dt>
                              <dd className="font-semibold text-slate-900">{fmtDate(application.payment.paymentDate)}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Method</dt>
                              <dd className="font-semibold capitalize text-slate-900">{application.payment.method}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                              <dt className="text-slate-500">Reference</dt>
                              <dd className="font-semibold text-slate-900">{application.payment.reference || <MissingValue />}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Payment</th>
                          <th className="px-4 py-3">Payment date</th>
                          <th className="px-4 py-3">Method</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invoice.applications.map((application) => (
                          <tr key={application.id}>
                            <td className="px-4 py-3">
                              <Link
                                href={`/dashboard/finance/payments/${application.payment.id}`}
                                className="font-semibold text-slate-900 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2"
                              >
                                {application.payment.number}
                              </Link>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{fmtDate(application.payment.paymentDate)}</td>
                            <td className="px-4 py-3 capitalize text-slate-700">{application.payment.method}</td>
                            <td className="px-4 py-3 text-slate-700">
                              {application.payment.reference || <MissingValue />}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {fmtMoney(application.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    </>
                  )}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">Subtotal</dt>
                    <dd className="font-semibold text-slate-900">{fmtMoney(invoice.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">Tax</dt>
                    <dd className="font-semibold text-slate-900">{fmtMoney(invoice.taxTotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                    <dt className="font-semibold text-slate-700">Total</dt>
                    <dd className="font-bold text-slate-950">{fmtMoney(invoice.total)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">Payment applied</dt>
                    <dd className="font-semibold text-emerald-700">{fmtMoney(invoice.amountPaid)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-3">
                    <dt className="font-bold text-slate-900">Balance due</dt>
                    <dd className="text-xl font-black text-slate-950">{fmtMoney(invoice.balance)}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Invoice controls</p>
            <h3 className="mt-1 text-lg font-bold text-slate-950">{invoice.number}</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="font-semibold text-slate-700">Customer copy</dt>
                <dd className="mt-1 text-slate-600">{invoice.sentAt ? `Sent ${fmtDate(invoice.sentAt)}` : "Draft not sent"}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="font-semibold text-slate-700">Payment state</dt>
                <dd className="mt-1 text-slate-600">{currentStatus}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="font-semibold text-slate-700">Payment applied</dt>
                <dd className="mt-1 text-slate-600">{fmtMoney(invoice.amountPaid)}</dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="font-semibold text-slate-700">Balance due</dt>
                <dd className="mt-1 font-bold text-slate-950">{fmtMoney(invoice.balance)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2">
              {invoice.status === "draft" ? (
                <button
                  type="button"
                  onClick={() => doAction(`/finance/invoices/${invoice.id}/send`, "POST")}
                  disabled={busy}
                  className="inline-flex w-full min-h-10 items-center justify-center rounded-lg bg-[#063E4A] px-4 py-2 text-sm font-bold text-white outline-none ring-[#006D77] hover:bg-[#006D77] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Send invoice
                </button>
              ) : null}
              {invoice.status === "open" || invoice.status === "partial" ? (
                <Link
                  href="/dashboard/finance/payments/new"
                  className="inline-flex w-full min-h-10 items-center justify-center rounded-lg bg-[#063E4A] px-4 py-2 text-sm font-bold text-white outline-none ring-[#006D77] hover:bg-[#006D77] focus-visible:ring-2"
                >
                  Receive payment
                </Link>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/invoices"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
        >
          Back
        </Link>
        {invoice.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={() => doAction(`/finance/invoices/${invoice.id}/send`, "POST")}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-[#006D77] hover:bg-brand-soft focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() =>
                doAction(`/finance/invoices/${invoice.id}`, "DELETE", () =>
                  router.push("/dashboard/finance/invoices")
                )
              }
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 outline-none ring-[#006D77] hover:bg-red-50 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete draft
            </button>
          </>
        ) : null}
        {invoice.status === "open" || invoice.status === "partial" ? (
          <button
            type="button"
            onClick={() => doAction(`/finance/invoices/${invoice.id}/void`, "POST")}
            disabled={busy || invoice.amountPaid > 0}
            title={invoice.amountPaid > 0 ? "Unapply payments before voiding" : undefined}
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 outline-none ring-[#006D77] hover:bg-rose-50 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Void
          </button>
        ) : null}
      </div>
    </div>
  );
}
