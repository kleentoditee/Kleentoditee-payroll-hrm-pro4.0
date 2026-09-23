"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { useEffect, useState } from "react";

type CloseRow = {
  id: string;
  year: number;
  status: "draft" | "reviewed" | "approved" | "posted" | "superseded";
  revisionOfId: string | null;
  revisionReason: string;
  signatureText: string | null;
  postedAt: string | null;
  closingJournalEntryId: string | null;
  supersededById: string | null;
  createdAt: string;
};

const STATUS_STYLE: Record<CloseRow["status"], { badge: string; label: string }> = {
  draft: { badge: "bg-slate-100 text-slate-700", label: "Draft" },
  reviewed: { badge: "bg-sky-100 text-sky-800", label: "Reviewed" },
  approved: { badge: "bg-amber-100 text-amber-800", label: "Approved" },
  posted: { badge: "bg-emerald-100 text-emerald-800", label: "Posted" },
  superseded: { badge: "bg-slate-200 text-slate-500", label: "Superseded" }
};

const fmt = (n: unknown) =>
  typeof n === "number" ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

export default function YearEndPage() {
  const [closes, setCloses] = useState<CloseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`${apiBase()}/finance/year-end-closes`, { headers: { ...authHeaders() } });
      const data = await readApiData<{ items: CloseRow[] }>(res);
      setCloses(data.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load year-end closes");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function request(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/year-end-closes${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : "{}"
      });
      await readApiData(res);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function review(c: CloseRow) {
    const note = window.prompt("Review note (optional):") ?? "";
    void request(`/${c.id}/review`, { reviewNote: note });
  }

  function post(c: CloseRow) {
    const signature = window.prompt(
      `Post the ${c.year} year-end close? This is irreversible. Type the signer's full name:`
    );
    if (!signature || signature.trim().length < 3) return;
    void request(`/${c.id}/post`, { signatureText: signature.trim() });
  }

  function revise(c: CloseRow) {
    const reason = window.prompt(`Revise the posted ${c.year} close? Enter a revision reason (audit):`);
    if (!reason || !reason.trim()) return;
    void request(`/${c.id}/revise`, { reason: reason.trim() });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Year-end close</h2>
        <p className="text-sm text-slate-600">
          Closes move the year&apos;s revenue and expense balances into retained earnings through a draft →
          reviewed → approved → posted workflow with a typed signature. Corrections are made by superseding
          revision, which reverses the prior closing journal — closes are never edited in place.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-700">
          Fiscal year
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 block w-28 rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          disabled={busy}
          onClick={() => void request("", { year })}
          className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Create draft close
        </button>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {closes === null && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {closes !== null && closes.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No year-end closes yet. Create a draft for the year you want to close.
        </p>
      ) : null}

      {closes && closes.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <RecordCardList>
            {closes.map((close) => {
              const style = STATUS_STYLE[close.status];
              const expanded = expandedId === close.id;
              return (
                <RecordCard key={close.id}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-950">Fiscal year {close.year}{close.revisionOfId ? " revision" : ""}</p>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${style.badge}`}>{style.label}</span>
                  </div>
                  <RecordCardFields>
                    <RecordCardField label="Signature">{close.signatureText ?? "-"}</RecordCardField>
                    <RecordCardField label="Posted">{close.postedAt ? close.postedAt.slice(0, 10) : "-"}</RecordCardField>
                    <RecordCardField label="Revision reason">{close.revisionReason || "-"}</RecordCardField>
                  </RecordCardFields>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <CloseActionButtons
                      close={close}
                      busy={busy}
                      expanded={expanded}
                      onToggle={() => setExpandedId(expanded ? null : close.id)}
                      onReview={() => review(close)}
                      onApprove={() => void request(`/${close.id}/approve`)}
                      onPost={() => post(close)}
                      onRevise={() => revise(close)}
                    />
                  </div>
                  {expanded ? <div className="mt-3 border-t border-slate-200 pt-3"><ClosePreview closeId={close.id} /></div> : null}
                </RecordCard>
              );
            })}
          </RecordCardList>
          <BoundedTable>
          <table className="min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Signature</th>
                <th className="px-3 py-2">Posted</th>
                <th className="px-3 py-2">Revision</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {closes.map((c) => {
                const style = STATUS_STYLE[c.status];
                const expanded = expandedId === c.id;
                return (
                  <FragmentRow
                    key={c.id}
                    close={c}
                    badge={style.badge}
                    label={style.label}
                    busy={busy}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : c.id)}
                    onReview={() => review(c)}
                    onApprove={() => void request(`/${c.id}/approve`)}
                    onPost={() => post(c)}
                    onRevise={() => revise(c)}
                  />
                );
              })}
            </tbody>
          </table>
          </BoundedTable>
        </div>
      ) : null}
    </section>
  );
}

