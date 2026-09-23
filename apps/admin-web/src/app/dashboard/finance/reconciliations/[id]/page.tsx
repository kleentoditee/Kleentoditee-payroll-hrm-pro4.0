"use client";

import { FinanceRecordBreadcrumbs } from "@/components/finance/record-breadcrumb";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { PaginationControls } from "@/components/pagination-controls";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { type PaginationMeta, useListQuery } from "@/lib/use-list-query";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ReconLine = {
  id: string;
  statementLineId: string;
  date: string;
  description: string;
  amount: number;
  statementLine: { id: string; status: string; reference: string };
};

type Recon = {
  id: string;
  status: "in_progress" | "completed";
  statementEndingDate: string;
  statementEndingBalance: number;
  openingBalance: number;
  clearedNet: number;
  difference: number;
  completedAt: string | null;
  unlockedAt: string | null;
  unlockReason: string | null;
  bankAccount: { id: string; code: string; name: string };
  lines: ReconLine[];
};

type StatementLine = {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  status: string;
  reconciledAt: string | null;
};

type OutstandingDoc = {
  entityType: string;
  entityId: string;
  label: string;
  date: string;
  amount: number;
  description: string;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ReconciliationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const list = useListQuery();
  const [recon, setRecon] = useState<Recon | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingDoc[]>([]);
  const [statementLines, setStatementLines] = useState<StatementLine[]>([]);
  const [linePagination, setLinePagination] = useState<PaginationMeta | null>(null);
  const [linesLoading, setLinesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLinesLoading(true);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations/${id}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ reconciliation: Recon; outstanding: OutstandingDoc[] }>(res);
      if (seq !== loadSeq.current) return;
      setRecon(json.reconciliation);
      setOutstanding(json.outstanding);
      const lineQuery = new URLSearchParams(list.queryString.slice(1));
      lineQuery.set("bankAccountId", json.reconciliation.bankAccount.id);
      lineQuery.set("includeExcluded", "false");
      const linesRes = await fetch(
        `${apiBase()}/finance/banking/lines?${lineQuery.toString()}`,
        { headers: { ...authHeaders() } }
      );
      const linesJson = await readApiData<{ items: StatementLine[]; pagination: PaginationMeta }>(linesRes);
      if (seq !== loadSeq.current) return;
      setStatementLines(linesJson.items);
      setLinePagination(linesJson.pagination);
      setLinesLoading(false);
      setError(null);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : "Failed to load reconciliation");
      setLinesLoading(false);
    }
  }, [id, list.queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  async function clear(statementLineId: string, cleared: boolean) {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations/${id}/${cleared ? "unclear" : "clear"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ statementLineId })
      });
      await readApiData(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update cleared line");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}"
      });
      await readApiData(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    const reason = window.prompt("Reason for reopening this completed reconciliation (audit-logged):");
    if (!reason) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/reconciliations/${id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason })
      });
      await readApiData(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  if (!recon) {
    return (
      <section className="space-y-4">
        <FinanceRecordBreadcrumbs />
        {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : <p className="text-sm text-slate-500">Loading…</p>}
      </section>
    );
  }

  const clearedIds = new Set(recon.lines.map((l) => l.statementLineId));
  const balanced = Math.abs(recon.difference) < 0.005;
  const inProgress = recon.status === "in_progress";

  return (
    <section className="space-y-4">
      <FinanceRecordBreadcrumbs recordLabel={`Reconciliation ${recon.statementEndingDate.slice(0, 10)}`} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Reconcile {recon.bankAccount.code} — {recon.bankAccount.name}
          </h2>
          <p className="text-sm text-slate-600">Statement ending {recon.statementEndingDate.slice(0, 10)}</p>
        </div>
        {inProgress ? (
          <button
            type="button"
            disabled={!balanced || busy}
            onClick={() => void complete()}
            className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Complete reconciliation
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void unlock()}
            className="min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Unlock (audited)
          </button>
        )}
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Opening balance", recon.openingBalance],
          ["Cleared (net)", recon.clearedNet],
          ["Statement ending", recon.statementEndingBalance],
          ["Difference", recon.difference]
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p
              className={`text-lg font-semibold tabular-nums ${
                label === "Difference" ? (balanced ? "text-emerald-700" : "text-rose-600") : "text-slate-900"
              }`}
            >
              ${money(value as number)}
            </p>
          </div>
        ))}
      </div>

      <p
        className={`rounded-md px-3 py-2 text-sm font-medium ${
          recon.status === "completed"
            ? "bg-emerald-50 text-emerald-800"
            : balanced
              ? "bg-sky-50 text-sky-800"
              : "bg-amber-50 text-amber-800"
        }`}
      >
        {recon.status === "completed"
          ? `Completed ${recon.completedAt?.slice(0, 10)} — cleared lines are locked.${recon.unlockedAt ? " (Previously unlocked: " + (recon.unlockReason ?? "") + ")" : ""}`
          : balanced
            ? "Difference is zero — ready to complete."
            : "Clear statement lines until the difference reaches zero."}
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="block max-w-md text-sm font-medium text-slate-700">
          Search statement lines
          <input type="search" value={list.searchInput} onChange={(event) => list.setSearchInput(event.target.value)} placeholder="Description or reference" className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </div>

      {linePagination || linesLoading ? (
        <PaginationControls
          page={list.page}
          pageSize={list.pageSize}
          total={linePagination?.total ?? 0}
          loading={linesLoading}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          noun="statement lines"
        />
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {statementLines.length === 0 && !linesLoading ? <p className="px-4 py-8 text-center text-sm text-slate-500">No statement lines match this account and search.</p> : null}
        <RecordCardList>
          {statementLines.map((line) => {
            const cleared = clearedIds.has(line.id);
            return (
              <RecordCard key={line.id}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={cleared} disabled={!inProgress || busy} onChange={() => void clear(line.id, cleared)} className="mt-1 h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-semibold text-slate-950">{line.description}</span>
                    <span className="mt-1 block text-xs text-slate-500">{line.date.slice(0, 10)}</span>
                  </span>
                  <span className={`shrink-0 font-bold tabular-nums ${line.amount < 0 ? "text-rose-600" : "text-slate-950"}`}>${money(line.amount)}</span>
                </label>
                <RecordCardFields>
                  <RecordCardField label="Reference">{line.reference || "-"}</RecordCardField>
                  <RecordCardField label="Match status">{line.status}</RecordCardField>
                  <RecordCardField label="Cleared">{cleared ? "Yes" : "No"}</RecordCardField>
                </RecordCardFields>
              </RecordCard>
            );
          })}
        </RecordCardList>
        <BoundedTable>
        <table className="min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Cleared</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Match</th>
            </tr>
          </thead>
          <tbody>
            {statementLines.map((l) => {
              const cleared = clearedIds.has(l.id);
              return (
                <tr key={l.id} className={`border-b border-slate-100 ${cleared ? "bg-emerald-50/40" : ""}`}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={cleared}
                      disabled={!inProgress || busy}
                      onChange={() => void clear(l.id, cleared)}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{l.date.slice(0, 10)}</td>
                  <td className="px-3 py-2">{l.description}</td>
                  <td className="px-3 py-2 text-slate-500">{l.reference}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${l.amount < 0 ? "text-rose-600" : ""}`}>
                    ${money(l.amount)}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{l.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </BoundedTable>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">Outstanding documents (never reconciled)</h3>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {outstanding.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">Every bank document is reconciled.</p> : null}
          <RecordCardList>
            {outstanding.map((document) => (
              <RecordCard key={`${document.entityType}:${document.entityId}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">{document.label}</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">{document.entityType.replace("_", " ")} · {document.date}</p>
                  </div>
                  <p className={`shrink-0 font-bold tabular-nums ${document.amount < 0 ? "text-rose-600" : "text-slate-950"}`}>${money(document.amount)}</p>
                </div>
                <RecordCardFields>
                  <RecordCardField label="Description">{document.description || "-"}</RecordCardField>
                </RecordCardFields>
              </RecordCard>
            ))}
          </RecordCardList>
          <BoundedTable>
          <table className="min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody>
              {outstanding.map((d) => (
                <tr key={`${d.entityType}:${d.entityId}`} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium">{d.label}</td>
                  <td className="px-3 py-2 capitalize text-slate-600">{d.entityType.replace("_", " ")}</td>
                  <td className="px-3 py-2">{d.date}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${d.amount < 0 ? "text-rose-600" : ""}`}>
                    ${money(d.amount)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{d.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </BoundedTable>
        </div>
      </div>
    </section>
  );
}
