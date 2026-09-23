"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { canViewEmployeePii } from "@/lib/hr-roles";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Template = { id: string; name: string };
type WorkAuthorizationStatus = "NOT_SPECIFIED" | "WORK_PERMIT" | "BELONGER" | "RESIDENT" | "BV_ISLANDER";
type FormTab = "profile" | "employment" | "payroll" | "ids" | "notes";

const tabs: Array<{ id: FormTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "employment", label: "Employment" },
  { id: "payroll", label: "Payroll" },
  { id: "ids", label: "Government IDs" },
  { id: "notes", label: "Notes" }
];

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 outline-none ring-brand focus:ring-2";

export default function NewEmployeePage() {
  const router = useRouter();
  const [tab, setTab] = useState<FormTab>("profile");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [meRoles, setMeRoles] = useState<string[] | null>(null);

  const [fullName, setFullName] = useState("");
  const [sex, setSex] = useState<"" | "M" | "F">("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [defaultSite, setDefaultSite] = useState("");
  const [empStart, setEmpStart] = useState("");
  const [empEnd, setEmpEnd] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<"current" | "ended">("current");
  const [workAuthorizationStatus, setWorkAuthorizationStatus] = useState<WorkAuthorizationStatus>("NOT_SPECIFIED");
  const [wpExp, setWpExp] = useState("");
  const [workPermit, setWorkPermit] = useState("");
  const [basePayType, setBasePayType] = useState<"daily" | "hourly" | "fixed">("daily");
  const [paySchedule, setPaySchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [overtimeRate, setOvertimeRate] = useState("0");
  const [fixedPay, setFixedPay] = useState("0");
  const [standardDays, setStandardDays] = useState("20");
  const [standardHours, setStandardHours] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [active, setActive] = useState(true);
  const [payrollTaxExemptionEnabled, setPayrollTaxExemptionEnabled] = useState(true);
  const [ssn, setSsn] = useState("");
  const [nhi, setNhi] = useState("");
  const [nhiUnemployedSpouse, setNhiUnemployedSpouse] = useState(false);
  const [ird, setIrd] = useState("");
  const [notes, setNotes] = useState("");

  const canPii = canViewEmployeePii(meRoles ?? undefined) && meRoles != null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [templateRes, meRes] = await Promise.all([
          fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/auth/me`, { headers: { ...authHeaders() } })
        ]);
        if (!templateRes.ok) throw new Error();
        const templateData = (await templateRes.json()) as { items: Template[] };
        const roles = meRes.ok
          ? ((await meRes.json()) as { user: { roles: string[] } }).user.roles
          : [];
        if (!cancelled) {
          setTemplates(templateData.items);
          setTemplateId(templateData.items[0]?.id ?? "");
          setMeRoles(roles);
        }
      } catch {
        if (!cancelled) setError("Could not load employee setup.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function moveTab(direction: -1 | 1) {
    const index = tabs.findIndex((item) => item.id === tab);
    setTab(tabs[Math.max(0, Math.min(tabs.length - 1, index + direction))].id);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setTab("profile");
      setError("Full name is required.");
      return;
    }
    if (!email.trim()) {
      setTab("profile");
      setError("Email is required.");
      return;
    }
    if (employmentStatus === "ended" && !empEnd) {
      setTab("employment");
      setError("Select the employment end date.");
      return;
    }
    if (empStart && empEnd && empEnd < empStart) {
      setTab("employment");
      setError("Employment end date cannot be before the start date.");
      return;
    }
    if (workAuthorizationStatus === "WORK_PERMIT" && (!workPermit.trim() || !wpExp)) {
      setTab("employment");
      setError("Enter the work permit number and expiry date.");
      return;
    }
    if (!templateId) {
      setTab("payroll");
      setError("Select a deduction template.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        fullName,
        sex,
        email,
        phone,
        role,
        defaultSite,
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
        active: employmentStatus === "current" ? active : false,
        payrollTaxExemptionEnabled,
        nhiUnemployedSpouse,
        employmentStartDate: empStart || null,
        employmentEndDate: employmentStatus === "ended" ? empEnd : null,
        workAuthorizationStatus,
        workPermitExpiryDate: workAuthorizationStatus === "WORK_PERMIT" ? wpExp || null : null
      };
      if (canPii) {
        body.socialSecurityNumber = ssn;
        body.nationalHealthInsuranceNumber = nhi;
        body.inlandRevenueDepartmentNumber = ird;
        body.workPermitNumber = workAuthorizationStatus === "WORK_PERMIT" ? workPermit : "";
      }
      const res = await fetch(`${apiBase()}/people/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { error?: string; employee?: { id: string } };
      if (!res.ok || !data.employee) {
        setError(data.error ?? "Could not create employee.");
        return;
      }
      router.replace(`/dashboard/people/employees/${data.employee.id}`);
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-xl text-slate-900">Create employee</h2>
        <Link href="/dashboard/people/employees" className="text-sm font-semibold text-brand hover:underline">
          Back
        </Link>
      </div>

      <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-slate-200 px-3 pt-3">
          <div className="flex min-w-max gap-1" role="tablist" aria-label="Employee form sections">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={`border-b-2 px-3 py-2 text-sm font-semibold ${
                  tab === item.id
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[330px] p-5">
          {error ? (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          {tab === "profile" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span>Full name</span>
                <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>Sex (government forms)</span>
                <select value={sex} onChange={(e) => setSex(e.target.value as typeof sex)} className={inputClass}>
                  <option value="">Select</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                </select>
              </label>
              <label className="block text-sm">
                <span>Email</span>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>Phone</span>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>Role</span>
                <input value={role} onChange={(e) => setRole(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>Default site</span>
                <input value={defaultSite} onChange={(e) => setDefaultSite(e.target.value)} className={inputClass} />
              </label>
            </div>
          ) : null}

          {tab === "employment" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span>Start date</span>
                <input type="date" value={empStart} onChange={(e) => setEmpStart(e.target.value)} className={inputClass} />
              </label>
              <label className="block text-sm">
                <span>Employment status</span>
                <select
                  value={employmentStatus}
                  onChange={(e) => {
                    const value = e.target.value as "current" | "ended";
                    setEmploymentStatus(value);
                    if (value === "current") setEmpEnd("");
                    else setActive(false);
                  }}
                  className={inputClass}
                >
                  <option value="current">Current worker</option>
                  <option value="ended">Employment ended</option>
                </select>
              </label>
              {employmentStatus === "ended" ? (
                <label className="block text-sm">
                  <span>End date</span>
                  <input required type="date" value={empEnd} onChange={(e) => setEmpEnd(e.target.value)} className={inputClass} />
                </label>
              ) : null}
              <label className="block text-sm">
                <span>Immigration / work status</span>
                <select
                  value={workAuthorizationStatus}
                  onChange={(e) => {
                    const value = e.target.value as WorkAuthorizationStatus;
                    setWorkAuthorizationStatus(value);
                    if (value !== "WORK_PERMIT") {
                      setWorkPermit("");
                      setWpExp("");
                    }
                  }}
                  className={inputClass}
                >
                  <option value="NOT_SPECIFIED">Not specified</option>
                  <option value="WORK_PERMIT">Work permit</option>
                  <option value="BELONGER">Belonger</option>
                  <option value="RESIDENT">Resident</option>
                  <option value="BV_ISLANDER">BVIslander</option>
                </select>
              </label>
              {workAuthorizationStatus === "WORK_PERMIT" ? (
                <>
                  <label className="block text-sm">
                    <span>Work permit number</span>
                    <input
                      required
                      value={workPermit}
                      onChange={(e) => setWorkPermit(e.target.value)}
                      placeholder="Enter permit number"
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm">
                    <span>Permit expiry</span>
                    <input required type="date" value={wpExp} onChange={(e) => setWpExp(e.target.value)} className={inputClass} />
                  </label>
                </>
              ) : null}
            </div>
          ) : null}

          {tab === "payroll" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm">
                <span>Pay basis</span>
                <select value={basePayType} onChange={(e) => setBasePayType(e.target.value as typeof basePayType)} className={inputClass}>
                  <option value="daily">Daily rate</option>
                  <option value="hourly">Hourly</option>
                  <option value="fixed">Fixed pay per period</option>
                </select>
              </label>
              <label className="block text-sm">
                <span>Pay schedule</span>
                <select value={paySchedule} onChange={(e) => setPaySchedule(e.target.value as typeof paySchedule)} className={inputClass}>
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                </select>
              </label>
              <label className="block text-sm">
                <span>Deduction template</span>
                <select required value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </label>
              {[
                ["Daily rate", dailyRate, setDailyRate],
                ["Hourly rate", hourlyRate, setHourlyRate],
                ["Overtime rate", overtimeRate, setOvertimeRate],
                ["Fixed pay", fixedPay, setFixedPay],
                ["Standard days", standardDays, setStandardDays],
                ["Standard hours", standardHours, setStandardHours]
              ].map(([label, value, setter]) => (
                <label key={label as string} className="block text-sm">
                  <span>{label as string}</span>
                  <input
                    type="number"
                    min="0"
                    step={(label as string).startsWith("Standard") ? "0.5" : "0.01"}
                    value={value as string}
                    onChange={(e) => (setter as (value: string) => void)(e.target.value)}
                    className={inputClass}
                  />
                </label>
              ))}
              {employmentStatus === "current" ? (
                <label className="flex items-center gap-2 text-sm sm:col-span-3">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                  Included in payroll
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <input type="checkbox" checked={payrollTaxExemptionEnabled} onChange={(e) => setPayrollTaxExemptionEnabled(e.target.checked)} />
                Apply annual payroll tax exemption to this employee
              </label>
            </div>
          ) : null}

          {tab === "ids" ? (
            canPii ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm"><span>SSN</span><input value={ssn} onChange={(e) => setSsn(e.target.value)} className={inputClass} /></label>
                <label className="block text-sm"><span>NHI number</span><input value={nhi} onChange={(e) => setNhi(e.target.value)} className={inputClass} /></label>
                <label className="block text-sm"><span>IRD number</span><input value={ird} onChange={(e) => setIrd(e.target.value)} className={inputClass} /></label>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={nhiUnemployedSpouse} onChange={(e) => setNhiUnemployedSpouse(e.target.checked)} />
                  Include unemployed spouse NHI contribution
                </label>
              </div>
            ) : (
              <p className="text-sm text-slate-600">Government IDs require HR or payroll access.</p>
            )
          ) : null}

          {tab === "notes" ? (
            <label className="block text-sm">
              <span>Internal notes</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={7} className={inputClass} />
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3">
          <div className="flex gap-2">
            <button type="button" disabled={tab === tabs[0].id} onClick={() => moveTab(-1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">Back</button>
            <button type="button" disabled={tab === tabs[tabs.length - 1].id} onClick={() => moveTab(1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
          </div>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? "Saving..." : "Create employee"}
          </button>
        </div>
      </form>
    </div>
  );
}
