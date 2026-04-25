"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type CustomerLite = { id: string; displayName: string };

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
  total: number;
  amountPaid: number;
  balance: number;
  status: "draft" | "open" | "partial" | "paid" | "void";
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const appliedTotal = useMemo(
    () =>
      round2(
        Object.values(apply).reduce((s, v) => s + Number(v || 0), 0)
      ),
    [apply]
  );

  const amountNum = Number(amount || 0);
  const unapplied = round2(amountNum - appliedTotal);
  const overApplied = appliedTotal - 0.005 > amountNum;

  function setApplyFor(invoiceId: string, v: string) {
    setApply((m) => ({ ...m, [invoiceId]: v }));
  }

  function autoFill() {
    let remaining = amountNum;
    const next: Record<string, string> = {};
    for (const inv of openInvoices) {
      if (remaining <= 0.005) break;
      const take = Math.min(inv.balance, remaining);
      next[inv.id] = take.toFixed(2);
      remaining = round2(remaining - take);
    }
    setApply(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const applications = openInvoices
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
      router.push(`/dashboard/finance/payments/${data.payment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    customerId && depositAccountId && amountNum > 0 && !overApplied;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Record customer payment</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Enter the total received, pick the deposit account, then apply amounts to the
          customer&rsquo;s open invoices. Leftover stays as unapplied credit.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="text-slate-700">Customer</span>
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
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
            <span className="text-slate-700">Amount</span>
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
          <label className="text-sm">
            <span className="text-slate-700">Method</span>
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
            <span className="text-slate-700">Reference (check #, trace)</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm md:col-span-3">
            <span className="text-slate-700">Deposit account</span>
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
          <label className="text-sm md:col-span-3">
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
            <h3 className="text-sm font-semibold text-slate-700">Apply to open invoices</h3>
            <button
              type="button"
              onClick={autoFill}
              disabled={!amountNum || openInvoices.length === 0}
              className="text-sm font-semibold text-brand hover:underline disabled:text-slate-400"
            >
              Auto-fill oldest first
            </button>
          </div>
          {!customerId ? (
            <p className="text-sm text-slate-600">Pick a customer to see their open invoices.</p>
          ) : openInvoices.length === 0 ? (
            <p className="text-sm text-slate-600">
              No open or partial invoices for this customer — the payment will be fully unapplied
              (held as credit).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Invoice</th>
                  <th className="pb-2">Issue date</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-right">Apply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openInvoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 font-medium text-slate-900">{inv.number}</td>
                    <td className="py-2 text-slate-600">
                      {new Date(inv.issueDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2 text-right">${inv.balance.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={inv.balance}
                        value={apply[inv.id] ?? ""}
                        onChange={(e) => setApplyFor(inv.id, e.target.value)}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none ring-brand focus:ring-2"
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-4 flex flex-col items-end gap-1 text-sm">
            <div>
              <span className="text-slate-600">Applied </span>
              <span className="font-semibold text-slate-900">${appliedTotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-600">Unapplied </span>
              <span className={`font-semibold ${overApplied ? "text-red-700" : "text-slate-900"}`}>
                ${unapplied.toFixed(2)}
              </span>
            </div>
            {overApplied ? (
              <p className="text-xs text-red-700">Applied amount exceeds payment total.</p>
            ) : null}
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/finance/payments")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
