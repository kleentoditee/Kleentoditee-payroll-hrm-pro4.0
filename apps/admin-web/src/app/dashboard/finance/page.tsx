"use client";

import { FinanceBreadcrumbs } from "@/components/finance/breadcrumbs";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type FinanceSummaryResponse = {
  range: { from: string; to: string };
  summary: {
    revenue: number;
    expenses: number;
    netIncome: number;
    cashReceived: number;
    accountsReceivable: number;
    accountsPayable: number;
    activeCustomers: number;
    activeSuppliers: number;
  };
  receivables: Array<{
    id: string;
    number: string;
    name: string;
    dueDate: string | null;
    balance: number;
    overdue: boolean;
  }>;
  payables: Array<{
    id: string;
    number: string;
    name: string;
    dueDate: string | null;
    balance: number;
    overdue: boolean;
  }>;
};

type PaginatedResponse<T> = {
  items: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type PaymentRow = {
  id: string;
  number: string;
  paymentDate: string;
  amount: number;
  method: string;
  customer: { id: string; displayName: string } | null;
};

type InvoiceRow = {
  id: string;
  number: string;
  issueDate: string;
  total: number;
  balance: number;
  status: string;
  customer: { id: string; displayName: string } | null;
};

// BVI uses the US dollar as its official currency.
const moneyFormatter = new Intl.NumberFormat("en-VI", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2
});

function formatMoney(value: number) {
  return moneyFormatter.format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toLocaleDateString("en-VI", { year: "numeric", month: "short", day: "numeric" });
}

type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, { headers: { ...authHeaders() } });
  return readApiData<T>(res);
}

function toErrorState(e: unknown): LoadState<never> {
  return { status: "error", message: e instanceof Error ? e.message : "Failed to load" };
}

const QUICK_ACTIONS = [
  { label: "New invoice", href: "/dashboard/finance/invoices/new" },
  { label: "Receive payment", href: "/dashboard/finance/payments/new" },
  { label: "New bill", href: "/dashboard/finance/bills/new" },
  { label: "Record expense", href: "/dashboard/finance/expenses/new" },
  { label: "New deposit", href: "/dashboard/finance/deposits/new" }
] as const;

function CardError({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
  state
}: {
  label: string;
  value: (data: FinanceSummaryResponse) => number;
  hint: string;
  href: string;
  state: LoadState<FinanceSummaryResponse>;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      {state.status === "loading" ? (
        <p className="mt-2 text-sm text-slate-400">Loading…</p>
      ) : state.status === "error" ? (
        <p className="mt-2 text-sm text-red-700">Couldn’t load</p>
      ) : (
        <>
          <p className="mt-2 font-serif text-2xl text-slate-900">{formatMoney(value(state.data))}</p>
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        </>
      )}
    </Link>
  );
}

