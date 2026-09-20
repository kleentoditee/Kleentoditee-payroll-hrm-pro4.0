"use client";

import { ActionButton, ActionLink } from "@/components/ui/action-button";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Customer = {
  id: string;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  companyName: string;
  primaryContact: string;
  email: string;
  phone: string;
  billingAddress: string;
  taxId: string;
  notes: string;
  active: boolean;
};

type CustomerSummary = Customer;

type InvoiceRow = {
  id: string;
  customerId: string;
  number: string;
  status: "draft" | "open" | "partial" | "paid" | "void";
  issueDate: string;
  dueDate: string | null;
  memo?: string;
  total: number;
  amountPaid: number;
  balance: number;
};

type PaymentRow = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  amount: number;
  applied: number;
  unapplied: number;
  reference: string;
  memo?: string;
};

type TabKey =
  | "transactions"
  | "details"
  | "notes";

type TransactionRow = {
  id: string;
  date: string;
  type: "Invoice" | "Payment";
  number: string;
  customer: string;
  memo: string;
  status: "Paid" | "Open" | "Overdue" | "Closed" | "Draft";
  dueDate: string | null;
  amount: number;
  balance: number;
  href: string;
  canReceivePayment: boolean;
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "transactions", label: "Transaction List" },
  { key: "details", label: "Customer Details" },
  { key: "notes", label: "Notes" }
];

const statusClass: Record<TransactionRow["status"], string> = {
  Draft: "bg-slate-100 text-slate-700",
  Open: "bg-sky-100 text-sky-800",
  Overdue: "bg-orange-100 text-orange-800",
  Paid: "bg-emerald-100 text-emerald-800",
  Closed: "bg-slate-200 text-slate-700"
};

// BVI uses the US dollar as its official currency.
const moneyFormatter = new Intl.NumberFormat("en-VI", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

const RECENT_CUSTOMERS_KEY = "kleentoditee.recentCustomers";

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "Not provided";
  return new Date(iso).toISOString().slice(0, 10);
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
            : "M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.04Z"
        }
        clipRule="evenodd"
      />
    </svg>
  );
}

function invoiceStatus(invoice: InvoiceRow): TransactionRow["status"] {
  if (invoice.status === "draft") return "Draft";
  if (invoice.status === "paid") return "Paid";
  if (invoice.status === "void") return "Closed";
  if (invoice.dueDate && Number(invoice.balance || 0) > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) return "Overdue";
  }
  return "Open";
}

function paymentStatus(payment: PaymentRow): TransactionRow["status"] {
  return payment.unapplied > 0 ? "Open" : "Closed";
}

function CustomerInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      aria-hidden="true"
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#063E4A] text-lg font-black text-white shadow-sm"
    >
      {initials || "C"}
    </div>
  );
}

