"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useEffect, useMemo, useState } from "react";

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  kind: "service" | "product" | "bundle";
  description: string;
  salesPrice: number;
  purchaseCost: number;
  taxable: boolean;
  active: boolean;
  incomeAccount: AccountLite;
  expenseAccount: AccountLite | null;
};

const EMPTY_FORM = {
  sku: "",
  name: "",
  kind: "service" as ProductRow["kind"],
  salesPrice: "0",
  incomeAccountId: "",
  expenseAccountId: ""
};

export default function ProductsListPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountLite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/accounts`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: AccountLite[] }>(res);
        if (!cancelled) {
          setAccounts(data.items);
        }
      } catch {
        if (!cancelled) setAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
          const res = await fetch(`${apiBase()}/finance/products${qs}`, {
            headers: { ...authHeaders() }
          });
          const data = await readApiData<{ items: ProductRow[] }>(res);
          if (!cancelled) {
            setItems(data.items);
            setError(null);
          }
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : "Failed to load");
            setItems(null);
          }
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, nonce]);

  const revenueAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "revenue"),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.type === "expense"),
    [accounts]
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...form,
          salesPrice: Number(form.salesPrice || "0"),
          expenseAccountId: form.expenseAccountId || null
        })
      });
      await readApiData<{ error?: string }>(res);
      setForm(EMPTY_FORM);
      setNonce((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create product");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    form.sku.trim() && form.name.trim() && form.incomeAccountId && revenueAccounts.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Products &amp; services</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Sellable items and services. Each maps to a revenue account for sales and, optionally, an
          expense account for cost tracking.
        </p>
      </div>

      {revenueAccounts.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add at least one <strong>revenue</strong>-type account in the Chart of Accounts before
          creating products.
        </p>
      ) : null}

      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-3"
      >
        <label className="text-sm">
          <span className="text-slate-700">SKU</span>
          <input
            required
            value={form.sku}
            onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="SVC-CLEAN-STD"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Standard cleaning service"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Kind</span>
          <select
            value={form.kind}
            onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as ProductRow["kind"] }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          >
            <option value="service">Service</option>
            <option value="product">Product</option>
            <option value="bundle">Bundle</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Sales price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.salesPrice}
            onChange={(e) => setForm((f) => ({ ...f, salesPrice: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Income account</span>
          <select
            required
            value={form.incomeAccountId}
            onChange={(e) => setForm((f) => ({ ...f, incomeAccountId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          >
            <option value="">Select a revenue account…</option>
            {revenueAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Expense account (optional)</span>
          <select
            value={form.expenseAccountId}
            onChange={(e) => setForm((f) => ({ ...f, expenseAccountId: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          >
            <option value="">—</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end xl:col-span-3">
          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add product or service"}
          </button>
        </div>
        {formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 md:col-span-2 xl:col-span-3">
            {formError}
          </p>
        ) : null}
      </form>

      <label className="block max-w-md text-sm">
        <span className="text-slate-700">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SKU, name, or description"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          No products or services yet. Add one above or seed the database.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-medium text-slate-900">
                  <span className="text-slate-500">{row.sku}</span> &middot; {row.name}
                </p>
                <p className="text-sm text-slate-600">
                  {row.kind} &middot; ${row.salesPrice.toFixed(2)} &middot; income:{" "}
                  {row.incomeAccount.code} {row.incomeAccount.name}
                  {row.expenseAccount ? ` · expense: ${row.expenseAccount.code} ${row.expenseAccount.name}` : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                }`}
              >
                {row.active ? "Active" : "Inactive"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
