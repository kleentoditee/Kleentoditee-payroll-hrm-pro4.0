"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type CustomerLite = { id: string; displayName: string };

type ProductLite = {
  id: string;
  sku: string;
  name: string;
  salesPrice: number;
  incomeAccountId: string;
};

type Line = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  incomeAccountId: string;
};

function newLine(): Line {
  return {
    key: Math.random().toString(36).slice(2, 10),
    productId: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    incomeAccountId: ""
  };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [customerId, setCustomerId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, pRes, aRes] = await Promise.all([
          fetch(`${apiBase()}/finance/customers`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/products`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } })
        ]);
        const cJson = (await cRes.json()) as { items: CustomerLite[] };
        const pJson = (await pRes.json()) as { items: ProductLite[] };
        const aJson = (await aRes.json()) as { items: AccountLite[] };
        setCustomers(cJson.items ?? []);
        setProducts(pJson.items ?? []);
        setAccounts(aJson.items ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load lookups");
      }
    })();
  }, []);

  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.type === "revenue"),
    [accounts]
  );

  const subtotal = useMemo(
    () =>
      round2(
        lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0)
      ),
    [lines]
  );

  function onProductChange(key: string, productId: string) {
    const product = products.find((p) => p.id === productId);
    setLines((rows) =>
      rows.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              productId,
              description: product ? product.name : r.description,
              unitPrice: product ? String(product.salesPrice) : r.unitPrice,
              incomeAccountId: product ? product.incomeAccountId : r.incomeAccountId
            }
      )
    );
  }

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
        customerId,
        issueDate,
        dueDate: dueDate || null,
        memo,
        lines: lines.map((l, i) => ({
          position: i + 1,
          productId: l.productId || null,
          description: l.description,
          quantity: Number(l.quantity || 0),
          unitPrice: Number(l.unitPrice || 0),
          incomeAccountId: l.incomeAccountId
        }))
      };
      const res = await fetch(`${apiBase()}/finance/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      const data = (await res.json()) as { invoice: { id: string } };
      router.push(`/dashboard/finance/invoices/${data.invoice.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">New invoice</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Create a draft. Picking a product auto-fills the description, unit price, and income
          account — but you can override each.
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
            <span className="text-slate-700">Issue date</span>
            <input
              type="date"
              required
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
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
                className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[2fr_3fr_6rem_8rem_2fr_auto]"
              >
                <select
                  value={line.productId}
                  onChange={(e) => onProductChange(line.key, e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                >
                  <option value="">(Custom line)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
                <input
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
                  placeholder="Unit"
                  value={line.unitPrice}
                  onChange={(e) => patchLine(line.key, { unitPrice: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                />
                <select
                  required
                  value={line.incomeAccountId}
                  onChange={(e) => patchLine(line.key, { incomeAccountId: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
                >
                  <option value="">Revenue account…</option>
                  {revenueAccounts.map((a) => (
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
            onClick={() => router.push("/dashboard/finance/invoices")}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save draft invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
