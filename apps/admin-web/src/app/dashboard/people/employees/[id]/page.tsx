"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Template = { id: string; name: string };

type Employee = {
  id: string;
  fullName: string;
  role: string;
  defaultSite: string;
  phone: string;
  basePayType: "daily" | "hourly" | "fixed";
  paySchedule: "weekly" | "biweekly" | "monthly";
  dailyRate: number;
  hourlyRate: number;
  overtimeRate: number;
  fixedPay: number;
  standardDays: number;
  standardHours: number;
  templateId: string;
  active: boolean;
  notes: string;
};

export default function EditEmployeePage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [defaultSite, setDefaultSite] = useState("");
  const [phone, setPhone] = useState("");
  const [basePayType, setBasePayType] = useState<"daily" | "hourly" | "fixed">("daily");
  const [paySchedule, setPaySchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("0");
  const [fixedPay, setFixedPay] = useState("0");
  const [standardDays, setStandardDays] = useState("0");
  const [standardHours, setStandardHours] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [templateRes, employeeRes] = await Promise.all([
          fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/people/employees/${id}`, { headers: { ...authHeaders() } })
        ]);
        if (!templateRes.ok || !employeeRes.ok) {
          throw new Error("Failed to load");
        }
        const templateData = (await templateRes.json()) as { items: Template[] };
        const employeeData = (await employeeRes.json()) as { employee: Employee };
        if (cancelled) {
          return;
        }
        setTemplates(templateData.items);
        const employee = employeeData.employee;
        setFullName(employee.fullName);
        setRole(employee.role);
        setDefaultSite(employee.defaultSite);
        setPhone(employee.phone);
        setBasePayType(employee.basePayType);
        setPaySchedule(employee.paySchedule);
        setDailyRate(String(employee.dailyRate));
        setHourlyRate(String(employee.hourlyRate));
        setOvertimeRate(String(employee.overtimeRate));
        setFixedPay(String(employee.fixedPay));
        setStandardDays(String(employee.standardDays));
        setStandardHours(String(employee.standardHours));
        setTemplateId(employee.templateId);
        setNotes(employee.notes);
        setActive(employee.active);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Could not load employee.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase()}/people/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          fullName,
          role,
          defaultSite,
          phone,
          basePayType,
          paySchedule,
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this employee? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`${apiBase()}/people/employees/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Delete failed");
      return;
    }
    router.replace("/dashboard/people/employees");
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-serif text-xl text-slate-900">Edit employee</h2>
        <Link href="/dashboard/people/employees" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back
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
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
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
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
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
          <label className="block text-sm">
            <span className="text-slate-700">Pay schedule</span>
            <select
              value={paySchedule}
              onChange={(e) => setPaySchedule(e.target.value as typeof paySchedule)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
            </select>
          </label>
        </div>
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
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  );
}
