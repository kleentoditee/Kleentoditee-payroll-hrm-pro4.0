"use client";

import { FinanceRecordBreadcrumbs } from "@/components/finance/record-breadcrumb";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CustomerLite = { id: string; displayName: string; email: string };

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type OpenInvoice = {
  id: string;
  number: string;
  issueDate: string;
  dueDate: string | null;
  total: number;
  amountPaid: number;
  balance: number;
  status: "draft" | "open" | "partial" | "paid" | "void";
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function formatMoney(value: number): string {
  return `$${round2(value).toFixed(2)}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not provided";
  return new Date(iso).toISOString().slice(0, 10);
}

export default function RecordPaymentPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("0");
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<"cash" | "check" | "card" | "ach" | "other">("cash");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [apply, setApply] = useState<Record<string, string>>({}); // invoiceId -> amount (string)
  const [selectedInvoices, setSelectedInvoices] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cRes, aRes] = await Promise.all([
          fetch(`${apiBase()}/finance/customers`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } })
        ]);
        const [cJson, aJson] = await Promise.all([
          readApiData<{ items: CustomerLite[] }>(cRes),
          readApiData<{ items: AccountLite[] }>(aRes)
        ]);
        if (!cancelled) {
          setCustomers(cJson.items ?? []);
          setAccounts(aJson.items ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load lookups");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customerId) {
      setOpenInvoices([]);
      setApply({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/finance/invoices?customerId=${encodeURIComponent(customerId)}`,
          { headers: { ...authHeaders() } }
        );
        const data = await readApiData<{ items: OpenInvoice[] }>(res);
        const open = (data.items ?? []).filter(
          (i) => i.status === "open" || i.status === "partial"
        );
        if (!cancelled) {
          setOpenInvoices(open);
          setApply({});
          setSelectedInvoices({});
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load open invoices");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const assetAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);
  const selectedCustomer = useMemo(() => customers.find((customer) => customer.id === customerId) ?? null, [customerId, customers]);

  const appliedTotal = useMemo(
    () =>
      round2(
        Object.entries(apply).reduce((s, [invoiceId, v]) => {
          if (!selectedInvoices[invoiceId]) return s;
          return s + Number(v || 0);
        }, 0)
      ),
    [apply, selectedInvoices]
  );

  const amountNum = Number(amount || 0);
  const unapplied = round2(amountNum - appliedTotal);
  const overApplied = appliedTotal - 0.005 > amountNum;
  const selectedOpenBalance = useMemo(
    () =>
      round2(
        openInvoices.reduce((sum, invoice) => (selectedInvoices[invoice.id] ? sum + Number(invoice.balance || 0) : sum), 0)
      ),
    [openInvoices, selectedInvoices]
  );
  const balanceAfterPayment = round2(Math.max(selectedOpenBalance - appliedTotal, 0));

  function setApplyFor(invoiceId: string, v: string) {
    setApply((m) => ({ ...m, [invoiceId]: v }));
  }

  function setSelectedFor(invoice: OpenInvoice, checked: boolean) {
    setSelectedInvoices((current) => ({ ...current, [invoice.id]: checked }));
    setApply((current) => {
      if (!checked) {
        return { ...current, [invoice.id]: "" };
      }
      if (current[invoice.id]) {
        return current;
      }
      const remaining = Math.max(amountNum - appliedTotal, 0);
      // suggest only what the entered payment can still cover; no balance fallback when nothing is left
      const suggested = Math.min(invoice.balance, remaining);
      return { ...current, [invoice.id]: suggested > 0 ? suggested.toFixed(2) : "" };
    });
  }

  function autoFill() {
    let remaining = amountNum;
    const next: Record<string, string> = {};
    const selected: Record<string, boolean> = {};
    for (const inv of openInvoices) {
      if (remaining <= 0.005) break;
      const take = Math.min(inv.balance, remaining);
      next[inv.id] = take.toFixed(2);
      selected[inv.id] = true;
      remaining = round2(remaining - take);
    }
    setApply(next);
    setSelectedInvoices(selected);
  }

  function resetForm() {
    setCustomerId("");
    setAmount("0");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setMethod("cash");
    setReference("");
    setMemo("");
    setDepositAccountId("");
    setOpenInvoices([]);
    setApply({});
    setSelectedInvoices({});
    setValidationMessage(null);
  }

  function validate(): string | null {
    if (!customerId) return "Select a customer.";
    if (!depositAccountId) return "Select a deposit account.";
    if (!(amountNum > 0)) return "Amount received must be greater than zero.";
    if (overApplied) return "Applied amount cannot exceed amount received.";
    for (const invoice of openInvoices) {
      if (!selectedInvoices[invoice.id]) continue;
      const applied = Number(apply[invoice.id] || 0);
      if (!(applied > 0)) return `Enter a payment amount for invoice ${invoice.number}.`;
      if (applied - 0.005 > invoice.balance) {
        return `Applied amount on ${invoice.number} cannot exceed ${formatMoney(invoice.balance)}.`;
      }
    }
    return null;
  }

  async function savePayment(nextAction: "close" | "new") {
    const validation = validate();
    setValidationMessage(validation);
    if (validation) return;

    setSubmitting(true);
    setError(null);
    try {
      const applications = openInvoices
        .filter((inv) => selectedInvoices[inv.id])
        .map((inv) => ({ invoiceId: inv.id, amount: Number(apply[inv.id] || 0) }))
        .filter((a) => a.amount > 0);
      const res = await fetch(`${apiBase()}/finance/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          customerId,
          paymentDate,
          method,
          reference,
          memo,
          amount: amountNum,
          depositAccountId,
          applications
        })
      });
      const data = await readApiData<{ payment: { id: string } }>(res);
      if (nextAction === "new") {
        resetForm();
      } else {
        router.push(`/dashboard/finance/payments/${data.payment.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    customerId && depositAccountId && amountNum > 0 && !overApplied && !submitting;

  return (
    <div className="space-y-6">
      <FinanceRecordBreadcrumbs recordLabel="New payment" />
      <div>
        <h2 className="mt-1 text-3xl font-bold text-slate-950">Receive payment</h2>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void savePayment("close");
        }}
        className="space-y-6"
      >
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-3">
          <label className="text-sm lg:col-span-2">
            <span className="text-slate-700">Customer</span>
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setValidationMessage(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer email</p>
            <p className="mt-1 font-semibold text-slate-900">{selectedCustomer?.email || "Not provided"}</p>
          </div>
          <label className="text-sm">
            <span className="text-slate-700">Payment date</span>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Payment method</span>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as typeof method)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card">Card</option>
              <option value="ach">ACH / bank transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Reference number</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Deposit to account</span>
            <select
              required
              value={depositAccountId}
              onChange={(e) => setDepositAccountId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="">Select an asset account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Amount received</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm lg:col-span-2">
            <span className="text-slate-700">Memo</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-950">Outstanding transactions</h3>
              <p className="mt-1 text-sm text-slate-600">Select invoice rows and enter how much of this payment should apply.</p>
            </div>
            <button
              type="button"
              onClick={autoFill}
              disabled={!amountNum || openInvoices.length === 0}
              className="rounded text-sm font-semibold text-brand outline-none ring-[#006D77] hover:underline focus-visible:ring-2 disabled:text-slate-400"
            >
              Auto-fill oldest first
            </button>
          </div>
          {!customerId ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              Pick a customer to see their open invoices.
            </p>
          ) : openInvoices.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
              No open or partial invoices for this customer — the payment will be fully unapplied
              (held as credit).
            </p>
          ) : (
            <>
            <div className="space-y-3 md:hidden">
              {openInvoices.map((inv) => (
                <article key={inv.id} className={`rounded-xl border border-slate-200 p-4 ${selectedInvoices[inv.id] ? "bg-[#F8FCFC]" : "bg-white"}`}>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedInvoices[inv.id])}
                      onChange={(e) => setSelectedFor(inv, e.target.checked)}
                      aria-label={`Apply payment to invoice ${inv.number}`}
                      className="mt-1 rounded border-slate-300 text-[#108000] focus:ring-[#006D77]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-950">{inv.number}</span>
                      <span className="mt-1 block text-sm text-slate-600">Due {formatDate(inv.dueDate)}</span>
                    </span>
                  </label>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Original amount</dt>
                      <dd className="font-semibold text-slate-900">{formatMoney(inv.total)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Open balance</dt>
                      <dd className="font-semibold text-slate-900">{formatMoney(inv.balance)}</dd>
                    </div>
                  </dl>
                  <label className="mt-3 block text-sm">
                    <span className="text-slate-700">Payment amount applied</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={inv.balance}
                      disabled={!selectedInvoices[inv.id]}
                      value={apply[inv.id] ?? ""}
                      onChange={(e) => setApplyFor(inv.id, e.target.value)}
                      className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm outline-none ring-brand focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      placeholder="0.00"
                    />
                  </label>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <span className="sr-only">Apply</span>
                    </th>
                    <th className="px-4 py-3">Invoice number</th>
                    <th className="px-4 py-3">Due date</th>
                    <th className="px-4 py-3 text-right">Original amount</th>
                    <th className="px-4 py-3 text-right">Open balance</th>
                    <th className="px-4 py-3 text-right">Payment amount applied</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openInvoices.map((inv) => (
                    <tr key={inv.id} className={selectedInvoices[inv.id] ? "bg-[#F8FCFC]" : undefined}>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedInvoices[inv.id])}
                          onChange={(e) => setSelectedFor(inv, e.target.checked)}
                          aria-label={`Apply payment to invoice ${inv.number}`}
                          className="rounded border-slate-300 text-[#108000] focus:ring-[#006D77]"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{inv.number}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(inv.dueDate)}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatMoney(inv.total)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(inv.balance)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max={inv.balance}
                          disabled={!selectedInvoices[inv.id]}
                          value={apply[inv.id] ?? ""}
                          onChange={(e) => setApplyFor(inv.id, e.target.value)}
                          className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none ring-brand focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                          placeholder="0.00"
                        />
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </>
          )}
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
            <div className="text-slate-600">
              Applied
              <p className="mt-1 text-lg font-bold text-slate-950">{formatMoney(appliedTotal)}</p>
            </div>
            <div className="text-slate-600">
              Unapplied credit
              <p className={`mt-1 text-lg font-bold ${overApplied ? "text-red-700" : "text-slate-950"}`}>
                {formatMoney(unapplied)}
              </p>
            </div>
            <div className="text-slate-600">
              Balance after payment
              <p className="mt-1 text-lg font-bold text-slate-950">{formatMoney(balanceAfterPayment)}</p>
            </div>
          </div>
            {overApplied ? (
            <p className="mt-2 text-xs font-semibold text-red-700">Applied amount exceeds payment total.</p>
            ) : null}
        </section>

        {validationMessage ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {validationMessage}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/dashboard/finance/payments")}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void savePayment("new")}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Saving..." : "Save and new"}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="min-h-11 w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-[#006D77] hover:bg-brand-soft focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Saving..." : "Save and close"}
          </button>
        </div>
      </form>
    </div>
  );
}
