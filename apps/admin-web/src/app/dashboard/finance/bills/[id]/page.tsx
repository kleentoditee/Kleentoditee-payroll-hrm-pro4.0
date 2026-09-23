"use client";

import { FinanceRecordBreadcrumbs } from "@/components/finance/record-breadcrumb";
import {
  BoundedTable,
  RecordCard,
  RecordCardField,
  RecordCardFields,
  RecordCardList,
  RecordCardTotals
} from "@/components/finance/record-cards";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Status = "draft" | "open" | "partial" | "paid" | "void";

type BillDetail = {
  id: string;
  number: string;
  status: Status;
  billDate: string;
  dueDate: string | null;
  memo: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  receivedAt: string | null;
  voidedAt: string | null;
  supplier: {
    id: string;
    displayName: string;
    email: string;
    mailingAddress: string;
  };
  lines: Array<{
    id: string;
    position: number;
    description: string;
    quantity: number;
    unitCost: number;
    amount: number;
    taxable: boolean;
    taxAmount: number;
    product: { id: string; sku: string; name: string } | null;
    expenseAccount: { id: string; code: string; name: string };
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

export default function BillDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [bill, setBill] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase()}/finance/bills/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = await readApiData<{ bill: BillDetail }>(res);
      setBill(data.bill);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setBill(null);
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
    return (
      <div className="space-y-6">
        <FinanceRecordBreadcrumbs />
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      </div>
    );
  }
  if (!bill) {
    return (
      <div className="space-y-6">
        <FinanceRecordBreadcrumbs />
        <p className="text-sm text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FinanceRecordBreadcrumbs recordLabel={bill.number} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Bill {bill.number}</h2>
          <p className="mt-2 break-words text-sm text-slate-600">
            {bill.supplier.displayName}
            {bill.supplier.email ? ` · ${bill.supplier.email}` : ""}
          </p>
          <p className="text-sm text-slate-600">
            Bill {fmtDate(bill.billDate)} · Due {fmtDate(bill.dueDate)}
          </p>
          {bill.memo ? <p className="mt-2 break-words text-sm text-slate-600">{bill.memo}</p> : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_CLASS[bill.status]}`}>
          {bill.status}
        </span>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <RecordCardList>
          {bill.lines.map((line) => (
            <RecordCard key={line.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Line {line.position}</p>
                  <p className="mt-1 break-words font-bold text-slate-950">
                    {line.product?.name ?? line.description ?? "(line)"}
                  </p>
                  {line.product?.sku ? <p className="break-words text-xs text-slate-500">{line.product.sku}</p> : null}
                  {line.description && line.product ? (
                    <p className="break-words text-xs text-slate-500">{line.description}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-bold text-slate-950">${line.amount.toFixed(2)}</p>
              </div>
              <RecordCardFields>
                <RecordCardField label="Expense account">
                  {line.expenseAccount.code} · {line.expenseAccount.name}
                </RecordCardField>
                <RecordCardField label="Quantity">{line.quantity}</RecordCardField>
                <RecordCardField label="Unit cost">${line.unitCost.toFixed(2)}</RecordCardField>
              </RecordCardFields>
            </RecordCard>
          ))}
        </RecordCardList>
        <RecordCardTotals
          items={[
            { label: "Subtotal", value: `$${bill.subtotal.toFixed(2)}` },
            { label: "Tax", value: `$${bill.taxTotal.toFixed(2)}` },
            { label: "Total", value: `$${bill.total.toFixed(2)}`, strong: true },
            { label: "Paid", value: `$${bill.amountPaid.toFixed(2)}` },
            { label: "Balance due", value: `$${bill.balance.toFixed(2)}`, strong: true }
          ]}
        />
        <BoundedTable>
        <table className="min-w-[48rem] w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Expense acct</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit cost</th>
              <th className="px-4 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bill.lines.map((line) => (
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
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Subtotal</td>
              <td className="px-4 py-2 text-right font-semibold">${bill.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Tax</td>
              <td className="px-4 py-2 text-right font-semibold">${bill.taxTotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-700">Total</td>
              <td className="px-4 py-2 text-right font-bold">${bill.total.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-600">Paid</td>
              <td className="px-4 py-2 text-right">${bill.amountPaid.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-right text-slate-700">Balance due</td>
              <td className="px-4 py-2 text-right font-bold text-slate-900">
                ${bill.balance.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
        </BoundedTable>
      </section>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/finance/bills"
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back
        </Link>
        {bill.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={() => doAction(`/finance/bills/${bill.id}/receive`, "POST")}
              disabled={busy}
              className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              Mark received
            </button>
            <button
              type="button"
              onClick={() =>
                doAction(`/finance/bills/${bill.id}`, "DELETE", () =>
                  router.push("/dashboard/finance/bills")
                )
              }
              disabled={busy}
              className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Delete draft
            </button>
          </>
        ) : null}
        {bill.status === "open" || bill.status === "partial" ? (
          <button
            type="button"
            onClick={() => doAction(`/finance/bills/${bill.id}/void`, "POST")}
            disabled={busy || bill.amountPaid > 0}
            title={bill.amountPaid > 0 ? "Unapply payments before voiding" : undefined}
            className="min-h-11 rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Void
          </button>
        ) : null}
      </div>
    </div>
  );
}
