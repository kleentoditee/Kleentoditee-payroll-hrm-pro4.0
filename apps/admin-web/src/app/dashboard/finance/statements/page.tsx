"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useRef, useState } from "react";

type Account = { id: string; code: string; name: string; type: string; subtype?: string };

type PreviewRow = {
  position: number;
  date: string;
  description: string;
  reference: string;
  amount: number;
  duplicate: boolean;
};

type PreviewPlan = {
  headers: string[];
  mapping: Record<string, number | undefined>;
  rows: PreviewRow[];
  rowCount: number;
  parsedCount: number;
  duplicateCount: number;
  validationErrors: string[];
  warnings: string[];
};

type StatementLine = {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  status: "unmatched" | "matched" | "excluded";
  matchedEntityType: string | null;
  matchedEntityId: string | null;
  reconciledAt: string | null;
  import: { id: string; fileName: string };
};

type Suggestion = {
  entityType: string;
  entityId: string;
  label: string;
  date: string;
  amount: number;
  description: string;
  score: number;
};

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_BADGE: Record<string, string> = {
  unmatched: "bg-amber-100 text-amber-800",
  matched: "bg-sky-100 text-sky-800",
  excluded: "bg-slate-200 text-slate-600"
};

export default function BankStatementsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [csv, setCsv] = useState("");
  const [plan, setPlan] = useState<PreviewPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [suggestionsFor, setSuggestionsFor] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/accounts`, { headers: { ...authHeaders() } });
        const json = await readApiData<{ items?: Account[]; accounts?: Account[] }>(res);
        const all = json.items ?? json.accounts ?? [];
        const banks = all.filter((a) => a.type === "asset" && /bank|cash/i.test(a.subtype ?? ""));
        setAccounts(banks.length > 0 ? banks : all.filter((a) => a.type === "asset"));
        const list = banks.length > 0 ? banks : all.filter((a) => a.type === "asset");
        if (list.length > 0) setBankAccountId((prev) => prev || list[0].id);
      } catch {
        setError("Failed to load accounts");
      }
    })();
  }, []);

  const loadLines = useCallback(async () => {
    if (!bankAccountId) return;
    try {
      const q = new URLSearchParams({ bankAccountId });
      if (statusFilter) q.set("status", statusFilter);
      const res = await fetch(`${apiBase()}/finance/banking/lines?${q}`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ items: StatementLine[] }>(res);
      setLines(json.items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statement lines");
    }
  }, [bankAccountId, statusFilter]);

  useEffect(() => {
    void loadLines();
  }, [loadLines]);

  async function onFile(file: File) {
    setFileName(file.name);
    setCsv(await file.text());
    setPlan(null);
  }

  async function preview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/imports/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bankAccountId, fileName, csv })
      });
      const json = await readApiData<{ plan: PreviewPlan }>(res);
      setPlan(json.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/imports/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bankAccountId, fileName, csv })
      });
      const json = await readApiData<{ result: { created: number; duplicates: number; rowCount: number } }>(res);
      setNotice(`Imported ${json.result.created} lines (${json.result.duplicates} duplicates skipped).`);
      setPlan(null);
      setCsv("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      await loadLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function openSuggestions(lineId: string) {
    setSuggestionsFor(lineId);
    setSuggestions([]);
    try {
      const res = await fetch(`${apiBase()}/finance/banking/lines/${lineId}/suggestions`, { headers: { ...authHeaders() } });
      const json = await readApiData<{ suggestions: Suggestion[] }>(res);
      setSuggestions(json.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suggestions");
    }
  }

  async function match(lineId: string, s: Suggestion) {
    try {
      const res = await fetch(`${apiBase()}/finance/banking/lines/${lineId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ entityType: s.entityType, entityId: s.entityId })
      });
      await readApiData(res);
      setSuggestionsFor(null);
      await loadLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Match failed");
    }
  }

  async function lineAction(lineId: string, action: "unmatch" | "exclude") {
    try {
      const res = await fetch(`${apiBase()}/finance/banking/lines/${lineId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}"
      });
      await readApiData(res);
      await loadLines();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Bank statements</h2>
        <p className="text-sm text-slate-600">
          Import a statement CSV, then match each line to the payment, deposit, expense, bill payment, or journal it
          represents. Re-importing a file is safe — duplicate lines are detected and skipped.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Bank account
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Line status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="unmatched">Unmatched</option>
            <option value="matched">Matched</option>
            <option value="excluded">Excluded</option>
          </select>
        </label>
      </div>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Import a statement file</h3>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
            className="text-sm text-slate-600"
          />
          <button
            type="button"
            disabled={!csv || !bankAccountId || busy}
            onClick={() => void preview()}
            className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Preview
          </button>
          {plan ? (
            <button
              type="button"
              disabled={busy || plan.parsedCount === 0 || plan.validationErrors.length > 0}
              onClick={() => void commit()}
              className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Commit import
            </button>
          ) : null}
        </div>
        {plan ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              {fileName}: {plan.parsedCount} importable of {plan.rowCount} rows · {plan.duplicateCount} already imported.
            </p>
            {plan.validationErrors.map((e) => (
              <p key={e} className="rounded-md bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{e}</p>
            ))}
            {plan.warnings.map((w) => (
              <p key={w} className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{w}</p>
            ))}
            <div className="max-h-64 overflow-auto rounded-md border border-slate-200">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">Date</th>
                    <th className="px-2 py-1">Description</th>
                    <th className="px-2 py-1">Reference</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {plan.rows.map((r) => (
                    <tr key={r.position} className="border-b border-slate-100">
                      <td className="px-2 py-1 text-slate-400">{r.position}</td>
                      <td className="px-2 py-1">{r.date}</td>
                      <td className="px-2 py-1">{r.description}</td>
                      <td className="px-2 py-1">{r.reference}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${r.amount < 0 ? "text-rose-600" : ""}`}>
                        ${money(r.amount)}
                      </td>
                      <td className="px-2 py-1">
                        {r.duplicate ? (
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">duplicate</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 align-top">
                <td className="px-3 py-2 whitespace-nowrap">{l.date.slice(0, 10)}</td>
                <td className="px-3 py-2">{l.description}</td>
                <td className="px-3 py-2 text-slate-500">{l.reference}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${l.amount < 0 ? "text-rose-600" : ""}`}>
                  ${money(l.amount)}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_BADGE[l.status]}`}>
                    {l.status}
                  </span>
                  {l.reconciledAt ? (
                    <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">reconciled</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {l.matchedEntityType ? `${l.matchedEntityType} ${l.matchedEntityId?.slice(0, 8)}…` : "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {l.status !== "matched" && !l.reconciledAt ? (
                      <button type="button" onClick={() => void openSuggestions(l.id)} className="text-sky-700 hover:underline">
                        Match
                      </button>
                    ) : null}
                    {l.status === "matched" && !l.reconciledAt ? (
                      <button type="button" onClick={() => void lineAction(l.id, "unmatch")} className="text-slate-600 hover:underline">
                        Unmatch
                      </button>
                    ) : null}
                    {!l.reconciledAt ? (
                      <button type="button" onClick={() => void lineAction(l.id, "exclude")} className="text-slate-600 hover:underline">
                        {l.status === "excluded" ? "Include" : "Exclude"}
                      </button>
                    ) : null}
                  </div>
                  {suggestionsFor === l.id ? (
                    <div className="mt-2 space-y-1 rounded-md border border-slate-200 bg-slate-50 p-2">
                      {suggestions.length === 0 ? (
                        <p className="text-xs text-slate-500">No candidate documents found.</p>
                      ) : (
                        suggestions.map((s) => (
                          <button
                            key={`${s.entityType}:${s.entityId}`}
                            type="button"
                            onClick={() => void match(l.id, s)}
                            className="block w-full rounded px-2 py-1 text-left text-xs hover:bg-white"
                          >
                            <span className="font-medium">{s.label}</span> · {s.entityType} · {s.date} · ${money(s.amount)} ·
                            score {s.score}
                            <span className="block text-slate-500">{s.description}</span>
                          </button>
                        ))
                      )}
                      <button type="button" onClick={() => setSuggestionsFor(null)} className="text-xs text-slate-500 hover:underline">
                        Close
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-500">
                  No statement lines yet — import a statement CSV above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
