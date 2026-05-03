"use client";

import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { email: string; name: string } | null;
};

export default function AuditPage() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authenticatedFetch("/audit/recent?take=80");
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        const data = (await res.json()) as { items: Row[] };
        if (!cancelled) {
          setItems(data.items);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load audit log");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Compliance</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Audit log</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Recent events (login, registration, and future domain changes). Requires HR / payroll / finance /
            platform role.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm font-semibold text-brand hover:underline">
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No audit entries yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Actor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="text-slate-800">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.entityType}
                    {row.entityId ? (
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">{row.entityId}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {row.actor ? `${row.actor.name} (${row.actor.email})` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
