"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type BatchStatus =
  | "uploaded" | "inventoried" | "mapped" | "validated" | "approved"
  | "importing" | "reconciled" | "accepted" | "rejected" | "failed" | "reversed";

type BatchFile = {
  id: string;
  fileName: string;
  importType: string;
  sha256?: string;
  rowCount: number;
  validCount: number;
  invalidCount: number;
  committedCount: number;
  disposition?: string;
  dispositionNote?: string;
};

type Reconciliation = {
  id: string;
  checkType: string;
  scope: string;
  expected: number;
  actual: number;
  status: string;
};

type Batch = {
  id: string;
  createdAt: string;
  sourceSystem: string;
  status: BatchStatus;
  label: string;
  errorSummary: string;
  migrationMode?: string;
  exceptionSignature?: string;
  files?: BatchFile[];
  reconciliations?: Reconciliation[];
};

const IMPORT_TYPES = [
  "accounts", "customers", "vendors", "products",
  "invoices", "bills", "expenses", "payments", "bill_payments", "deposits",
  "sales_receipts", "journal_entries", "transfers", "opening_balances",
  "estimates", "purchase_orders", "credit_memos", "classes", "locations",
  "projects", "product_categories", "time_activities"
] as const;

const STATUS_STYLE: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-600",
  inventoried: "bg-sky-100 text-sky-700",
  mapped: "bg-sky-100 text-sky-700",
  validated: "bg-emerald-100 text-emerald-700",
  approved: "bg-emerald-100 text-emerald-800",
  importing: "bg-amber-100 text-amber-700",
  reconciled: "bg-teal-100 text-teal-800",
  accepted: "bg-teal-100 text-teal-900",
  rejected: "bg-rose-100 text-rose-700",
  failed: "bg-rose-100 text-rose-800",
  reversed: "bg-slate-200 text-slate-700"
};

async function readFilePayload(file: File): Promise<{ csv?: string; fileContent?: string }> {
  if (file.name.toLowerCase().endsWith(".csv")) return { csv: await file.text() };
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { fileContent: btoa(binary) };
}

