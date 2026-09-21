"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type OnboardingBatch = {
  id: string;
  createdAt: string;
  fileName: string;
  rowCount: number;
  createdCount: number;
  status: string;
  reversedAt: string | null;
};

export function BulkOnboardingCard() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("employees.csv");
  const [batches, setBatches] = useState<OnboardingBatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    const res = await fetch(`${apiBase()}/people/onboarding/batches`, { headers: { ...authHeaders() } });
    const json = (await res.json()) as { rows?: OnboardingBatch[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setBatches(json.rows ?? []);
  }, []);

  useEffect(() => {
    if (open) {
      loadBatches().catch((e) => setError(e instanceof Error ? e.message : "Could not load batches."));
    }
  }, [open, loadBatches]);

  async function downloadTemplate() {
    const res = await fetch(`${apiBase()}/people/onboarding/template.csv`, { headers: { ...authHeaders() } });
    if (!res.ok) return;
    const text = await res.text();
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee-onboarding-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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
      const res = await fetch(`${apiBase()}/people/onboarding/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ csv, fileName })
      });
      const json = (await res.json()) as {
        error?: string;
        errors?: string[];
        result?: { batchId: string; created: number };
      };
      if (!res.ok) {
        setRowErrors(json.errors ?? []);
        throw new Error(json.error ?? "Import failed");
      }
      setNotice(`Imported ${json.result?.created ?? 0} employee(s). The batch can be reversed until payroll touches them.`);
      setCsv("");
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function reverseBatch(batch: OnboardingBatch) {
    if (!window.confirm(`Reverse batch "${batch.fileName}"? This deletes the ${batch.createdCount} employee(s) it created. Blocked if any of them has payroll, time entries, or requests.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/people/onboarding/batches/${batch.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({})
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Reversal failed");
      setNotice(`Batch "${batch.fileName}" reversed.`);
      await loadBatches();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reversal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl text-slate-900">Bulk onboarding</h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Import many employees at once from a CSV (all-or-nothing, duplicate-safe). Every import is a batch
            that can be reversed until payroll, time entries, or requests touch the new employees.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          {open ? "Hide" : "Open bulk onboarding"}
        </button>
      </div>
      {open ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Download CSV template
            </button>
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
              Columns: fullName, email, phone, role, defaultSite, basePayType, dailyRate, hourlyRate, fixedPay,
              paySchedule, templateId
            </span>
          </div>
          <textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            rows={6}
            placeholder="Paste CSV content here (header row required)…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => void importCsv()}
            disabled={busy}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Working..." : "Import employees"}
          </button>
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
          ) : null}
          {rowErrors.length > 0 ? (
            <ul className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              {rowErrors.map((rowError) => (
                <li key={rowError}>{rowError}</li>
              ))}
            </ul>
          ) : null}
          {notice ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
              {notice}
            </p>
          ) : null}
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent batches</h4>
            {!batches ? (
              <p className="mt-2 text-sm text-slate-600">Loading...</p>
            ) : batches.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No onboarding batches yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 text-sm">
                {batches.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <span>
                      <span className="font-semibold">{batch.fileName}</span> · {batch.createdCount}/{batch.rowCount}{" "}
                      created · {batch.createdAt.slice(0, 10)} ·{" "}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          batch.status === "reversed" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </span>
                    {batch.status !== "reversed" ? (
                      <button
                        type="button"
                        onClick={() => void reverseBatch(batch)}
                        disabled={busy}
                        className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Reverse batch
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