function NewTransactionDropdown() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#063E4A] px-4 py-2 text-sm font-bold text-white outline-none ring-[#006D77] hover:bg-[#006D77] focus-visible:ring-2"
      >
        New transaction
        <ChevronIcon direction={open ? "up" : "down"} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="New transaction actions"
          className="absolute right-0 top-full z-30 mt-2 w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl"
        >
          <Link
            href="/dashboard/finance/invoices/new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
          >
            Create invoice
          </Link>
          <Link
            href="/dashboard/finance/payments/new"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
          >
            Receive payment
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [allInvoices, setAllInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [recentCustomerIds, setRecentCustomerIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("transactions");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(searchParams.get("edit") === "1");
  const [editForm, setEditForm] = useState<Omit<Customer, "id" | "createdAt" | "updatedAt"> | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [customerRes, customersRes, invoiceRes, paymentRes] = await Promise.all([
          fetch(`${apiBase()}/finance/customers/${id}`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/customers`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/invoices`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/finance/payments?customerId=${encodeURIComponent(id)}`, {
            headers: { ...authHeaders() }
          })
        ]);
        const [customerData, customersData, invoiceData, paymentData] = await Promise.all([
          readApiData<{ customer: Customer }>(customerRes),
          readApiData<{ items: CustomerSummary[] }>(customersRes),
          readApiData<{ items: InvoiceRow[] }>(invoiceRes),
          readApiData<{ items: PaymentRow[] }>(paymentRes)
        ]);
        if (!cancelled) {
          setCustomer(customerData.customer);
          setEditForm({
            displayName: customerData.customer.displayName,
            companyName: customerData.customer.companyName,
            primaryContact: customerData.customer.primaryContact,
            email: customerData.customer.email,
            phone: customerData.customer.phone,
            billingAddress: customerData.customer.billingAddress,
            taxId: customerData.customer.taxId,
            notes: customerData.customer.notes,
            active: customerData.customer.active
          });
          setCustomers(customersData.items ?? []);
          setAllInvoices(invoiceData.items ?? []);
          setInvoices((invoiceData.items ?? []).filter((invoice) => invoice.customerId === id));
          setPayments(paymentData.items ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load customer");
          setCustomer(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_CUSTOMERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentCustomerIds(parsed.filter((value): value is string => typeof value === "string"));
        }
      }
    } catch {
      setRecentCustomerIds([]);
    }
  }, []);

  useEffect(() => {
    if (!customer) return;
    setRecentCustomerIds((current) => {
      const next = [customer.id, ...current.filter((item) => item !== customer.id)].slice(0, 8);
      window.localStorage.setItem(RECENT_CUSTOMERS_KEY, JSON.stringify(next));
      return next;
    });
  }, [customer]);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-transaction-action-root]")) return;
      setOpenActionMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenActionMenuId(null);
    }
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const openBalance = useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.status === "open" || invoice.status === "partial")
        .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0),
    [invoices]
  );

  const overdueBalance = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return invoices
      .filter((invoice) => {
        if (!invoice.dueDate || Number(invoice.balance || 0) <= 0) return false;
        return new Date(invoice.dueDate) < today;
      })
      .reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  }, [invoices]);

  const totalPaid = useMemo(
    () => payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [payments]
  );

  const balanceByCustomer = useMemo(() => {
    const map = new Map<string, number>();
    for (const invoice of allInvoices) {
      if (invoice.status !== "open" && invoice.status !== "partial") continue;
      map.set(invoice.customerId, (map.get(invoice.customerId) ?? 0) + Number(invoice.balance || 0));
    }
    return map;
  }, [allInvoices]);

  const searchedCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((item) =>
      [item.displayName, item.companyName, item.primaryContact, item.email, item.phone, item.billingAddress]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [customerSearch, customers]);

  const recentCustomers = useMemo(
    () =>
      recentCustomerIds
        .map((recentId) => customers.find((item) => item.id === recentId))
        .filter((item): item is CustomerSummary => Boolean(item)),
    [customers, recentCustomerIds]
  );

  const transactions = useMemo<TransactionRow[]>(() => {
    const invoiceRows: TransactionRow[] = invoices.map((invoice) => ({
      id: invoice.id,
      date: invoice.issueDate,
      type: "Invoice",
      number: invoice.number,
      customer: customer?.displayName ?? "",
      memo: invoice.memo ?? "",
      dueDate: invoice.dueDate,
      amount: invoice.total,
      balance: invoice.balance,
      status: invoiceStatus(invoice),
      href: `/dashboard/finance/invoices/${invoice.id}`,
      canReceivePayment: invoice.status === "open" || invoice.status === "partial"
    }));
    const paymentRows: TransactionRow[] = payments.map((payment) => ({
      id: payment.id,
      date: payment.paymentDate,
      type: "Payment",
      number: payment.number,
      customer: customer?.displayName ?? "",
      memo: payment.memo || payment.reference || "",
      status: paymentStatus(payment),
      dueDate: null,
      amount: payment.amount,
      balance: payment.unapplied,
      href: `/dashboard/finance/payments/${payment.id}`,
      canReceivePayment: false
    }));
    return [...invoiceRows, ...paymentRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customer?.displayName, invoices, payments]);

  async function saveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) return;
    setSavingCustomer(true);
    setEditError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(editForm)
      });
      const data = await readApiData<{ customer: Customer }>(res);
      setCustomer(data.customer);
      setEditForm({
        displayName: data.customer.displayName,
        companyName: data.customer.companyName,
        primaryContact: data.customer.primaryContact,
        email: data.customer.email,
        phone: data.customer.phone,
        billingAddress: data.customer.billingAddress,
        taxId: data.customer.taxId,
        notes: data.customer.notes,
        active: data.customer.active
      });
      setCustomers((current) => current.map((item) => (item.id === data.customer.id ? data.customer : item)));
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not save customer");
    } finally {
      setSavingCustomer(false);
    }
  }

  if (error) {
    return <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>;
  }

  if (!customer) {
    return <p className="text-sm text-slate-600">Loading customer...</p>;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
        <Link
          href="/dashboard/finance/customers"
          className="inline-flex rounded text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:underline focus-visible:ring-2"
        >
          Back to Customers
        </Link>
        <label className="block text-sm">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Search by name or details</span>
          <input
            type="search"
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Search customers"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
          />
        </label>

        {recentCustomers.length > 0 ? (
          <section aria-label="Recently viewed customers">
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recently viewed</h3>
            <div className="mt-2 space-y-1">
              {recentCustomers.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/finance/customers/${item.id}`}
                  aria-current={item.id === customer.id ? "page" : undefined}
                  className={`block rounded-xl border px-3 py-2 outline-none ring-[#006D77] focus-visible:ring-2 ${
                    item.id === customer.id
                      ? "border-[#006D77]/35 bg-[#EAF6F7]"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className="block truncate text-sm font-bold text-slate-950">{item.displayName}</span>
                  <span className="block text-xs font-semibold text-slate-500">
                    {formatMoney(balanceByCustomer.get(item.id) ?? 0)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Customer list">
          <h3 className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Customers</h3>
          <div className="mt-2 space-y-1">
            {searchedCustomers.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No customers match your search.</p>
            ) : (
              searchedCustomers.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/finance/customers/${item.id}`}
                  aria-current={item.id === customer.id ? "page" : undefined}
                  className={`block rounded-xl border px-3 py-2 outline-none ring-[#006D77] focus-visible:ring-2 ${
                    item.id === customer.id
                      ? "border-[#006D77]/35 bg-[#EAF6F7]"
                      : "border-transparent hover:bg-slate-50"
                  }`}
                >
                  <span className="block truncate text-sm font-bold text-slate-950">{item.displayName}</span>
                  <span className="block text-xs text-slate-500">{item.companyName || "Not provided"}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-700">
                    Balance {formatMoney(balanceByCustomer.get(item.id) ?? 0)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </section>
      </aside>

      <main className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer Hub</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{customer.displayName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton type="button" variant="secondary" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close edit" : "Edit customer"}
          </ActionButton>
          <NewTransactionDropdown />
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <CustomerInitials name={customer.displayName} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Customer profile</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold text-slate-950">{customer.displayName}</h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    customer.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {customer.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600">{customer.companyName || <MissingValue />}</p>
            </div>
          </div>

          {editing && editForm ? (
            <form onSubmit={saveCustomer} className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Display name</span>
                <input
                  required
                  value={editForm.displayName}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, displayName: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Company</span>
                <input
                  value={editForm.companyName}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, companyName: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Primary contact</span>
                <input
                  value={editForm.primaryContact}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, primaryContact: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, email: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Phone</span>
                <input
                  value={editForm.phone}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, phone: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-slate-700">Tax ID</span>
                <input
                  value={editForm.taxId}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, taxId: event.target.value } : form))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="font-semibold text-slate-700">Billing address</span>
                <textarea
                  value={editForm.billingAddress}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, billingAddress: event.target.value } : form))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <span className="font-semibold text-slate-700">Notes</span>
                <textarea
                  value={editForm.notes}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, notes: event.target.value } : form))}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.active}
                  onChange={(event) => setEditForm((form) => (form ? { ...form, active: event.target.checked } : form))}
                  className="rounded border-slate-300 text-[#108000] focus:ring-[#006D77]"
                />
                Active customer
              </label>
              <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
                {editError ? <p className="mr-auto text-sm font-semibold text-red-700">{editError}</p> : null}
                <ActionButton type="button" variant="secondary" onClick={() => setEditing(false)}>
                  Cancel
                </ActionButton>
                <ActionButton type="submit" disabled={savingCustomer}>
                  {savingCustomer ? "Saving..." : "Save customer"}
                </ActionButton>
              </div>
            </form>
          ) : null}

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{customer.email || <MissingValue />}</dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Phone</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                {customer.phone || <span className="text-[#006D77]">Add phone number</span>}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Billing address</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                {customer.billingAddress || <MissingValue />}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Shipping address</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">
                <MissingValue />
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 md:col-span-2">
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">
                {customer.notes || <MissingValue />}
              </dd>
            </div>
          </dl>
        </div>

        <aside className="rounded-2xl border border-[#006D77]/20 bg-[#EAF6F7] p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#006D77]">Financial summary</p>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-sm font-semibold text-[#063E4A]/80">Open balance</dt>
              <dd className="mt-1 text-3xl font-black text-[#063E4A]">{formatMoney(openBalance)}</dd>
            </div>
            <div className="border-t border-[#006D77]/15 pt-4">
              <dt className="text-sm font-semibold text-[#063E4A]/80">Overdue payment</dt>
              <dd className="mt-1 text-xl font-black text-[#063E4A]">{formatMoney(overdueBalance)}</dd>
            </div>
            <div className="border-t border-[#006D77]/15 pt-4">
              <dt className="text-sm font-semibold text-[#063E4A]/80">Total paid</dt>
              <dd className="mt-1 text-xl font-black text-[#063E4A]">{formatMoney(totalPaid)}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <div className="overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Customer profile sections">
        <div className="flex min-w-max gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px border-b-2 px-1 pb-3 text-sm font-bold outline-none ring-[#006D77] focus-visible:ring-2 ${
                activeTab === tab.key
                  ? "border-[#108000] text-[#063E4A]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "transactions" ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-3 p-3 md:hidden">
            {transactions.length === 0 ? (
              <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                <p>No transactions yet for this customer.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <ActionLink href="/dashboard/finance/invoices/new">Create invoice</ActionLink>
                  <ActionLink href="/dashboard/finance/payments/new" variant="secondary">
                    Receive payment
                  </ActionLink>
                </div>
              </div>
            ) : (
              transactions.map((row) => (
                <article key={`${row.type}-${row.id}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{row.type}</p>
                      <Link href={row.href} className="mt-1 block font-bold text-slate-950 outline-none ring-[#006D77] hover:text-brand focus-visible:ring-2">
                        {row.number}
                      </Link>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass[row.status]}`}>
                      {row.status}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Date</dt>
                      <dd className="font-semibold text-slate-900">{formatDate(row.date)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Due date</dt>
                      <dd className="font-semibold text-slate-900">{row.dueDate ? formatDate(row.dueDate) : <MissingValue />}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="font-semibold text-slate-900">{formatMoney(row.amount)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-slate-500">Balance</dt>
                      <dd className="font-semibold text-slate-900">{formatMoney(row.balance)}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={row.href}
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                    >
                      View
                    </Link>
                    {row.canReceivePayment ? (
                      <Link
                        href="/dashboard/finance/payments/new"
                        className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 outline-none ring-[#006D77] hover:bg-slate-50 focus-visible:ring-2"
                      >
                        Receive payment
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto pb-40 md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">No.</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Memo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    <p>No transactions yet for this customer.</p>
                    <div className="mt-4 flex justify-center gap-2">
                      <ActionLink href="/dashboard/finance/invoices/new">Create invoice</ActionLink>
                      <ActionLink href="/dashboard/finance/payments/new" variant="secondary">
                        Receive payment
                      </ActionLink>
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-700">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{row.type}</td>
                    <td className="px-4 py-3 text-slate-700">{row.number}</td>
                    <td className="px-4 py-3 text-slate-700">{row.customer || <MissingValue />}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3 text-slate-700">{row.memo || <MissingValue />}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClass[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatMoney(row.balance)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-flex rounded-lg border border-slate-300 bg-white" data-transaction-action-root>
                        <Link
                          href={row.href}
                          className="px-3 py-1.5 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                        >
                          View
                        </Link>
                        <button
                          type="button"
                          aria-label={`More actions for ${row.type} ${row.number}`}
                          aria-haspopup="menu"
                          aria-expanded={openActionMenuId === `${row.type}-${row.id}`}
                          onClick={() =>
                            setOpenActionMenuId((current) =>
                              current === `${row.type}-${row.id}` ? null : `${row.type}-${row.id}`
                            )
                          }
                          className="inline-flex items-center gap-1 border-l border-slate-300 px-2 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2"
                        >
                          More
                          <ChevronIcon direction={openActionMenuId === `${row.type}-${row.id}` ? "up" : "down"} />
                        </button>
                        {openActionMenuId === `${row.type}-${row.id}` ? (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-20 mt-2 min-w-52 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl"
                          >
                            <Link
                              href={row.href}
                              role="menuitem"
                              className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                              onClick={() => setOpenActionMenuId(null)}
                            >
                              View
                            </Link>
                            {row.canReceivePayment ? (
                              <Link
                                href="/dashboard/finance/payments/new"
                                role="menuitem"
                                className="block px-3 py-2 text-sm font-semibold text-slate-700 outline-none ring-inset ring-[#006D77] hover:bg-[#EAF6F7] hover:text-[#063E4A] focus-visible:ring-2"
                                onClick={() => setOpenActionMenuId(null)}
                              >
                                Receive payment
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </section>
      ) : null}

      {activeTab === "details" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Customer Details</h3>
          <dl className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Primary contact</dt>
              <dd className="mt-1 text-sm text-slate-900">{customer.primaryContact || <MissingValue />}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Tax ID</dt>
              <dd className="mt-1 text-sm text-slate-900">{customer.taxId || <MissingValue />}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Created</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDate(customer.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Last updated</dt>
              <dd className="mt-1 text-sm text-slate-900">{formatDate(customer.updatedAt)}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {activeTab === "notes" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-950">Notes</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{customer.notes || "No notes saved for this customer."}</p>
        </section>
      ) : null}

      </main>
    </div>
  );
}
