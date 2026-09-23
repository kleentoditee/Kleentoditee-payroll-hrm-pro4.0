"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type Mutation = {
  id: string;
  employeeId: string;
  kind: "addition" | "deduction";
  label: string;
  amount: number;
};

type MutationBatch = {
  id: string;
  createdAt: string;
  fileName: string;
  rowCount: number;
  appliedCount: number;
  status: string;
  mutations: Mutation[];
};

function downloadCsv(fileName: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function RunMutationsPanel({ runId, runStatus }: { runId: string; runStatus: string }) {
  const [batches, setBatches] = useState<MutationBatch[] | null>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("mutations.csv");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const isDraft = runStatus === "draft";
  const canBankExport = runStatus === "finalized" || runStatus === "exported" || runStatus === "paid";

  const load = useCallback(async () => {
    const res = await fetch(`${apiBase()}/payroll/runs/${runId}/mutations`, { headers: { ...authHeaders() } });
    const json = (await res.json()) as { batches?: MutationBatch[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setBatches(json.batches ?? []);
  }, [runId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Could not load mutations."));
  }, [load]);

  async function onFile(file: File | null) {
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function importCsv() {
    if (!csv.trim()) {
      setError("Paste CSV content or choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setRowErrors([]);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/runs/${runId}/mutations/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ csv, fileName })
      });
      const json = (await res.json()) as { error?: string; errors?: string[]; result?: { applied: number } };
      if (!res.ok) {
        setRowErrors(json.errors ?? []);
        throw new Error(json.error ?? "Import failed");
      }
      setNotice(`Applied ${json.result?.applied ?? 0} mutation(s) to this draft run. Rebuild or finalize when ready.`);
      setCsv("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function reverseBatch(batch: MutationBatch) {
    if (!window.confirm(`Reverse mutation batch "${batch.fileName}"? Amounts are returned to their previous values.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/mutation-batches/${batch.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({})
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Reversal failed");
      setNotice(`Batch "${batch.fileName}" reversed.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reversal failed");
    } finally {
      setBusy(false);
    }
  }

  async function bankExport() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/runs/${runId}/bank-export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({})
      });
      const json = (await res.json()) as {
        error?: string;
        export?: { id: string; fileName: string };
        reused?: boolean;
        totalNet?: number | null;
        itemCount?: number | null;
      };
      if (!res.ok || !json.export) throw new Error(json.error ?? "Bank export failed");
      const dl = await fetch(`${apiBase()}/payroll/runs/${runId}/exports/${json.export.id}`, {
        headers: { ...authHeaders() }
      });
      if (!dl.ok) throw new Error("Export created but download failed.");
      downloadCsv(json.export.fileName, await dl.text());
      setNotice(
        `Bank payout file ${json.reused ? "already existed and was reused" : "created"}: ${json.itemCount ?? "?"} employees, total ${Number(json.totalNet ?? 0).toFixed(2)} — matches approved net payroll exactly.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bank export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-serif text-xl text-slate-900">Adjustments & bank payout</h3>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Import additions/deductions from a CSV while the run is a draft — every batch is reversible until
        finalize. After finalize, generate the BVI bank-payment file; its TOTAL line always equals approved net
        payroll exactly. Employees need a bank account number on their profile (Government IDs tab).
      </p>

      {canBankExport ? (
        <button
          type="button"
          onClick={() => void bankExport()}
          disabled={busy}
          className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working..." : "Generate BVI bank payout file"}
        </button>
      ) : null}

      {isDraft ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <span className="text-xs text-slate-500">
              Columns: employeeEmail (or employeeId), kind (addition|deduction), label, amount
            </span>
          </div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={4}
            placeholder="employeeEmail,kind,label,amount"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void importCsv()}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Working..." : "Import adjustments"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {rowErrors.length > 0 ? (
        <ul className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {rowErrors.map((rowError) => (
            <li key={rowError}>{rowError}</li>
          ))}
        </ul>
      ) : null}
      {notice ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {notice}
        </p>
      ) : null}

      {!batches ? (
        <p className="mt-3 text-sm text-slate-600">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No adjustment batches for this run.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100 text-sm">
          {batches.map((batch) => (
            <li key={batch.id} className="py-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{batch.fileName}</span> · {batch.appliedCount}/{batch.rowCount}{" "}
                  applied · {batch.createdAt.slice(0, 10)} ·{" "}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      batch.status === "reversed" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {batch.status}
                  </span>
                </span>
                {batch.status !== "reversed" && isDraft ? (
                  <button
                    type="button"
                    onClick={() => void reverseBatch(batch)}
                    disabled={busy}
                    className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Reverse batch
                  </button>
                ) : null}
              </div>
              <ul className="mt-1 text-xs text-slate-500">
                {batch.mutations.map((mutation) => (
                  <li key={mutation.id}>
                    {mutation.kind === "addition" ? "+" : "−"}
                    {Number(mutation.amount).toFixed(2)} · {mutation.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
