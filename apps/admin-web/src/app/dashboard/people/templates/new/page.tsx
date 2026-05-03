"use client";

import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewTemplatePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [nhiRate, setNhiRate] = useState("0.0375");
  const [ssbRate, setSsbRate] = useState("0.04");
  const [incomeTaxRate, setIncomeTaxRate] = useState("0");
  const [applyNhi, setApplyNhi] = useState(true);
  const [applySsb, setApplySsb] = useState(true);
  const [applyIncomeTax, setApplyIncomeTax] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await authenticatedFetch("/people/templates", {
        method: "POST",
      body: JSON.stringify({
          name,
          nhiRate: Number(nhiRate),
          ssbRate: Number(ssbRate),
          incomeTaxRate: Number(incomeTaxRate),
          applyNhi,
          applySsb,
          applyIncomeTax
        })
      });
      const data = (await res.json()) as { error?: string; template?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.template) {
        router.replace(`/dashboard/people/templates/${data.template.id}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-slate-900">New template</h2>
        <Link href="/dashboard/people/templates" className="text-sm font-semibold text-brand hover:underline">
          ← Back
        </Link>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="text-slate-700">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-slate-700">NHI rate (decimal)</span>
            <input type="number" step="0.0001" value={nhiRate} onChange={(e) => setNhiRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">SSB rate</span>
            <input type="number" step="0.0001" value={ssbRate} onChange={(e) => setSsbRate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Income tax rate</span>
            <input
              type="number"
              step="0.0001"
              value={incomeTaxRate}
              onChange={(e) => setIncomeTaxRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={applyNhi} onChange={(e) => setApplyNhi(e.target.checked)} />
            Apply NHI
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={applySsb} onChange={(e) => setApplySsb(e.target.checked)} />
            Apply SSB
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={applyIncomeTax} onChange={(e) => setApplyIncomeTax(e.target.checked)} />
            Apply income tax
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">
          {saving ? "Saving…" : "Create"}
        </button>
      </form>
    </div>
  );
}
