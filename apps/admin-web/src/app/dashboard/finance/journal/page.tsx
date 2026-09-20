"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { Fragment, useEffect, useState } from "react";

type JournalLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo: string;
};

type JournalEntryRow = {
  id: string;
  date: string;
  memo: string;
  sourceType: string;
  sourceId: string;
  status: string;
  reversalOfId: string | null;
  totalDebit: number;
  lines: JournalLine[];
};

const SOURCE_LABEL: Record<string, string> = {
  invoice: "Invoice issued",
  invoice_reversal: "Invoice void reversal",
  payment: "Customer payment",
  payment_reversal: "Payment reversal",
  bill: "Bill received",
  bill_reversal: "Bill void reversal",
  bill_payment: "Supplier payment",
  bill_payment_reversal: "Supplier payment reversal",
  expense: "Expense posted",
  expense_reversal: "Expense void reversal",
  payroll_run: "Payroll accrual",
  payroll_run_reversal: "Payroll void reversal",
  payroll_run_paid: "Payroll settlement",
  payroll_run_paid_reversal: "Payroll settlement reversal",
  payroll_statutory_remittance: "Statutory remittance",
  payroll_statutory_remittance_reversal: "Statutory remittance reversal",
  deposit_posted: "Deposit posted",
  deposit_posted_reversal: "Deposit void reversal",
  manual_journal: "Manual journal",
  manual_journal_reversal: "Manual journal reversal"
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const query = sourceType ? `?sourceType=${encodeURIComponent(sourceType)}` : "";
        const res = await fetch(`${apiBase()}/finance/reports/journal${query}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ entries: JournalEntryRow[] }>(res);
        if (!cancelled) {
          setEntries(data.entries);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load journal");
          setEntries(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceType]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">General journal</h2>
          <p className="text-sm text-slate-600">
            Every posted business document writes one balanced journal. Corrections are reversal entries; posted
            rows are never edited.
          </p>
        </div>
        <label className="text-sm font-medium text-slate-700">
          Source
          <select
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All sources</option>
            {Object.entries(SOURCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {entries === null && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {entries !== null && entries.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No journal entries yet. Journals appear when invoices are sent, bills received, payments recorded,
          expenses posted, or pay runs finalized.
        </p>
      ) : null}

      {entries && entries.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2 text-right">Debit total</th>
                <th className="px-3 py-2">Lines</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  >
                    <td className="whitespace-nowrap px-3 py-2">{entry.date.slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.sourceType.endsWith("_reversal")
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{entry.memo}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${money(entry.totalDebit)}</td>
                    <td className="px-3 py-2 text-slate-500">{expanded === entry.id ? "▲ hide" : "▼ show"}</td>
                  </tr>
                  {expanded === entry.id ? (
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      <td colSpan={5} className="px-3 py-2">
                        <table className="min-w-full text-xs">
                          <tbody>
                            {entry.lines.map((line, i) => (
                              <tr key={i}>
                                <td className="px-2 py-1 font-mono text-slate-500">{line.accountCode}</td>
                                <td className="px-2 py-1">{line.accountName}</td>
                                <td className="px-2 py-1 text-slate-500">{line.memo}</td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                  {line.debit > 0 ? `$${money(line.debit)}` : ""}
                                </td>
                                <td className="px-2 py-1 text-right tabular-nums">
                                  {line.credit > 0 ? `$${money(line.credit)}` : ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
