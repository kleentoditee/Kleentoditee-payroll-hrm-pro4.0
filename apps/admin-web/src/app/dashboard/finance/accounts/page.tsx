"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import { useEffect, useRef, useState } from "react";

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

const TYPE_BADGE: Record<AccountRow["type"], string> = {
  asset: "bg-sky-100 text-sky-800",
  liability: "bg-rose-100 text-rose-800",
  equity: "bg-violet-100 text-violet-800",
  revenue: "bg-emerald-100 text-emerald-800",
  expense: "bg-amber-100 text-amber-800"
};

const SORT_OPTIONS = [
  { value: "", label: "Account code" },
  { value: "name", label: "Name (A–Z)" },
  { value: "-name", label: "Name (Z–A)" },
  { value: "-code", label: "Code (high–low)" },
  { value: "type", label: "Type" },
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" }
];

const EMPTY_FORM = {
  code: "",
  name: "",
  type: "asset" as AccountRow["type"],
  subtype: "",
  description: ""
};

export default function AccountsListPage() {
  const list = useListQuery(["type", "active"]);
  const typeFilter = list.filter("type");
  const activeFilter = list.filter("active");

  const [items, setItems] = useState<AccountRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/accounts${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: AccountRow[]; pagination: PaginationMeta }>(res);
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

  // Modal accessibility: focus first field on open, trap Tab, close on ESC,
  // and return focus to the Add account button when closed.
  useEffect(() => {
    if (!modalOpen) return;
    const modal = modalRef.current;
    const openButton = openButtonRef.current;
    const firstField = modal?.querySelector<HTMLElement>("input, select, button");
    firstField?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setModalOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !modal.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openButton?.focus();
    };
  }, [modalOpen]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form)
      });
      await readApiData<{ error?: string }>(res);
      setForm(EMPTY_FORM);
      setModalOpen(false);
      setNonce((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  const searching = list.q !== "" || typeFilter !== "" || activeFilter !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Chart of accounts</h2>
        </div>
        <button
          ref={openButtonRef}
          type="button"
          onClick={() => {
            setForm(EMPTY_FORM);
            setFormError(null);
            setModalOpen(true);
          }}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-brand hover:bg-brand-soft focus-visible:ring-2"
        >
          Add account
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search accounts</span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search by code or name"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Type
              <select
                value={typeFilter}
                onChange={(e) => list.setFilter("type", e.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none ring-[#006D77] focus-visible:ring-2"
              >
                <option value="">All types</option>
                {(Object.keys(TYPE_LABEL) as AccountRow["type"][]).map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              Status
              <select
                value={activeFilter}
                onChange={(e) => list.setFilter("active", e.target.value)}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none ring-[#006D77] focus-visible:ring-2"
              >
                <option value="">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </label>
            <SortSelect id="accounts-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
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
          noun="accounts"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h3 className="font-serif text-2xl text-slate-950">No accounts found</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {searching
              ? "No accounts match the current search or filters."
              : "Add your first account to start building the chart of accounts."}
          </p>
        </section>
      ) : null}

      {!error && items && items.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  <span className="text-slate-500">{row.code}</span> &middot; {row.name}
                </p>
                <p className="text-sm text-slate-600">
                  {row.subtype || "—"}
                  {row.description ? ` · ${row.description}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[row.type]}`}>
                  {TYPE_LABEL[row.type]}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    row.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {row.active ? "Active" : "Inactive"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close add account dialog"
            onClick={() => setModalOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-slate-950/40"
            tabIndex={-1}
          />
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-account-title"
            className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="add-account-title" className="font-serif text-xl text-slate-950">
                Add account
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setModalOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xl text-slate-500 outline-none ring-[#006D77] hover:bg-slate-100 focus-visible:ring-2"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <form onSubmit={onSubmit} className="mt-4 grid gap-3">
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
              <label className="text-sm">
                <span className="text-slate-700">Description (optional)</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
                />
              </label>
              {formError ? (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {formError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white outline-none ring-brand hover:bg-brand-soft focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Adding…" : "Add account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
