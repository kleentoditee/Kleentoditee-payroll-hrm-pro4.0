"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
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
  customer: { id: string; displayName: string; email: string; billingAddress: string };
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
};

const STATUS_CLASS: Record<Status, string> = {
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
      const res = await authenticatedFetch(`/finance/invoices/${id}`);
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
      const res = await authenticatedFetch(path, {
        method,
        
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Invoice {invoice.number}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {invoice.customer.displayName}
            {invoice.customer.email ? ` · ${invoice.customer.email}` : ""}
          </p>
          <p className="text-sm text-slate-600">
            Issued {fmtDate(invoice.issueDate)} · Due {fmtDate(invoice.dueDate)}
          </p>
          {invoice.memo ? <p className="mt-2 text-sm text-slate-600">{invoice.memo}</p> : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_CLASS[invoice.status]}`}>
          {invoice.status}
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Income acct</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 text-slate-500">{line.position}</td>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-900">
                    {line.product?.name ?? line.description ?? "(line)"}
                  </p>
                  {line.product ? <p className="text-xs text-slate-500">{line.product.sku}</p> : null}
                  {line.description && line.product ? (
                    <p className="text-xs text-slate-500">{line.description}</p>
                  ) : null}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {line.incomeAccount.code} · {line.incomeAccount.name}
                </td>
                <td className="px-4 py-2 text-right">{line.quantity}</td>
                <td className="px-4 py-2 text-right">${line.unitPrice.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-medium">${line.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Subtotal</td>
              <td className="px-4 py-2 text-right font-semibold">${invoice.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Tax</td>
              <td className="px-4 py-2 text-right font-semibold">${invoice.taxTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-700">Total</td>
              <td className="px-4 py-2 text-right font-bold">${invoice.total.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Paid</td>
              <td className="px-4 py-2 text-right">${invoice.amountPaid.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-700">Balance due</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900">
                ${invoice.balance.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/invoices"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </Link>
        {invoice.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={() => doAction(`/finance/invoices/${invoice.id}/send`, "POST")}
              disabled={busy}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
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
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Void
          </button>
        ) : null}
      </div>
    </div>
  );
}
