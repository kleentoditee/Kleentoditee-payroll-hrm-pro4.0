"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { Fragment, useEffect, useState } from "react";

type AccountOption = { id: string; code: string; name: string; type: string };

type JournalLineRow = {
  id: string;
  position: number;
  debit: number;
  credit: number;
  memo: string;
  account: AccountOption;
};

type JournalRow = {
  id: string;
  date: string;
  memo: string;
  status: "draft" | "approved" | "posted" | "void";
  lines: JournalLineRow[];
};

type DraftLine = { accountId: string; debit: string; credit: string; memo: string };

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const emptyLine = (): DraftLine => ({ accountId: "", debit: "", credit: "", memo: "" });

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  approved: "bg-sky-100 text-sky-800",
  posted: "bg-emerald-100 text-emerald-800",
  void: "bg-rose-100 text-rose-700"
};

export default function ManualJournalsPage() {
  const [items, setItems] = useState<JournalRow[] | null>(null);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    try {
      const [jRes, aRes] = await Promise.all([
        fetch(`${apiBase()}/finance/journals`, { headers: { ...authHeaders() } }),
        fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } })
      ]);
      const jData = await readApiData<{ items: JournalRow[] }>(jRes);
      const aData = await readApiData<{ items?: AccountOption[]; accounts?: AccountOption[] }>(aRes);
      setItems(jData.items);
      setAccounts(aData.items ?? aData.accounts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load journals");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  async function act(path: string, body?: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: body ? JSON.stringify(body) : undefined
      });
      await readApiData(res);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createJournal() {
    const ok = await act("/finance/journals", {
      date,
      memo,
      lines: lines
        .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
        .map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.memo }))
    });
    if (ok) {
      setShowForm(false);
      setMemo("");
      setLines([emptyLine(), emptyLine()]);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Manual journals</h2>
          <p className="text-sm text-slate-600">
            Adjustments, transfers, owner contributions and draws, asset and loan entries. Drafts do not affect
            the trial balance until posted; posted journals can only be corrected by reversal.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
        >
          {showForm ? "Close form" : "New journal"}
        </button>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      {showForm ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-medium text-slate-700">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="ml-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex-1 text-sm font-medium text-slate-700">
              Memo
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="e.g. Owner contribution"
                className="ml-2 w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-1">Account</th>
                <th className="px-2 py-1 text-right">Debit</th>
                <th className="px-2 py-1 text-right">Credit</th>
                <th className="px-2 py-1">Line memo</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-2 py-1">
                    <select
                      value={l.accountId}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)))}
                      className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Choose account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.debit}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x)))}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.credit}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x)))}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={l.memo}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, memo: e.target.value } : x)))}
                      className="w-44 rounded-md border border-slate-300 px-2 py-1 text-sm"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      className="text-xs text-rose-600 hover:underline"
                      disabled={lines.length <= 2}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between">
            <button onClick={() => setLines([...lines, emptyLine()])} className="text-sm text-teal-700 hover:underline">
              + Add line
            </button>
            <p className={`text-sm font-medium ${balanced ? "text-emerald-700" : "text-rose-700"}`}>
              Debits {money(totalDebit)} / Credits {money(totalCredit)} {balanced ? "— balanced" : "— out of balance"}
            </p>
          </div>
          <button
            onClick={() => void createJournal()}
            disabled={busy || !balanced}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Save draft
          </button>
        </div>
      ) : null}

      {items === null && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}
      {items !== null && items.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No manual journals yet.
        </p>
      ) : null}

      {items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Debit total</th>
                <th className="px-3 py-2">Lines</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => {
                const total = j.lines.reduce((s, l) => s + Number(l.debit), 0);
                return (
                  <Fragment key={j.id}>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap">{j.date.slice(0, 10)}</td>
                      <td className="px-3 py-2">{j.memo || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[j.status]}`}>{j.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{money(total)}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                          className="text-teal-700 hover:underline"
                        >
                          {expanded === j.id ? "Hide" : `${j.lines.length} lines`}
                        </button>
                      </td>
                      <td className="space-x-2 px-3 py-2 whitespace-nowrap">
                        {j.status === "draft" ? (
                          <>
                            <button disabled={busy} onClick={() => void act(`/finance/journals/${j.id}/approve`)} className="text-sky-700 hover:underline">Approve</button>
                            <button disabled={busy} onClick={() => void act(`/finance/journals/${j.id}/post`)} className="text-emerald-700 hover:underline">Post</button>
                            <button disabled={busy} onClick={() => void act(`/finance/journals/${j.id}`, undefined, "DELETE")} className="text-rose-600 hover:underline">Delete</button>
                          </>
                        ) : null}
                        {j.status === "approved" ? (
                          <button disabled={busy} onClick={() => void act(`/finance/journals/${j.id}/post`)} className="text-emerald-700 hover:underline">Post</button>
                        ) : null}
                        {j.status === "posted" ? (
                          <button disabled={busy} onClick={() => void act(`/finance/journals/${j.id}/reverse`)} className="text-amber-700 hover:underline">Reverse</button>
                        ) : null}
                      </td>
                    </tr>
                    {expanded === j.id ? (
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <td colSpan={6} className="px-6 py-2">
                          <table className="min-w-full text-xs">
                            <tbody>
                              {j.lines.map((l) => (
                                <tr key={l.id}>
                                  <td className="py-1 pr-4">{l.account.code} · {l.account.name}</td>
                                  <td className="py-1 pr-4 text-right">{Number(l.debit) ? money(Number(l.debit)) : ""}</td>
                                  <td className="py-1 pr-4 text-right">{Number(l.credit) ? money(Number(l.credit)) : ""}</td>
                                  <td className="py-1 text-slate-500">{l.memo}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
