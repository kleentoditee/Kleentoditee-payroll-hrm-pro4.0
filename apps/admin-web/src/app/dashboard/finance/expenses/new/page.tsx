"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SupplierLite = { id: string; displayName: string };

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type Line = {
  key: string;
  description: string;
  quantity: string;
  unitCost: string;
  expenseAccountId: string;
};

function newLine(): Line {
  return {
    key: Math.random().toString(36).slice(2, 10),
    description: "",
    quantity: "1",
    unitCost: "0",
    expenseAccountId: ""
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewExpensePage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [expenseDate, setExpenseDate] = useState(today);
  const [method, setMethod] = useState<"cash" | "check" | "card" | "ach" | "other">("card");
  const [reference, setReference] = useState("");
  const [memo, setMemo] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sRes, aRes] = await Promise.all([
          authenticatedFetch("/finance/suppliers"),
          authenticatedFetch("/finance/accounts")
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

  const assetAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);
  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === "expense"), [accounts]);

  const subtotal = useMemo(
    () =>
      round2(
        lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitCost || 0), 0)
      ),
    [lines]
  );

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeLine(key: string) {
    setLines((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        expenseDate,
        method,
        reference,
        memo,
        supplierId: supplierId || null,
        payeeName,
        paymentAccountId,
        lines: lines.map((l, i) => ({
          position: i + 1,
          description: l.description,
          quantity: Number(l.quantity || 0),
          unitCost: Number(l.unitCost || 0),
          expenseAccountId: l.expenseAccountId
        }))
      };
      const res = await authenticatedFetch("/finance/expenses", {
        method: "POST",
      body: JSON.stringify(payload)
      });
      const data = await readApiData<{ expense: { id: string } }>(res);
      router.push(`/dashboard/finance/expenses/${data.expense.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create expense");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">New expense</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Record a direct disbursement. Pick a supplier or just enter a payee name. Saving creates
          a draft; posting it puts it on the books.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <label className="text-sm">
            <span className="text-slate-700">Supplier (optional)</span>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="text-slate-700">Payee name (if no supplier)</span>
            <input
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder="Costco, Shell, etc."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Expense date</span>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
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
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="ach">ACH / bank transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Reference</span>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm md:col-span-3">
            <span className="text-slate-700">Paid from</span>
            <select
              required
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Lines</h3>
            <button
              type="button"
              onClick={() => setLines((r) => [...r, newLine()])}
              className="text-sm font-semibold text-brand hover:underline"
            >
              + Add line
            </button>
          </div>
          <div className="space-y-3">
            {lines.map((line) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[3fr_6rem_8rem_2fr_auto]"
              >
                <input
                  required
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => patchLine(line.key, { description: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit cost"
                  value={line.unitCost}
                  onChange={(e) => patchLine(line.key, { unitCost: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                />
                <select
                  required
                  value={line.expenseAccountId}
                  onChange={(e) => patchLine(line.key, { expenseAccountId: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                >
                  <option value="">Expense account…</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 1}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
          </div>
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/finance/expenses")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save draft expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
