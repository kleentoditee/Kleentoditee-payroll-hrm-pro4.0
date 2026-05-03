"use client";

import { authenticatedFetch, readApiData } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subtype: string;
  description: string;
  active: boolean;
  parentId: string | null;
};

const TYPE_LABEL: Record<AccountRow["type"], string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expense"
};

const EMPTY_FORM = {
  code: "",
  name: "",
  type: "asset" as AccountRow["type"],
  subtype: "",
  description: ""
};

export default function AccountsListPage() {
  const [items, setItems] = useState<AccountRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/finance/accounts");
        const data = await readApiData<{ items: AccountRow[] }>(res);
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
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const grouped = useMemo(() => {
    if (!items) return null;
    const map = new Map<AccountRow["type"], AccountRow[]>();
    for (const row of items) {
      const list = map.get(row.type) ?? [];
      list.push(row);
      map.set(row.type, list);
    }
    return (["asset", "liability", "equity", "revenue", "expense"] as AccountRow["type"][])
      .map((type) => ({ type, rows: map.get(type) ?? [] }))
      .filter((g) => g.rows.length > 0);
  }, [items]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await authenticatedFetch("/finance/accounts", {
        method: "POST",
      body: JSON.stringify(form)
      });
      await readApiData<{ error?: string }>(res);
      setForm(EMPTY_FORM);
      setNonce((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Chart of accounts</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Master list of GL accounts. Products, invoices, and bills post into these. Keep numbering
          consistent with your accountant&rsquo;s COA.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[6rem_1fr_8rem_1fr_auto]"
      >
        <label className="text-sm">
          <span className="text-slate-700">Code</span>
          <input
            required
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="1000"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Name</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Cash"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Type</span>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AccountRow["type"] }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          >
            {(Object.keys(TYPE_LABEL) as AccountRow["type"][]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Subtype (optional)</span>
          <input
            value={form.subtype}
            onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value }))}
            placeholder="Bank"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add account"}
          </button>
        </div>
        {formError ? (
          <p className="md:col-span-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
      </form>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">
          No accounts yet. Add one above or run{" "}
          <code className="rounded bg-slate-100 px-1">npm run db:seed</code> to load the starter COA.
        </p>
      ) : (
        <div className="space-y-6">
          {grouped?.map((group) => (
            <section key={group.type}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {TYPE_LABEL[group.type]}
              </h3>
              <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
                {group.rows.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">
                        <span className="text-slate-500">{row.code}</span> &middot; {row.name}
                      </p>
                      <p className="text-sm text-slate-600">
                        {row.subtype || "—"}
                        {row.description ? ` · ${row.description}` : ""}
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
