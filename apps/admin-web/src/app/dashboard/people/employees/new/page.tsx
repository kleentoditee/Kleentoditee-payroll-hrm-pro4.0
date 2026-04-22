"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Template = { id: string; name: string };

export default function NewEmployeePage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [defaultSite, setDefaultSite] = useState("");
  const [phone, setPhone] = useState("");
  const [basePayType, setBasePayType] = useState<"daily" | "hourly" | "fixed">("daily");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("0");
  const [fixedPay, setFixedPay] = useState("0");
  const [standardDays, setStandardDays] = useState("20");
  const [standardHours, setStandardHours] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } });
        if (!res.ok) {
          throw new Error("Could not load templates");
        }
        const data = (await res.json()) as { items: Template[] };
        if (!cancelled) {
          setTemplates(data.items);
          if (data.items[0]) {
            setTemplateId(data.items[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Load templates failed. Is the API running?");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase()}/people/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          fullName,
          role,
          defaultSite,
          phone,
          basePayType,
          dailyRate: Number(dailyRate),
          hourlyRate: Number(hourlyRate),
          overtimeRate: Number(overtimeRate),
          fixedPay: Number(fixedPay),
          standardDays: Number(standardDays),
          standardHours: Number(standardHours),
          templateId,
          notes,
          active
        })
      });
      const data = (await res.json()) as { error?: string; employee?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.employee) {
        router.replace(`/dashboard/people/employees/${data.employee.id}`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl text-slate-900">New employee</h2>
        <Link href="/dashboard/people/employees" className="text-sm font-semibold text-brand hover:underline">
          ← Back
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="text-slate-700">Full name</span>
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Role</span>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Default site</span>
            <input
              value={defaultSite}
              onChange={(e) => setDefaultSite(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Pay basis</span>
          <select
            value={basePayType}
            onChange={(e) => setBasePayType(e.target.value as typeof basePayType)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="daily">Daily rate</option>
            <option value="hourly">Hourly</option>
            <option value="fixed">Fixed monthly</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-700">Daily rate</span>
            <input
              type="number"
              step="0.01"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Hourly rate</span>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Overtime rate</span>
            <input
              type="number"
              step="0.01"
              value={overtimeRate}
              onChange={(e) => setOvertimeRate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Fixed pay</span>
            <input
              type="number"
              step="0.01"
              value={fixedPay}
              onChange={(e) => setFixedPay(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Standard days</span>
            <input
              type="number"
              step="0.5"
              value={standardDays}
              onChange={(e) => setStandardDays(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Standard hours</span>
            <input
              type="number"
              step="0.5"
              value={standardHours}
              onChange={(e) => setStandardHours(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-slate-700">Deduction template</span>
          <select
            required
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active for payroll
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" />
        </label>
        <button
          type="submit"
          disabled={saving || !templateId}
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Create employee"}
        </button>
      </form>
    </div>
  );
}
