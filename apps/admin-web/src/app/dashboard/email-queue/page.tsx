"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useRef, useState } from "react";

type EmailRow = {
  id: string;
  createdAt: string;
  toEmail: string;
  subject: string;
  template: string;
  status: "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: string;
  sentAt: string | null;
  orgId: string | null;
};

type QueueData = {
  items: EmailRow[];
  summary: { queued: number; sent: number; failed: number; smtpConfigured: boolean };
};

const STATUS_STYLE: Record<EmailRow["status"], string> = {
  QUEUED: "bg-amber-100 text-amber-800",
  SENT: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-200 text-slate-500"
};

export default function EmailQueuePage() {
  const [data, setData] = useState<QueueData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const res = await fetch(`${apiBase()}/admin/email-queue${filter ? `?status=${filter}` : ""}`, {
        headers: { ...authHeaders() }
      });
      const queue = await readApiData<QueueData>(res);
      if (seq !== loadSeq.current) return; // a newer load superseded this one
      setData(queue);
      setError(null);
    } catch (e) {
      if (seq === loadSeq.current) setError(e instanceof Error ? e.message : "Failed to load email queue");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post(path: string, okMessage: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/admin${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: "{}"
      });
      await readApiData(res);
      setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Email queue</h1>
        <p className="text-sm text-slate-600">
          Transactional email is queued, then delivered by the background worker with retry and backoff. This
          table is the delivery log — nothing sends without a row here.
        </p>
      </div>

      {data ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${data.summary.smtpConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            SMTP {data.summary.smtpConfigured ? "configured" : "not configured — messages stay queued"}
          </span>
          <span>Queued <strong>{data.summary.queued}</strong></span>
          <span>Sent <strong>{data.summary.sent}</strong></span>
          <span>Failed <strong>{data.summary.failed}</strong></span>
          <span className="flex-1" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <button
            disabled={busy}
            onClick={() => void post("/email-queue/process", "Queue flush requested.")}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Process now
          </button>
        </div>
      ) : null}

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}
      {!data && !error ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {data && data.items.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No email messages{filter ? ` with status ${filter}` : ""} yet.
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Attempts</th>
                <th className="px-3 py-2">Last error</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 text-slate-600">{m.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-3 py-2">{m.toEmail}</td>
                  <td className="px-3 py-2 text-slate-600">{m.subject}</td>
                  <td className="px-3 py-2 text-slate-600">{m.template}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{m.attempts}/{m.maxAttempts}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-xs text-rose-700" title={m.lastError ?? ""}>
                    {m.lastError ?? ""}
                  </td>
                  <td className="px-3 py-2">
                    {m.status === "FAILED" ? (
                      <button
                        disabled={busy}
                        onClick={() => void post(`/email-queue/${m.id}/retry`, "Message re-queued.")}
                        className="text-brand hover:underline"
                      >
                        Retry
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