export default function FinanceOverviewPage() {
  const [summary, setSummary] = useState<LoadState<FinanceSummaryResponse>>({ status: "loading" });
  const [unreconciled, setUnreconciled] = useState<LoadState<number>>({ status: "loading" });
  const [recentPayments, setRecentPayments] = useState<LoadState<PaymentRow[]>>({ status: "loading" });
  const [recentInvoices, setRecentInvoices] = useState<LoadState<InvoiceRow[]>>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const from = `${now.getFullYear()}-01-01`;
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    loadJson<FinanceSummaryResponse>(`/finance/reports/summary?from=${from}&to=${to}`)
      .then((data) => {
        if (!cancelled) setSummary({ status: "ready", data });
      })
      .catch((e) => {
        if (!cancelled) setSummary(toErrorState(e));
      });

    loadJson<PaginatedResponse<unknown>>(`/finance/banking/lines?page=1&pageSize=1&status=unmatched`)
      .then((data) => {
        if (!cancelled) setUnreconciled({ status: "ready", data: data.pagination.total });
      })
      .catch((e) => {
        if (!cancelled) setUnreconciled(toErrorState(e));
      });

    loadJson<PaginatedResponse<PaymentRow>>(`/finance/payments?page=1&pageSize=5`)
      .then((data) => {
        if (!cancelled) setRecentPayments({ status: "ready", data: data.items });
      })
      .catch((e) => {
        if (!cancelled) setRecentPayments(toErrorState(e));
      });

    loadJson<PaginatedResponse<InvoiceRow>>(`/finance/invoices?page=1&pageSize=5`)
      .then((data) => {
        if (!cancelled) setRecentInvoices({ status: "ready", data: data.items });
      })
      .catch((e) => {
        if (!cancelled) setRecentInvoices(toErrorState(e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const overdueInvoices = useMemo(() => {
    if (summary.status !== "ready") {
      return null;
    }
    const rows = summary.data.receivables.filter((row) => row.overdue);
    return {
      count: rows.length,
      capped: summary.data.receivables.length >= 25 && rows.length === summary.data.receivables.length,
      balance: rows.reduce((sum, row) => sum + row.balance, 0)
    };
  }, [summary]);

  const overdueBills = useMemo(() => {
    if (summary.status !== "ready") {
      return null;
    }
    const rows = summary.data.payables.filter((row) => row.overdue);
    return {
      count: rows.length,
      capped: summary.data.payables.length >= 25 && rows.length === summary.data.payables.length,
      balance: rows.reduce((sum, row) => sum + row.balance, 0)
    };
  }, [summary]);

  const recentActivity = useMemo(() => {
    const entries: Array<{
      id: string;
      kind: "Payment received" | "Invoice";
      number: string;
      party: string;
      date: string;
      amount: number;
      href: string;
    }> = [];
    if (recentPayments.status === "ready") {
      for (const payment of recentPayments.data) {
        entries.push({
          id: `payment-${payment.id}`,
          kind: "Payment received",
          number: payment.number,
          party: payment.customer?.displayName ?? "—",
          date: payment.paymentDate,
          amount: payment.amount,
          href: "/dashboard/finance/payments"
        });
      }
    }
    if (recentInvoices.status === "ready") {
      for (const invoice of recentInvoices.data) {
        entries.push({
          id: `invoice-${invoice.id}`,
          kind: "Invoice",
          number: invoice.number,
          party: invoice.customer?.displayName ?? "—",
          date: invoice.issueDate,
          amount: invoice.total,
          href: "/dashboard/finance/invoices"
        });
      }
    }
    return entries
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 8);
  }, [recentPayments, recentInvoices]);

  const receivablesPreview = summary.status === "ready" ? summary.data.receivables.slice(0, 5) : null;
  const payablesPreview = summary.status === "ready" ? summary.data.payables.slice(0, 5) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <FinanceBreadcrumbs
          items={[{ label: "Finance", href: "/dashboard/finance" }, { label: "Overview" }]}
        />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Finance</p>
            <h2 className="mt-1 font-serif text-2xl text-slate-900">Overview</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="inline-flex min-h-[44px] items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {action.label}
          </Link>
        ))}
      </div>

      {summary.status === "error" ? <CardError message={summary.message} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Accounts receivable"
          value={(d) => d.summary.accountsReceivable}
          hint="Open customer balances"
          href="/dashboard/finance/invoices"
          state={summary}
        />
        <StatCard
          label="Accounts payable"
          value={(d) => d.summary.accountsPayable}
          hint="Open supplier balances"
          href="/dashboard/finance/bills"
          state={summary}
        />
        <StatCard
          label="Net income (YTD)"
          value={(d) => d.summary.netIncome}
          hint="Revenue less expenses"
          href="/dashboard/finance/financial-statements"
          state={summary}
        />
        <StatCard
          label="Cash received (YTD)"
          value={(d) => d.summary.cashReceived}
          hint="Customer payments this year"
          href="/dashboard/finance/payments"
          state={summary}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/dashboard/finance/invoices"
          className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Overdue invoices</p>
          {summary.status === "loading" ? (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          ) : summary.status === "error" ? (
            <p className="mt-2 text-sm text-red-700">Couldn’t load</p>
          ) : overdueInvoices ? (
            <>
              <p className="mt-2 font-serif text-2xl text-slate-900">
                {overdueInvoices.capped ? `${overdueInvoices.count}+` : overdueInvoices.count}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatMoney(overdueInvoices.balance)} past due
              </p>
            </>
          ) : null}
        </Link>
        <Link
          href="/dashboard/finance/bills"
          className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Overdue bills</p>
          {summary.status === "loading" ? (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          ) : summary.status === "error" ? (
            <p className="mt-2 text-sm text-red-700">Couldn’t load</p>
          ) : overdueBills ? (
            <>
              <p className="mt-2 font-serif text-2xl text-slate-900">
                {overdueBills.capped ? `${overdueBills.count}+` : overdueBills.count}
              </p>
              <p className="mt-1 text-xs text-slate-500">{formatMoney(overdueBills.balance)} past due</p>
            </>
          ) : null}
        </Link>
        <Link
          href="/dashboard/finance/reconciliations"
          className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Unreconciled bank lines
          </p>
          {unreconciled.status === "loading" ? (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          ) : unreconciled.status === "error" ? (
            <p className="mt-2 text-sm text-red-700">Couldn’t load</p>
          ) : (
            <>
              <p className="mt-2 font-serif text-2xl text-slate-900">{unreconciled.data}</p>
              <p className="mt-1 text-xs text-slate-500">Imported statement lines awaiting a match</p>
            </>
          )}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="finance-receivables-heading">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id="finance-receivables-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Receivables to chase
            </h3>
            <Link href="/dashboard/finance/aging" className="text-sm font-medium text-brand hover:underline">
              View aging
            </Link>
          </div>
          {summary.status === "loading" ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : summary.status === "error" ? (
            <CardError message={summary.message} />
          ) : receivablesPreview && receivablesPreview.length === 0 ? (
            <p className="text-sm text-slate-600">No open invoices.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {receivablesPreview?.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {row.number} · {row.name}
                    </p>
                    <p className="text-sm text-slate-600">Due {formatDate(row.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.overdue ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        Overdue
                      </span>
                    ) : null}
                    <span className="font-medium text-slate-900">{formatMoney(row.balance)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="finance-payables-heading">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 id="finance-payables-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Upcoming payables
            </h3>
            <Link href="/dashboard/finance/aging" className="text-sm font-medium text-brand hover:underline">
              View aging
            </Link>
          </div>
          {summary.status === "loading" ? (
            <p className="text-sm text-slate-600">Loading…</p>
          ) : summary.status === "error" ? (
            <CardError message={summary.message} />
          ) : payablesPreview && payablesPreview.length === 0 ? (
            <p className="text-sm text-slate-600">No open bills.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
              {payablesPreview?.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">
                      {row.number} · {row.name}
                    </p>
                    <p className="text-sm text-slate-600">Due {formatDate(row.dueDate)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.overdue ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        Overdue
                      </span>
                    ) : null}
                    <span className="font-medium text-slate-900">{formatMoney(row.balance)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-labelledby="finance-activity-heading">
        <h3 id="finance-activity-heading" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent activity
        </h3>
        {recentPayments.status === "error" && recentInvoices.status === "error" ? (
          <CardError message={recentPayments.message} />
        ) : recentPayments.status === "loading" && recentInvoices.status === "loading" ? (
          <p className="text-sm text-slate-600">Loading…</p>
        ) : recentActivity.length === 0 ? (
          <p className="text-sm text-slate-600">No recent invoices or payments.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
            {recentActivity.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    <Link href={entry.href} className="hover:underline">
                      {entry.kind} {entry.number}
                    </Link>
                  </p>
                  <p className="truncate text-sm text-slate-600">
                    {entry.party} · {formatDate(entry.date)}
                  </p>
                </div>
                <span className="font-medium text-slate-900">{formatMoney(entry.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