export default function MigrationCenterPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [sourceSystem, setSourceSystem] = useState("quickbooks");
  const [label, setLabel] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [migrationMode, setMigrationMode] = useState<"full_detail" | "cutover">("full_detail");
  const [importType, setImportType] = useState<(typeof IMPORT_TYPES)[number]>("customers");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadBatches = useCallback(async () => {
    const res = await fetch(`${apiBase()}/imports/migration/batches`, { headers: { ...authHeaders() } });
    const data = await readApiData<{ batches: Batch[] }>(res);
    setBatches(data.batches);
  }, []);

  const loadBatch = useCallback(async (id: string) => {
    const res = await fetch(`${apiBase()}/imports/migration/batches/${id}`, { headers: { ...authHeaders() } });
    const data = await readApiData<{ batch: Batch }>(res);
    setSelected(data.batch);
  }, []);

  useEffect(() => {
    loadBatches().catch(() => setError("Could not load migration batches."));
  }, [loadBatches]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function post(path: string, body: Record<string, unknown> = {}) {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    return readApiData<Record<string, unknown>>(res);
  }

  const createBatch = () =>
    run(async () => {
      await post("/imports/migration/batches", { sourceSystem, label, migrationMode, ...(asOfDate ? { asOfDate } : {}) });
      setLabel("");
      await loadBatches();
      setNotice("Batch created. Upload your export files next.");
    });

  const uploadFile = (file: File) =>
    run(async () => {
      if (!selected) return;
      const payload = await readFilePayload(file);
      await post(`/imports/migration/batches/${selected.id}/files`, {
        fileName: file.name,
        importType,
        ...payload
      });
      await loadBatch(selected.id);
      await loadBatches();
      setNotice(`Inventoried ${file.name}.`);
    });

  const action = (verb: "validate" | "approve" | "commit" | "reverse" | "accept" | "sign-exceptions", body: Record<string, unknown> = {}) =>
    run(async () => {
      if (!selected) return;
      await post(`/imports/migration/batches/${selected.id}/${verb}`, body);
      await loadBatch(selected.id);
      await loadBatches();
      setNotice(`${verb} complete.`);
    });

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">Migration center</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">Legacy System Migration</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Safe, auditable migration from QuickBooks and other systems. Every upload is hashed and inventoried,
          validation never creates missing records silently, the commit is a single all-or-nothing transaction
          that posts through the accounting engine, and a committed batch can be reversed cleanly.
        </p>
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div>}

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-4">
          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">New migration batch</h3>
            <div className="mt-3 space-y-3 text-sm">
              <label className="block">
                <span className="font-semibold text-slate-600">Source system</span>
                <select value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="quickbooks">QuickBooks</option>
                  <option value="xero">Xero</option>
                  <option value="wave">Wave</option>
                  <option value="excel_generic">Generic Excel / CSV</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-600">Label</span>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. QuickBooks export 2026-09" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label className="block">
                <span className="font-semibold text-slate-600">Migration mode</span>
                <select value={migrationMode} onChange={(e) => setMigrationMode(e.target.value as "full_detail" | "cutover")} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
                  <option value="full_detail">Full detail — import all history</option>
                  <option value="cutover">Cutover — open documents + opening balances only</option>
                </select>
              </label>
              <label className="block">
                <span className="font-semibold text-slate-600">Opening balance date (optional)</span>
                <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <button type="button" disabled={busy} onClick={createBatch} className="w-full rounded-xl bg-[#006D77] px-4 py-2 font-bold text-white disabled:opacity-50">
                Create batch
              </button>
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Batches</h3>
            <div className="mt-3 space-y-2">
              {batches.length === 0 && <p className="text-sm text-slate-500">No migration batches yet.</p>}
              {batches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => loadBatch(b.id).catch(() => setError("Could not load batch."))}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${selected?.id === b.id ? "border-[#006D77] bg-[#EAF6F7]" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{b.label || b.sourceSystem}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[b.status] ?? "bg-slate-100 text-slate-600"}`}>{b.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(b.createdAt).toLocaleString()} · {(b.files ?? []).length} file(s)
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {!selected && (
            <div className="rounded-[1.35rem] border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Select or create a batch to manage files, validation, commit, and rollback.
            </div>
          )}

          {selected && (
            <>
              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{selected.label || selected.sourceSystem}</h3>
                    <p className="text-xs text-slate-500">
                      Batch {selected.id.slice(0, 8)}… · {selected.sourceSystem} · {selected.migrationMode === "cutover" ? "cutover" : "full detail"}
                      {selected.exceptionSignature ? ` · exceptions signed by ${selected.exceptionSignature}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLE[selected.status] ?? ""}`}>{selected.status}</span>
                </div>
                {selected.errorSummary && (
                  <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{selected.errorSummary}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {(selected.status === "inventoried" || selected.status === "mapped" || selected.status === "rejected" || selected.status === "validated") && (
                    <button type="button" disabled={busy} onClick={() => action("validate")} className="rounded-xl border border-[#006D77] px-3 py-2 font-bold text-[#006D77] disabled:opacity-50">
                      Validate
                    </button>
                  )}
                  {selected.status === "validated" && (
                    <button type="button" disabled={busy} onClick={() => action("approve")} className="rounded-xl border border-emerald-600 px-3 py-2 font-bold text-emerald-700 disabled:opacity-50">
                      Approve
                    </button>
                  )}
                  {selected.status === "approved" && (
                    <button type="button" disabled={busy} onClick={() => action("commit")} className="rounded-xl bg-[#006D77] px-3 py-2 font-bold text-white disabled:opacity-50">
                      Commit (all-or-nothing)
                    </button>
                  )}
                  {selected.status === "reconciled" && (
                    <button type="button" disabled={busy} onClick={() => action("accept")} className="rounded-xl border border-teal-600 px-3 py-2 font-bold text-teal-700 disabled:opacity-50">
                      Accept reconciliation
                    </button>
                  )}
                  {(selected.status === "reconciled" || selected.status === "accepted") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const reason = window.prompt("Reason for reversal (recorded in the audit log):");
                        if (reason !== null) void action("reverse", { reason });
                      }}
                      className="rounded-xl border border-rose-400 px-3 py-2 font-bold text-rose-600 disabled:opacity-50"
                    >
                      Reverse batch
                    </button>
                  )}
                  <a
                    href={`${apiBase()}/imports/migration/batches/${selected.id}/errors.csv`}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-600"
                  >
                    Download error report
                  </a>
                  <a
                    href={`${apiBase()}/imports/migration/batches/${selected.id}/exception-report.csv`}
                    className="rounded-xl border border-slate-300 px-3 py-2 font-bold text-slate-600"
                  >
                    Exception report
                  </a>
                  {(selected.status === "reconciled" || selected.status === "accepted") && !selected.exceptionSignature && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const signatureText = window.prompt("Type your full name to sign the migration exception report:");
                        if (signatureText) void action("sign-exceptions", { signatureText });
                      }}
                      className="rounded-xl bg-slate-800 px-3 py-2 font-bold text-white disabled:opacity-50"
                    >
                      Sign exceptions
                    </button>
                  )}
                </div>

                {["uploaded", "inventoried", "mapped", "rejected"].includes(selected.status) && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <select value={importType} onChange={(e) => setImportType(e.target.value as typeof importType)} className="rounded-xl border border-slate-200 px-3 py-2">
                        {IMPORT_TYPES.map((t) => (
                          <option key={t} value={t}>{t.replace("_", " ")}</option>
                        ))}
                      </select>
                      <a href={`${apiBase()}/imports/migration/templates/${importType}`} className="text-xs font-bold text-[#006D77] underline">
                        Download {importType.replace("_", " ")} template
                      </a>
                      <label className="cursor-pointer rounded-xl bg-slate-800 px-3 py-2 font-bold text-white">
                        Upload file or ZIP
                        <input
                          type="file"
                          accept=".csv,.xlsx,.zip"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadFile(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Upload order: accounts → customers/vendors → products → invoices/bills → payments → deposits → opening balances.
                      A ZIP export package is expanded automatically — member names must start with the import type (e.g. invoices.csv, bill_payments.xlsx); other files are kept as attachments.
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-900">Files</h3>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-400">
                      <th className="py-2">File</th>
                      <th>Type</th>
                      <th>Disposition</th>
                      <th>Rows</th>
                      <th>Valid</th>
                      <th>Invalid</th>
                      <th>Committed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.files ?? []).map((f) => (
                      <tr key={f.id} className="border-t border-slate-100">
                        <td className="py-2 font-semibold text-slate-700">{f.fileName}</td>
                        <td>{f.importType}</td>
                        <td>
                          <span
                            title={f.dispositionNote ?? undefined}
                            className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                              f.disposition === "imported"
                                ? "bg-emerald-100 text-emerald-700"
                                : f.disposition === "archived"
                                  ? "bg-slate-100 text-slate-600"
                                  : f.disposition === "unsupported"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {f.disposition}
                          </span>
                        </td>
                        <td>{f.rowCount}</td>
                        <td className="text-emerald-700">{f.validCount}</td>
                        <td className={f.invalidCount > 0 ? "font-bold text-rose-600" : ""}>{f.invalidCount}</td>
                        <td>{f.committedCount}</td>
                      </tr>
                    ))}
                    {(selected.files ?? []).length === 0 && (
                      <tr><td colSpan={7} className="py-4 text-center text-slate-400">No files uploaded yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {(selected.reconciliations ?? []).length > 0 && (
                <div className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900">Reconciliation</h3>
                  <table className="mt-3 w-full text-left text-sm">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-400">
                        <th className="py-2">Check</th>
                        <th>Scope</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.reconciliations ?? []).map((r) => (
                        <tr key={r.id} className="border-t border-slate-100">
                          <td className="py-2 font-semibold text-slate-700">{r.checkType}</td>
                          <td>{r.scope}</td>
                          <td>{r.expected}</td>
                          <td>{r.actual}</td>
                          <td>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.status === "matched" || r.status === "accepted" ? "bg-emerald-100 text-emerald-700" : r.status === "discrepancy" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
