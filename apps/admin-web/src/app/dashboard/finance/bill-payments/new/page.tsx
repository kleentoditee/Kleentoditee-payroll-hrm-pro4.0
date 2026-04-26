"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SupplierLite = { id: string; displayName: string };

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type OpenBill = {
  id: string;
  number: string;
  billDate: string;
  total: number;
  amountPaid: number;
  balance: number;
  status: "draft" | "open" | "partial" | "paid" | "void";
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function PayBillsPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("0");
  const today = new Date().toISOString().slice(0, 10);
  const [paymentDate, setPaymentDate] = useState(today);
  const [method, setMethod] = useState<"cash" | "check" | "card" | "ach" | "other">("check");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [apply, setApply] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          fetch(`${apiBase()}/finance/suppliers`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } })
        ]);
        const [sJson, aJson] = await Promise.all([
          readApiData<{ items: SupplierLite[] }>(sRes),
          readApiData<{ items: AccountLite[] }>(aRes)
        ]);
        if (!cancelled) {
          setSuppliers(sJson.items ?? []);
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
    if (!supplierId) {
      setOpenBills([]);
      setApply({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/finance/bills?supplierId=${encodeURIComponent(supplierId)}`,
          { headers: { ...authHeaders() } }
        );
        const data = await readApiData<{ items: OpenBill[] }>(res);
        const open = (data.items ?? []).filter(
          (b) => b.status === "open" || b.status === "partial"
        );
        if (!cancelled) {
          setOpenBills(open);
          setApply({});
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load open bills");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

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

  function setApplyFor(billId: string, v: string) {
    setApply((m) => ({ ...m, [billId]: v }));
  }

  function autoFill() {
    let remaining = amountNum;
    const next: Record<string, string> = {};
    for (const bill of openBills) {
      if (remaining <= 0.005) break;
      const take = Math.min(bill.balance, remaining);
      next[bill.id] = take.toFixed(2);
      remaining = round2(remaining - take);
    }
    setApply(next);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const applications = openBills
        .map((b) => ({ billId: b.id, amount: Number(apply[b.id] || 0) }))
        .filter((a) => a.amount > 0);
      const res = await fetch(`${apiBase()}/finance/bill-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          supplierId,
          paymentDate,
          method,
          reference,
          memo,
          amount: amountNum,
          sourceAccountId,
          applications
        })
      });
      const data = await readApiData<{ billPayment: { id: string } }>(res);
      router.push(`/dashboard/finance/bill-payments/${data.billPayment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record bill payment");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    supplierId && sourceAccountId && amountNum > 0 && !overApplied;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Pay bills</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Record a disbursement to a supplier and apply it to one or more open bills.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="text-slate-700">Supplier</span>
            <select
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
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
            <span className="text-slate-700">Source account (paid from)</span>
            <select
              required
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
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
            <h3 className="text-sm font-semibold text-slate-700">Apply to open bills</h3>
            <button
              type="button"
              onClick={autoFill}
              disabled={!amountNum || openBills.length === 0}
              className="text-sm font-semibold text-brand hover:underline disabled:text-slate-400"
            >
              Auto-fill oldest first
            </button>
          </div>
          {!supplierId ? (
            <p className="text-sm text-slate-600">Pick a supplier to see their open bills.</p>
          ) : openBills.length === 0 ? (
            <p className="text-sm text-slate-600">
              No open or partial bills for this supplier — the payment will stay unapplied.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2">Bill</th>
                  <th className="pb-2">Bill date</th>
                  <th className="pb-2 text-right">Balance</th>
                  <th className="pb-2 text-right">Apply</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openBills.map((bill) => (
                  <tr key={bill.id}>
                    <td className="py-2 font-medium text-slate-900">{bill.number}</td>
                    <td className="py-2 text-slate-600">
                      {new Date(bill.billDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2 text-right">${bill.balance.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={bill.balance}
                        value={apply[bill.id] ?? ""}
                        onChange={(e) => setApplyFor(bill.id, e.target.value)}
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
            onClick={() => router.push("/dashboard/finance/bill-payments")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save bill payment"}
          </button>
        </div>
      </form>
    </div>
  );
}