function FragmentRow(props: {
  close: CloseRow;
  badge: string;
  label: string;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onReview: () => void;
  onApprove: () => void;
  onPost: () => void;
  onRevise: () => void;
}) {
  const { close: c } = props;
  return (
    <>
      <tr className="border-b border-slate-100">
        <td className="px-3 py-2 font-medium">
          {c.year}
          {c.revisionOfId ? <span className="ml-1 text-xs text-slate-500">(revision)</span> : null}
        </td>
        <td className="px-3 py-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${props.badge}`}>{props.label}</span>
        </td>
        <td className="px-3 py-2 text-slate-600">{c.signatureText ?? "—"}</td>
        <td className="px-3 py-2 text-slate-600">{c.postedAt ? c.postedAt.slice(0, 10) : "—"}</td>
        <td className="px-3 py-2 text-xs text-slate-600">
          {c.revisionReason ? c.revisionReason : "—"}
        </td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-2"><CloseActionButtons {...props} /></div>
        </td>
      </tr>
      {props.expanded ? (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-3 py-3">
            <ClosePreview closeId={c.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CloseActionButtons(props: {
  close: CloseRow;
  busy: boolean;
  expanded: boolean;
  onToggle: () => void;
  onReview: () => void;
  onApprove: () => void;
  onPost: () => void;
  onRevise: () => void;
}) {
  const buttonClass = "inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50";
  return (
    <>
      <button type="button" onClick={props.onToggle} className={`${buttonClass} text-slate-700`}>
        {props.expanded ? "Hide preview" : "Preview"}
      </button>
      {props.close.status === "draft" ? <button type="button" disabled={props.busy} onClick={props.onReview} className={`${buttonClass} text-sky-700`}>Mark reviewed</button> : null}
      {props.close.status === "reviewed" ? <button type="button" disabled={props.busy} onClick={props.onApprove} className={`${buttonClass} text-amber-700`}>Approve</button> : null}
      {props.close.status === "approved" ? <button type="button" disabled={props.busy} onClick={props.onPost} className={`${buttonClass} text-emerald-700`}>Post</button> : null}
      {props.close.status === "posted" ? <button type="button" disabled={props.busy} onClick={props.onRevise} className={`${buttonClass} border-rose-200 text-rose-700`}>Revise</button> : null}
    </>
  );
}

function ClosePreview({ closeId }: { closeId: string }) {
  const [lines, setLines] = useState<Array<{ accountCode?: string; accountName?: string; debit?: number; credit?: number }> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/year-end-closes`, { headers: { ...authHeaders() } });
        const data = await readApiData<{ items: Array<CloseRow & { closingPreviewJson?: { lines?: Array<{ accountCode?: string; accountName?: string; debit?: number; credit?: number }> } }> }>(res);
        const found = data.items.find((i) => i.id === closeId);
        if (!cancelled) setLines(found?.closingPreviewJson?.lines ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load preview");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [closeId]);

  if (loadError) return <p className="text-sm text-rose-700">{loadError}</p>;
  if (!lines) return <p className="text-sm text-slate-500">Loading preview…</p>;
  if (lines.length === 0) return <p className="text-sm text-slate-500">No preview lines recorded.</p>;

  return (
    <div className="space-y-2 text-xs">
      {lines.map((line, index) => (
        <div key={index} className="grid gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center">
          <p className="min-w-0 break-words font-medium text-slate-800">{line.accountCode ? `${line.accountCode} - ` : ""}{line.accountName ?? ""}</p>
          <p className="tabular-nums text-slate-600 sm:text-right">Debit {line.debit ? fmt(line.debit) : "-"}</p>
          <p className="tabular-nums text-slate-600 sm:text-right">Credit {line.credit ? fmt(line.credit) : "-"}</p>
        </div>
      ))}
    </div>
  );
}
