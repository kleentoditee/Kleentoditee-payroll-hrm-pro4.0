"use client";

import { PaginationControls, SortSelect } from "@/components/pagination-controls";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useListQuery, type PaginationMeta } from "@/lib/use-list-query";
import { Fragment, useEffect, useRef, useState } from "react";

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

const SORT_OPTIONS = [
  { value: "", label: "Date (newest)" },
  { value: "date", label: "Date (oldest)" },
  { value: "memo", label: "Memo (A–Z)" },
  { value: "sourceType", label: "Source type" },
  { value: "status", label: "Status" },
  { value: "createdAt", label: "Created (oldest)" }
];

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JournalPage() {
  const list = useListQuery(["sourceType"]);
  const sourceType = list.filter("sourceType");

  const [entries, setEntries] = useState<JournalEntryRow[] | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const loadSeq = useRef(0);

  useEffect(() => {
    const seq = ++loadSeq.current;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/reports/journal${list.queryString}`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ entries: JournalEntryRow[]; pagination: PaginationMeta }>(res);
        if (seq !== loadSeq.current) return;
        setEntries(data.entries);
        setPagination(data.pagination);
        setError(null);
        setLoading(false);
      } catch (e) {
        if (seq !== loadSeq.current) return;
        setError(e instanceof Error ? e.message : "Failed to load journal");
        setLoading(false);
      }
    })();
  }, [list.queryString, nonce]);

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
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="block max-w-sm flex-1 text-sm">
          <span className="sr-only">Search journal memos</span>
          <input
            type="search"
            value={list.searchInput}
            onChange={(e) => list.setSearchInput(e.target.value)}
            placeholder="Search memo"
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-[#006D77] focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            Source
            <select
              value={sourceType}
              onChange={(e) => list.setFilter("sourceType", e.target.value)}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              <option value="">All sources</option>
              {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <SortSelect id="journal-sort" value={list.sort} options={SORT_OPTIONS} onChange={list.setSort} />
        </div>
      </div>

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
          noun="journal entries"
        />
      ) : null}

      {!loading && !error && entries !== null && entries.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          {list.q || sourceType
            ? "No journal entries match the current search or filters."
            : "No journal entries yet. Journals appear when invoices are sent, bills received, payments recorded, expenses posted, or pay runs finalized."}
        </p>
      ) : null}

      {!error && entries && entries.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <RecordCardList>
            {entries.map((entry) => (
              <RecordCard key={entry.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">{entry.memo || "Journal entry"}</p>
                    <p className="mt-1 text-xs text-slate-500">{entry.date.slice(0, 10)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${entry.sourceType.endsWith("_reversal") ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>
                    {SOURCE_LABEL[entry.sourceType] ?? entry.sourceType}
                  </span>
                </div>
                <RecordCardFields>
                  <RecordCardField label="Debit total">${money(entry.totalDebit)}</RecordCardField>
                  <RecordCardField label="Lines">{entry.lines.length}</RecordCardField>
                </RecordCardFields>
                <button
                  type="button"
                  aria-expanded={expanded === entry.id}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {expanded === entry.id ? "Hide lines" : "Show lines"}
                </button>
                {expanded === entry.id ? (
                  <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                    {entry.lines.map((line, index) => (
                      <div key={index} className="rounded-lg bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-slate-900">{line.accountCode} - {line.accountName}</p>
                        {line.memo ? <p className="mt-1 break-words text-xs text-slate-500">{line.memo}</p> : null}
                        <div className="mt-2 flex justify-between gap-3 text-xs">
                          <span>Debit {line.debit > 0 ? `$${money(line.debit)}` : "-"}</span>
                          <span>Credit {line.credit > 0 ? `$${money(line.credit)}` : "-"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </RecordCard>
            ))}
          </RecordCardList>
          <BoundedTable>
          <table className="min-w-[820px] text-sm">
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
                    <td className="px-3 py-2 text-slate-500">
                      <button
                        type="button"
                        aria-expanded={expanded === entry.id}
                        aria-label={`${expanded === entry.id ? "Hide" : "Show"} lines for journal ${entry.memo || entry.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(expanded === entry.id ? null : entry.id);
                        }}
                        className="min-h-11 rounded-md px-2 py-1 outline-none ring-[#006D77] focus-visible:ring-2"
                      >
                        {expanded === entry.id ? "▲ hide" : "▼ show"}
                      </button>
                    </td>
                  </tr>
                  {expanded === entry.id ? (
                    <tr className="border-b border-slate-200 bg-slate-50/60">
                      <td colSpan={5} className="px-3 py-2">
                        <table className="min-w-[680px] text-xs">
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
          </BoundedTable>
        </div>
      ) : null}
    </section>
  );
}
