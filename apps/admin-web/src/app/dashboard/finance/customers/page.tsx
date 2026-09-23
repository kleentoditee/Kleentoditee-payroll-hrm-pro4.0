"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { ActionButton, ActionLink, SplitActionButton } from "@/components/ui/action-button";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type CustomerRow = {
  id: string;
  createdAt?: string;
  displayName: string;
  companyName: string;
  primaryContact: string;
  email: string;
  phone: string;
  billingAddress?: string;
  active: boolean;
  /** Server aggregate: sum of open/partial invoice balances. */
  openBalance?: number;
  /** Server aggregate: count of open/partial invoices. */
  invoiceCount?: number;
};

type CustomerOverviewSummary = {
  totalOpenBalance: number;
  openInvoiceCount: number;
  overdueCount: number;
  overdueBalance: number;
  recentlyPaidTotal: number;
};

type ColumnKey =
  | "companyName"
  | "billingAddress"
  | "phone"
  | "mobile"
  | "email"
  | "attachments"
  | "openBalance"
  | "status";

const EMPTY_FORM = {
  displayName: "",
  companyName: "",
  primaryContact: "",
  email: "",
  phone: ""
};

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  companyName: true,
  billingAddress: false,
  phone: true,
  mobile: false,
  email: true,
  attachments: false,
  openBalance: true,
  status: true
};

const COLUMN_LABELS: Array<{ key: ColumnKey; label: string }> = [
  { key: "companyName", label: "Company name" },
  { key: "billingAddress", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "mobile", label: "Mobile" },
  { key: "email", label: "Email" },
  { key: "attachments", label: "Attachments" },
  { key: "openBalance", label: "Open balance" },
  { key: "status", label: "Status" }
];

const SORT_OPTIONS = [
  { value: "", label: "Display name (A–Z)" },
  { value: "-displayName", label: "Display name (Z–A)" },
  { value: "companyName", label: "Company (A–Z)" },
  { value: "email", label: "Email (A–Z)" },
  { value: "-createdAt", label: "Newest first" },
  { value: "createdAt", label: "Oldest first" }
];

