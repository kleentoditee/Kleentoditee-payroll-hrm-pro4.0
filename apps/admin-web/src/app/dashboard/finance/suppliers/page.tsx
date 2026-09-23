"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { ActionButton, ActionLink, SplitActionButton } from "@/components/ui/action-button";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SupplierRow = {
  id: string;
  displayName: string;
  companyName: string;
  primaryContact: string;
  email: string;
  phone: string;
  active: boolean;
  /** Server aggregate: sum of open/partial bill balances. */
  openBalance?: number;
  /** Server aggregate: count of open/partial bills. */
  billCount?: number;
};

const EMPTY_FORM = {
  displayName: "",
  companyName: "",
  primaryContact: "",
  email: "",
  phone: ""
};

const SORT_OPTIONS = [
  { value: "", label: "Display name (A–Z)" },
  { value: "-displayName", label: "Display name (Z–A)" },
  { value: "companyName", label: "Company (A–Z)" },
  { value: "email", label: "Email (A–Z)" },
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" }
];

const moneyFormatter = new Intl.NumberFormat("en-VI", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function MissingValue() {
  return <span className="text-slate-400">Not provided</span>;
}

export default function SuppliersListPage() {
  const list = useListQuery();
  const [items, setItems] = useState<SupplierRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/suppliers${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: SupplierRow[]; pagination: PaginationMeta }>(res);
        if (seq !== loadSeq.current) return;
        setItems(data.items);
        setPagination(data.pagination);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : "Failed to load");
        setLoading(false);
      }
    })();
  }, [list.queryString, nonce]);

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

  const hasRows = !loading && !error && items !== null && items.length > 0;

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
          <ActionButton type="submit" disabled={submitting}>
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="block max-w-xl flex-1 text-sm">
            <span className="font-semibold text-slate-700">Search suppliers</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search by name, company, or email"
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SortSelect id="suppliers-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
            <ActionLink href="/dashboard/imports/accounting" variant="secondary">
              Import from file
            </ActionLink>
          </div>
        </div>
      </section>

      {pagination || loading || error ? (
        <PaginationControls
          page={list.page}
          pageSize={list.pageSize}
          total={pagination?.total ?? 0}
          loading={loading}
          error={error}
          onRetry={() => setNonce((n) => n + 1)}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          noun="suppliers"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h3 className="font-serif text-2xl text-slate-950">No suppliers yet</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {list.q ? "No suppliers match the current search." : "Add a supplier manually or import from a file."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ActionLink href="#new-supplier">Add supplier</ActionLink>
            <ActionLink href="/dashboard/imports/accounting" variant="secondary">
              Import from file
            </ActionLink>
          </div>
        </section>
      ) : null}

      {hasRows ? (
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
                <th className="px-4 py-3 text-right">Open balance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(items ?? []).map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${row.displayName}`} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{row.displayName}</p>
                    {row.primaryContact ? <p className="text-xs text-slate-500">{row.primaryContact}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.companyName || <MissingValue />}</td>
                  <td className="px-4 py-3 text-slate-700">{row.phone || <MissingValue />}</td>
                  <td className="px-4 py-3 text-slate-700">{row.email || <MissingValue />}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {formatMoney(row.openBalance ?? 0)}
                    {(row.billCount ?? 0) > 0 ? (
                      <span className="block text-xs font-normal text-slate-500">
                        {row.billCount} open bill{row.billCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
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
      ) : null}
    </div>
  );
}
