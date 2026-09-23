"use client";

import { ActionButton, ActionLink, SplitActionButton } from "@/components/ui/action-button";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useMemo, useEffect, useState } from "react";

type SupplierRow = {
  id: string;
  displayName: string;
  companyName: string;
  primaryContact: string;
  email: string;
  phone: string;
  active: boolean;
};

const EMPTY_FORM = {
  displayName: "",
  companyName: "",
  primaryContact: "",
  email: "",
  phone: ""
};

export default function SuppliersListPage() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<SupplierRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      (async () => {
        try {
          const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
          const res = await fetch(`${apiBase()}/finance/suppliers${qs}`, {
            headers: { ...authHeaders() }
          });
          const data = await readApiData<{ items: SupplierRow[] }>(res);
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

  const totalSuppliers = items?.length ?? 0;
  const activeSuppliers = useMemo(() => items?.filter((item) => item.active).length ?? 0, [items]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form)
      });
      await readApiData<{ error?: string }>(res);
      setForm(EMPTY_FORM);
      setNonce((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create supplier");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-3xl text-slate-950">Suppliers</h2>
        </div>
        <SplitActionButton
          label="New supplier"
          href="#new-supplier"
          items={[
            { label: "New supplier", href: "#new-supplier" },
            { label: "Import suppliers", href: "/dashboard/imports/accounting" }
          ]}
        />
      </div>

      {items ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total suppliers</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{totalSuppliers}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-1 text-2xl font-black text-slate-950">{activeSuppliers}</p>
          </div>
        </section>
      ) : null}

      <form
        id="new-supplier"
        onSubmit={onSubmit}
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <label className="text-sm">
          <span className="text-slate-700">Display name</span>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Caribbean Cleaning Supply"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Company</span>
          <input
            value={form.companyName}
            onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Contact</span>
          <input
            value={form.primaryContact}
            onChange={(e) => setForm((f) => ({ ...f, primaryContact: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
          />
        </label>
        <div className="flex items-end">
          <ActionButton
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Adding…" : "Add supplier"}
          </ActionButton>
        </div>
        {formError ? (
          <p className="md:col-span-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <label className="block max-w-xl flex-1 text-sm">
            <span className="font-semibold text-slate-700">Search suppliers</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, company, email, or phone"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <ActionLink href="/dashboard/imports/accounting" variant="secondary">
              Import from file
            </ActionLink>
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h3 className="font-serif text-2xl text-slate-950">No suppliers yet</h3>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ActionLink href="#new-supplier">Add supplier</ActionLink>
            <ActionLink href="/dashboard/imports/accounting" variant="secondary">
              Import from file
            </ActionLink>
          </div>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${row.displayName}`} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{row.displayName}</p>
                    {row.primaryContact ? <p className="text-xs text-slate-500">{row.primaryContact}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.companyName || <span className="text-slate-400">Not provided</span>}</td>
                  <td className="px-4 py-3 text-slate-700">{row.phone || <span className="text-slate-400">Not provided</span>}</td>
                  <td className="px-4 py-3 text-slate-700">{row.email || <span className="text-slate-400">Not provided</span>}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        row.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link className="font-bold text-[#063E4A] hover:underline" href="/dashboard/finance/bills/new">
                        Create bill
                      </Link>
                      <Link className="font-bold text-[#063E4A] hover:underline" href="/dashboard/finance/bill-payments/new">
                        Record payment
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