// BVI uses the US dollar as its official currency.
const moneyFormatter = new Intl.NumberFormat("en-VI", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function MissingValue() {
  return <span className="text-slate-400">Not provided</span>;
}

function ChevronIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
      <path
        fillRule="evenodd"
        d={
          direction === "up"
            ? "M14.77 12.79a.75.75 0 0 1-1.06-.02L10 8.83l-3.71 3.94a.75.75 0 1 1-1.1-1.02l4.25-4.5a.75.75 0 0 1 1.1 0l4.25 4.5a.75.75 0 0 1-.02 1.04Z"
            : "M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1 1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.04Z"
        }
        clipRule="evenodd"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M6 7V3h8v4M6 15H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <path d="M6 12h8v5H6z" />
      <path d="M15 10h.01" strokeLinecap="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10 13V3" strokeLinecap="round" />
      <path d="m6.5 6.5 3.5-3.5 3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 11v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8.3 2.8h3.4l.5 2a6.7 6.7 0 0 1 1.5.9l1.9-.7 1.7 3-1.5 1.3a6 6 0 0 1 0 1.8l1.5 1.3-1.7 3-1.9-.7a6.7 6.7 0 0 1-1.5.9l-.5 2H8.3l-.5-2a6.7 6.7 0 0 1-1.5-.9l-1.9.7-1.7-3 1.5-1.3a6 6 0 0 1 0-1.8L2.7 8l1.7-3 1.9.7a6.7 6.7 0 0 1-1.5-.9l.5-2Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

export default function CustomersListPage() {
  const list = useListQuery();
  const [items, setItems] = useState<CustomerRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [updatingCustomerId, setUpdatingCustomerId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CustomerOverviewSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const loadSeq = useRef(0);
  const summarySeq = useRef(0);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/customers${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: CustomerRow[]; pagination: PaginationMeta }>(res);
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

  useEffect(() => {
    const seq = ++summarySeq.current;
    setSummaryLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/customers/summary`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ summary: CustomerOverviewSummary }>(res);
        if (seq !== summarySeq.current) return;
        setSummary(data.summary);
        setSummaryError(null);
      } catch (e) {
        if (seq !== summarySeq.current) return;
        setSummaryError(e instanceof Error ? e.message : "Failed to load customer summary");
      } finally {
        if (seq === summarySeq.current) setSummaryLoading(false);
      }
    })();
  }, [nonce]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-row-menu-root]")) return;
      if (settingsRef.current?.contains(target as Node)) return;
      setOpenRowMenuId(null);
      setSettingsOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenRowMenuId(null);
        setSettingsOpen(false);
      }
    }
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/customers`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form)
      });
      await readApiData<{ error?: string }>(res);
      setForm(EMPTY_FORM);
      setNonce((n) => n + 1);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create customer");
    } finally {
      setSubmitting(false);
    }
  }

  async function setCustomerActive(row: CustomerRow, active: boolean) {
    setUpdatingCustomerId(row.id);
    setOpenRowMenuId(null);
    try {
      const res = await fetch(`${apiBase()}/finance/customers/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ active })
      });
      const data = await readApiData<{ customer: CustomerRow }>(res);
      setItems((current) =>
        current?.map((item) => (item.id === row.id ? { ...item, ...data.customer } : item)) ?? current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update customer");
    } finally {
      setUpdatingCustomerId(null);
    }
  }

  // Exports the currently displayed page (server-paginated list).
  function exportCustomers() {
    downloadCsv("kleentoditee-customers.csv", [
      ["Display name", "Company", "Primary contact", "Email", "Phone", "Billing address", "Status", "Open balance"],
      ...(items ?? []).map((customer) => [
        customer.displayName,
        customer.companyName,
        customer.primaryContact,
        customer.email,
        customer.phone,
        customer.billingAddress ?? "",
        customer.active ? "Active" : "Inactive",
        (customer.openBalance ?? 0).toFixed(2)
      ])
    ]);
  }

  function downloadCustomerTemplate() {
    downloadCsv("kleentoditee-customer-template.csv", [
      ["Display name", "Company", "Primary contact", "Email", "Phone", "Billing address", "Tax ID", "Notes"]
    ]);
  }

  function toggleColumn(key: ColumnKey) {
    setColumns((current) => ({ ...current, [key]: !current[key] }));
  }

  const total = pagination?.total ?? 0;
  const hasRows = !loading && !error && items !== null && items.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
          <h2 className="mt-1 text-3xl font-bold text-slate-950">Customers</h2>
        </div>
        <SplitActionButton
          label="New customer"
          href="#new-customer"
          items={[
            { label: "New customer", href: "#new-customer" },
            { label: "Import customers from file", href: "/dashboard/imports/accounting" },
            { label: "Export customers", onSelect: exportCustomers },
            { label: "Download customer template", onSelect: downloadCustomerTemplate }
          ]}
        />
      </div>

      <section aria-label="Customer account summary" aria-busy={summaryLoading}>
        {summaryError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <span>Customer totals are temporarily unavailable. {summaryError}</span>
            <button
              type="button"
              onClick={() => setNonce((value) => value + 1)}
              className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 py-2 font-bold outline-none ring-[#006D77] hover:bg-amber-100 focus-visible:ring-2"
            >
              Retry
            </button>
          </div>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-sm font-semibold text-slate-600">Outstanding invoices</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">
                {summaryLoading || !summary ? "Loading…" : formatMoney(summary.totalOpenBalance)}
              </dd>
              {!summaryLoading && summary ? (
                <p className="mt-1 text-xs text-slate-500">
                  {summary.openInvoiceCount} open invoice{summary.openInvoiceCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-sm font-semibold text-slate-600">Overdue invoices</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">
                {summaryLoading || !summary ? "Loading…" : formatMoney(summary.overdueBalance)}
              </dd>
              {!summaryLoading && summary ? (
                <p className="mt-1 text-xs text-slate-500">
                  {summary.overdueCount} overdue invoice{summary.overdueCount === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <dt className="text-sm font-semibold text-slate-600">Payments received</dt>
              <dd className="mt-1 text-2xl font-bold text-slate-950">
                {summaryLoading || !summary ? "Loading…" : formatMoney(summary.recentlyPaidTotal)}
              </dd>
              <p className="mt-1 text-xs text-slate-500">Last 30 days</p>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block max-w-sm flex-1 text-sm">
            <span className="sr-only">Search customers</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.target.value)}
              placeholder="Search"
              className="min-h-11 w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 outline-none ring-[#006D77] focus:ring-2"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <SortSelect id="customers-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
            <button
              type="button"
              aria-label="Print customer list"
              onClick={() => window.print()}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
            >
              <PrintIcon />
            </button>
            <button
              type="button"
              aria-label="Export customers"
              onClick={exportCustomers}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
            >
              <ExportIcon />
            </button>
            <div ref={settingsRef} className="relative">
              <button
                type="button"
                aria-label="Customer table settings"
                aria-haspopup="dialog"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
              >
                <GearIcon />
              </button>
              {settingsOpen ? (
                <div
                  role="dialog"
                  aria-label="Customer table settings"
                  className="absolute right-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl"
                >
                  <p className="font-bold text-slate-950">Columns</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {COLUMN_LABELS.map((column) => (
                      <label key={column.key} className="flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={columns[column.key]}
                          onChange={() => toggleColumn(column.key)}
                          className="rounded border-slate-300 text-[#108000] focus:ring-[#006D77]"
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {pagination || loading || error ? (
        <PaginationControls
          page={list.page}
          pageSize={list.pageSize}
          total={total}
          loading={loading}
          error={error}
          onRetry={() => setNonce((n) => n + 1)}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          noun="customers"
        />
      ) : null}

      {!loading && !error && items !== null && items.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h3 className="font-serif text-2xl text-slate-950">No customers yet</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            {list.q
              ? "No customers match the current search."
              : "Add a customer manually or import a customer list from an accounting export file."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <ActionLink href="#new-customer">Add customer</ActionLink>
            <ActionLink href="/dashboard/imports/accounting" variant="secondary">
              Import from file
            </ActionLink>
          </div>
        </section>
      ) : null}

      {hasRows ? (
        <div className="space-y-3 md:hidden">
          {(items ?? []).map((row) => {
            const openBalance = row.openBalance ?? 0;
            const primaryAction =
              openBalance > 0
                ? { label: "Receive payment", href: "/dashboard/finance/payments/new" }
                : { label: "Create invoice", href: "/dashboard/finance/invoices/new" };
            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/finance/customers/${row.id}`}
                      className="font-bold text-slate-950 outline-none ring-[#006D77] hover:text-[#063E4A] hover:underline focus-visible:ring-2"
                    >
                      {row.displayName || <MissingValue />}
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">{row.companyName || <MissingValue />}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                      row.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Phone</dt>
                    <dd className="text-right font-semibold text-slate-900">{row.phone || <MissingValue />}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Email</dt>
                    <dd className="max-w-[13rem] truncate text-right font-semibold text-slate-900">
                      {row.email || <MissingValue />}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500">Open balance</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatMoney(openBalance)}
                      {(row.invoiceCount ?? 0) > 0 ? (
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          ({row.invoiceCount} open)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={primaryAction.href}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                  >
                    {primaryAction.label}
                  </Link>
                  <Link
                    href={`/dashboard/finance/customers/${row.id}`}
                    className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
                  >
                    View customer
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {hasRows ? (
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-4 py-3">Name</th>
                {columns.companyName ? <th className="px-4 py-3">Company name</th> : null}
                {columns.billingAddress ? <th className="px-4 py-3">Address</th> : null}
                {columns.phone ? <th className="px-4 py-3">Phone</th> : null}
                {columns.mobile ? <th className="px-4 py-3">Mobile</th> : null}
                {columns.email ? <th className="px-4 py-3">Email</th> : null}
                {columns.attachments ? <th className="px-4 py-3">Attachments</th> : null}
                {columns.openBalance ? <th className="px-4 py-3 text-right">Open balance</th> : null}
                {columns.status ? <th className="px-4 py-3">Status</th> : null}
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(items ?? []).map((row) => {
                const openBalance = row.openBalance ?? 0;
                const primaryAction =
                  openBalance > 0
                    ? { label: "Receive payment", href: "/dashboard/finance/payments/new" }
                    : { label: "Create invoice", href: "/dashboard/finance/invoices/new" };
                return (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <input type="checkbox" aria-label={`Select ${row.displayName}`} className="rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/dashboard/finance/customers/${row.id}`}
                        className="font-bold text-slate-950 outline-none ring-[#006D77] hover:text-[#063E4A] hover:underline focus-visible:ring-2"
                      >
                        {row.displayName || <MissingValue />}
                      </Link>
                      {row.primaryContact ? <p className="text-xs text-slate-500">{row.primaryContact}</p> : null}
                    </td>
                    {columns.companyName ? (
                      <td className="px-4 py-2.5 text-slate-700">{row.companyName || <MissingValue />}</td>
                    ) : null}
                    {columns.billingAddress ? (
                      <td className="max-w-xs px-4 py-2.5 text-slate-700">{row.billingAddress || <MissingValue />}</td>
                    ) : null}
                    {columns.phone ? <td className="px-4 py-2.5 text-slate-700">{row.phone || <MissingValue />}</td> : null}
                    {columns.mobile ? (
                      <td className="px-4 py-2.5 text-slate-700">
                        <MissingValue />
                      </td>
                    ) : null}
                    {columns.email ? <td className="px-4 py-2.5 text-slate-700">{row.email || <MissingValue />}</td> : null}
                    {columns.attachments ? (
                      <td className="px-4 py-2.5 text-slate-700">
                        <MissingValue />
                      </td>
                    ) : null}
                    {columns.openBalance ? (
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {formatMoney(openBalance)}
                        {(row.invoiceCount ?? 0) > 0 ? (
                          <span className="block text-xs font-normal text-slate-500">
                            {row.invoiceCount} open invoice{row.invoiceCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.status ? (
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            row.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <div className="relative inline-flex rounded-lg border border-slate-300 bg-white" data-row-menu-root>
                          <Link
                            href={primaryAction.href}
                            className="px-3 py-1.5 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                          >
                            {primaryAction.label}
                          </Link>
                          <button
                            type="button"
                            aria-label={`More actions for ${row.displayName}`}
                            aria-haspopup="menu"
                            aria-expanded={openRowMenuId === row.id}
                            onClick={() => setOpenRowMenuId((current) => (current === row.id ? null : row.id))}
                            className="inline-flex items-center gap-1 border-l border-slate-300 px-2 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                          >
                            More
                            <ChevronIcon direction={openRowMenuId === row.id ? "up" : "down"} />
                          </button>
                          {openRowMenuId === row.id ? (
                            <div
                              role="menu"
                              className="absolute right-0 top-full z-20 mt-2 min-w-52 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl"
                            >
                              <Link
                                href={`/dashboard/finance/customers/${row.id}`}
                                role="menuitem"
                                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                                onClick={() => setOpenRowMenuId(null)}
                              >
                                View customer
                              </Link>
                              <Link
                                href={`/dashboard/finance/customers/${row.id}?edit=1`}
                                role="menuitem"
                                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                                onClick={() => setOpenRowMenuId(null)}
                              >
                                Edit customer
                              </Link>
                              <Link
                                href="/dashboard/finance/invoices/new"
                                role="menuitem"
                                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                                onClick={() => setOpenRowMenuId(null)}
                              >
                                Create invoice
                              </Link>
                              <Link
                                href="/dashboard/finance/payments/new"
                                role="menuitem"
                                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                                onClick={() => setOpenRowMenuId(null)}
                              >
                                Receive payment
                              </Link>
                              <button
                                type="button"
                                role="menuitem"
                                disabled={updatingCustomerId === row.id}
                                onClick={() => void setCustomerActive(row, !row.active)}
                                className="block w-full px-3 py-2 text-left text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2 disabled:cursor-wait disabled:text-slate-400 disabled:hover:bg-white"
                              >
                                {row.active ? "Make inactive" : "Make active"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <form
        id="new-customer"
        onSubmit={onSubmit}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
      >
        <label className="text-sm">
          <span className="text-slate-700">Display name</span>
          <input
            required
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
            placeholder="Tortola Bay Resort"
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
            {submitting ? "Adding..." : "Add customer"}
          </ActionButton>
        </div>
        {formError ? (
          <p className="md:col-span-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {formError}
          </p>
        ) : null}
      </form>
    </div>
  );
}
