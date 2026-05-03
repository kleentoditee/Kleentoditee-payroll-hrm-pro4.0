"use client";

import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  name: string;
  nhiRate: number;
  ssbRate: number;
  incomeTaxRate: number;
  applyNhi: boolean;
  applySsb: boolean;
  applyIncomeTax: boolean;
};

export default function TemplatesListPage() {
  const [items, setItems] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await authenticatedFetch("/people/templates");
      if (!res.ok) {
        throw new Error("Failed to load");
      }
      const data = (await res.json()) as { items: Row[] };
      setItems(data.items);
      setError(null);
    } catch {
      setError("Could not load templates.");
      setItems(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this template? Employees must not be using it.")) {
      return;
    }
    const res = await authenticatedFetch(`/people/templates/${id}`, {
      method: "DELETE"
    });
    if (res.status === 409) {
      const j = (await res.json()) as { error?: string };
      setError(j.error ?? "In use");
      return;
    }
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">People</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Deduction templates</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            NHI / SSB / income tax defaults for timesheets (rates are illustrative until compliance review).
          </p>
        </div>
        <Link
          href="/dashboard/people/templates/new"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft"
        >
          Add template
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {!items ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
          {items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div>
                <p className="font-medium text-slate-900">{t.name}</p>
                <p className="text-sm text-slate-600">
                  NHI {(t.nhiRate * 100).toFixed(2)}% · SSB {(t.ssbRate * 100).toFixed(2)}% · Tax{" "}
                  {(t.incomeTaxRate * 100).toFixed(2)}%
                </p>
                <p className="text-xs text-slate-500">
                  Apply: {t.applyNhi ? "NHI " : ""}
                  {t.applySsb ? "SSB " : ""}
                  {t.applyIncomeTax ? "Tax" : ""}
                  {!t.applyNhi && !t.applySsb && !t.applyIncomeTax ? "none" : ""}
                </p>
              </div>
              <div className="flex gap-3">
                <Link href={`/dashboard/people/templates/${t.id}`} className="text-sm font-semibold text-brand hover:underline">
                  Edit
                </Link>
                <button type="button" onClick={() => remove(t.id)} className="text-sm font-semibold text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
