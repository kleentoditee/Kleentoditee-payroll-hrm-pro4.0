"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type BalanceRow = {
  id: string;
  number: string;
  name: string;
  dueDate: string | null;
  balance: number;
  overdue: boolean;
};

type ReportData = {
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
  monthly: { month: string; revenue: number; expenses: number; net: number }[];
  topCustomers: { id: string; name: string; total: number }[];
  receivables: BalanceRow[];
  payables: BalanceRow[];
};

function ymd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ReportsHomePage() {
  const today = new Date();
  const [from, setFrom] = useState(`${today.getFullYear()}-01-01`);
  const [to, setTo] = useState(ymd(today));
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/reports/summary?from=${from}&to=${to}`, {
        headers: { ...authHeaders() }
      });
      const report = await readApiData<ReportData>(res, "Could not load reports.");
      if (seq !== loadSeq.current) return; // a newer load superseded this one
      setData(report);
    } catch (e) {
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : "Could not load reports.");
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = data
    ? [
        ["Revenue", currency(data.summary.revenue)],
        ["Expenses", currency(data.summary.expenses)],
        ["Net income", currency(data.summary.netIncome)],
        ["Cash received", currency(data.summary.cashReceived)],
        ["Accounts receivable", currency(data.summary.accountsReceivable)],
        ["Accounts payable", currency(data.summary.accountsPayable)]
      ]
    : [];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Reports</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-slate-900">Business performance</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          <button type="button" onClick={() => void load()} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Refresh</button>
          <button
            type="button"
            disabled={!data}
            onClick={() => data && downloadCsv(`kleentoditee-report-${from}-to-${to}.csv`, [
              ["Month", "Revenue", "Expenses", "Net income"],
              ...data.monthly.map((row) => [row.month, row.revenue, row.expenses, row.net])
            ])}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </header>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading && !data ? <p className="text-sm text-slate-600">Loading report...</p> : null}

      {data ? (
        <>
          <section className="grid border-y border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-6">
            {metrics.map(([label, value]) => (
              <div key={label} className="border-b border-slate-200 px-4 py-4 last:border-b-0 sm:border-r xl:border-b-0">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-900">Monthly profit and loss</h2>
            <div className="mt-3 overflow-x-auto border-y border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Expenses</th><th className="px-4 py-3 text-right">Net income</th></tr>
                </thead>
                <tbody>
                  {data.monthly.length ? data.monthly.map((row) => (
                    <tr key={row.month} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{row.month}</td>
                      <td className="px-4 py-3 text-right">{currency(row.revenue)}</td>
                      <td className="px-4 py-3 text-right">{currency(row.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${row.net < 0 ? "text-red-700" : "text-emerald-700"}`}>{currency(row.net)}</td>
                    </tr>
                  )) : <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">No posted transactions in this date range.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-7 xl:grid-cols-2">
            <OpenBalanceTable title="Customer balances" empty="No open customer balances." rows={data.receivables} basePath="/dashboard/finance/invoices" />
            <OpenBalanceTable title="Supplier balances" empty="No open supplier balances." rows={data.payables} basePath="/dashboard/finance/bills" />
          </div>

          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Top customers</h2>
              <span className="text-xs text-slate-500">{data.summary.activeCustomers} active customers</span>
            </div>
            <div className="mt-3 divide-y divide-slate-100 border-y border-slate-200 bg-white">
              {data.topCustomers.length ? data.topCustomers.map((customer) => (
                <Link key={customer.id} href={`/dashboard/finance/customers/${customer.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50">
                  <span className="font-medium text-slate-800">{customer.name}</span>
                  <span className="font-semibold text-slate-950">{currency(customer.total)}</span>
                </Link>
              )) : <p className="px-4 py-6 text-center text-sm text-slate-500">No customer activity in this date range.</p>}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function OpenBalanceTable({ title, empty, rows, basePath }: { title: string; empty: string; rows: BalanceRow[]; basePath: string }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 divide-y divide-slate-100 border-y border-slate-200 bg-white">
        {rows.length ? rows.map((row) => (
          <Link key={row.id} href={`${basePath}/${row.id}`} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-3 text-sm hover:bg-slate-50">
            <span><span className="font-medium text-slate-900">{row.name}</span><span className="ml-2 text-slate-500">{row.number}</span>{row.overdue ? <span className="ml-2 font-semibold text-red-700">Overdue</span> : null}</span>
            <span className="font-semibold text-slate-950">{currency(row.balance)}</span>
            <span className="text-xs text-slate-500">Due {row.dueDate ? row.dueDate.slice(0, 10) : "not set"}</span>
          </Link>
        )) : <p className="px-4 py-6 text-center text-sm text-slate-500">{empty}</p>}
      </div>
    </section>
  );
}
