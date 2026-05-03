"use client";

import { authenticatedFetch } from "@/lib/api";
import { canViewEmployeePii } from "@/lib/hr-roles";
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
  const [paySchedule, setPaySchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("0");
  const [fixedPay, setFixedPay] = useState("0");
  const [standardDays, setStandardDays] = useState("20");
  const [standardHours, setStandardHours] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [meRoles, setMeRoles] = useState<string[] | null>(null);
  const [empStart, setEmpStart] = useState("");
  const [empEnd, setEmpEnd] = useState("");
  const [wpExp, setWpExp] = useState("");
  const [ssn, setSsn] = useState("");
  const [nhi, setNhi] = useState("");
  const [ird, setIrd] = useState("");
  const [workPermit, setWorkPermit] = useState("");

  const canPii = canViewEmployeePii(meRoles ?? undefined) && meRoles != null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, meRes] = await Promise.all([
          authenticatedFetch("/people/templates"),
          authenticatedFetch("/auth/me")
        ]);
        if (!res.ok) {
          throw new Error("Could not load templates");
        }
        const data = (await res.json()) as { items: Template[] };
        if (meRes.ok) {
          const me = (await meRes.json()) as { user: { roles: string[] } };
          if (!cancelled) {
            setMeRoles(me.user.roles);
          }
        } else if (!cancelled) {
          setMeRoles([]);
        }
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
      const body: Record<string, unknown> = {
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
        active,
        employmentStartDate: empStart || null,
        employmentEndDate: empEnd || null,
        workPermitExpiryDate: wpExp || null
      };
      if (canPii) {
        body.socialSecurityNumber = ssn;
        body.nationalHealthInsuranceNumber = nhi;
        body.inlandRevenueDepartmentNumber = ird;
        body.workPermitNumber = workPermit;
      }
      const res = await authenticatedFetch("/people/employees", {
        method: "POST",
      body: JSON.stringify(body)
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
        <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Employment (optional)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Employment start</span>
              <input type="date" value={empStart} onChange={(e) => setEmpStart(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Employment end</span>
              <input type="date" value={empEnd} onChange={(e) => setEmpEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-slate-700">Work permit expiry</span>
              <input type="date" value={wpExp} onChange={(e) => setWpExp(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
          </div>
        </div>
        {meRoles && canPii ? (
          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Government IDs (optional)</p>
            <p className="text-xs text-slate-500">Only platform owner, hr_admin, and payroll_admin can set these on create.</p>
            <label className="block text-sm">
              <span className="text-slate-700">SSN</span>
              <input value={ssn} onChange={(e) => setSsn(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">NHI</span>
              <input value={nhi} onChange={(e) => setNhi(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">IRD</span>
              <input value={ird} onChange={(e) => setIrd(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Work permit #</span>
              <input value={workPermit} onChange={(e) => setWorkPermit(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2" />
            </label>
          </div>
        ) : meRoles && !canPii ? (
          <p className="text-xs text-slate-500">SSN, NHI, and IRD can be added after creation by a platform owner or HR/payroll role.</p>
        ) : null}
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
        <button
          type="submit"
          disabled={saving || !templateId}
          className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Create employee"}
        </button>
      </form>
    </div>
  );
}
