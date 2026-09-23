"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Employee = { id: string; fullName: string; paySchedule: string; defaultSite?: string };
type Template = { id: string; name: string };
type LocationLine = { id: number; site: string; startTime: string; endTime: string; breakMinutes: string };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftHours(start: string, end: string, breakMinutes: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  minutes -= Math.max(0, Number(breakMinutes) || 0);
  return Math.max(0, Math.round((minutes / 60 + Number.EPSILON) * 100) / 100);
}

export default function NewTimeEntryPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ gross: number; net: number; totalDeductions: number } | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState(todayKey);
  const [locations, setLocations] = useState<LocationLine[]>([
    { id: 1, site: "", startTime: "", endTime: "", breakMinutes: "0" }
  ]);
  const [status, setStatus] = useState("draft");
  const [overtimeHours, setOvertimeHours] = useState("0");
  const [flatGross, setFlatGross] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [allowance, setAllowance] = useState("0");
  const [advanceDeduction, setAdvanceDeduction] = useState("0");
  const [withdrawalDeduction, setWithdrawalDeduction] = useState("0");
  const [loanDeduction, setLoanDeduction] = useState("0");
  const [otherDeduction, setOtherDeduction] = useState("0");
  const [templateId, setTemplateId] = useState("");
  const [applyNhi, setApplyNhi] = useState(true);
  const [applySsb, setApplySsb] = useState(true);
  const [notes, setNotes] = useState("");
  const hoursWorked = useMemo(
    () => locations.reduce((total, location) => total + shiftHours(location.startTime, location.endTime, location.breakMinutes), 0),
    [locations]
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch(`${apiBase()}/people/employees`, { headers: { ...authHeaders() } }),
      fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } })
    ]).then(async ([employeeRes, templateRes]) => {
      if (!employeeRes.ok || !templateRes.ok) throw new Error("Could not load employees or templates.");
      const employeeJson = (await employeeRes.json()) as { items: Employee[] };
      const templateJson = (await templateRes.json()) as { items: Template[] };
      if (cancelled) return;
      setEmployees(employeeJson.items);
      setTemplates(templateJson.items);
      setEmployeeId(employeeJson.items[0]?.id ?? "");
      setLocations([{ id: 1, site: employeeJson.items[0]?.defaultSite ?? "", startTime: "", endTime: "", breakMinutes: "0" }]);
      setTemplateId(templateJson.items[0]?.id ?? "");
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the form.");
    });
    return () => { cancelled = true; };
  }, []);

  const runPreview = useCallback(async () => {
    if (!employeeId || !templateId) return;
    try {
      const res = await fetch(`${apiBase()}/time/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeId, templateId, daysWorked: hoursWorked > 0 ? 1 : 0, hoursWorked,
          overtimeHours: Number(overtimeHours), flatGross: Number(flatGross), bonus: Number(bonus),
          allowance: Number(allowance), advanceDeduction: Number(advanceDeduction),
          withdrawalDeduction: Number(withdrawalDeduction), loanDeduction: Number(loanDeduction),
          otherDeduction: Number(otherDeduction), applyNhi, applySsb, applyIncomeTax: false
        })
      });
      if (!res.ok) return;
      const data = (await res.json()) as { preview: typeof preview };
      setPreview(data.preview);
    } catch {
      setPreview(null);
    }
  }, [employeeId, templateId, hoursWorked, overtimeHours, flatGross, bonus, allowance, advanceDeduction, withdrawalDeduction, loanDeduction, otherDeduction, applyNhi, applySsb]);

  useEffect(() => {
    const timer = setTimeout(runPreview, 250);
    return () => clearTimeout(timer);
  }, [runPreview]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!workDate || locations.some((location) => !location.site.trim() || !location.startTime || !location.endTime)) {
      setError("Enter the work date, location, start time, and finish time for every row.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeId, month: workDate.slice(0, 7), periodStart: workDate, periodEnd: workDate,
          locations: locations.map((location) => ({
            site: location.site.trim(), startTime: location.startTime, endTime: location.endTime,
            breakMinutes: Number(location.breakMinutes)
          })), status,
          overtimeHours: Number(overtimeHours), flatGross: Number(flatGross), bonus: Number(bonus),
          allowance: Number(allowance), advanceDeduction: Number(advanceDeduction),
          withdrawalDeduction: Number(withdrawalDeduction), loanDeduction: Number(loanDeduction),
          otherDeduction: Number(otherDeduction), templateId, applyNhi, applySsb,
          applyIncomeTax: false, notes
        })
      });
      const data = (await res.json()) as { error?: string; entry?: { id: string } };
      if (!res.ok || !data.entry) throw new Error(data.error ?? "Save failed");
      router.replace(`/dashboard/time/entries/${data.entry.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const adjustmentFields: Array<[string, string, (value: string) => void]> = [
    ["Overtime hours", overtimeHours, setOvertimeHours], ["Flat gross override", flatGross, setFlatGross],
    ["Bonus", bonus, setBonus], ["Allowance", allowance, setAllowance],
    ["Advance deduction", advanceDeduction, setAdvanceDeduction],
    ["Withdrawal deduction", withdrawalDeduction, setWithdrawalDeduction],
    ["Loan deduction", loanDeduction, setLoanDeduction], ["Other deduction", otherDeduction, setOtherDeduction]
  ];

  function updateLocation(id: number, field: keyof Omit<LocationLine, "id">, value: string) {
    setLocations((current) => current.map((location) => location.id === id ? { ...location, [field]: value } : location));
  }

  function addLocation() {
    setLocations((current) => [
      ...current,
      { id: Math.max(...current.map((location) => location.id)) + 1, site: "", startTime: "", endTime: "", breakMinutes: "0" }
    ]);
  }

  function removeLocation(id: number) {
    setLocations((current) => current.length > 1 ? current.filter((location) => location.id !== id) : current);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-slate-900">Add work time</h2>
        <Link href="/dashboard/time/entries" className="text-sm font-semibold text-brand hover:underline">{"<-"} Back</Link>
      </div>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1fr,260px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm"><span className="text-slate-700">Employee</span><select required value={employeeId} onChange={(event) => { const id = event.target.value; const defaultSite = employees.find((employee) => employee.id === id)?.defaultSite ?? ""; setEmployeeId(id); setLocations((current) => current.map((location, index) => index === 0 ? { ...location, site: defaultSite } : location)); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select></label>
            <label className="text-sm"><span className="text-slate-700">Work date</span><input type="date" required value={workDate} onChange={(event) => setWorkDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          </div>
          <label className="block max-w-[170px] text-sm"><span className="text-slate-700">Status</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"><option value="draft">Draft</option><option value="submitted">Submitted</option></select></label>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {locations.map((location, index) => (
              <div key={location.id} className="space-y-3 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Location {index + 1}</p>
                  {locations.length > 1 ? <button type="button" onClick={() => removeLocation(location.id)} className="text-sm font-semibold text-red-700 hover:underline">Remove</button> : null}
                </div>
                <label className="block text-sm"><span className="text-slate-700">Work location</span><input required value={location.site} onChange={(event) => updateLocation(location.id, "site", event.target.value)} placeholder="Customer, property, or job site" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                <div className="grid gap-3 sm:grid-cols-4">
                  <label className="text-sm"><span className="text-slate-700">Start time</span><input type="time" required value={location.startTime} onChange={(event) => updateLocation(location.id, "startTime", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                  <label className="text-sm"><span className="text-slate-700">Finish time</span><input type="time" required value={location.endTime} onChange={(event) => updateLocation(location.id, "endTime", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                  <label className="text-sm"><span className="text-slate-700">Break minutes</span><input type="number" min="0" step="1" value={location.breakMinutes} onChange={(event) => updateLocation(location.id, "breakMinutes", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                  <label className="text-sm"><span className="text-slate-700">Hours</span><output className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">{shiftHours(location.startTime, location.endTime, location.breakMinutes).toFixed(2)}</output></label>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={addLocation} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-slate-50">+ Add location</button>
            <p className="text-sm font-semibold text-slate-800">Total hours: {hoursWorked.toFixed(2)}</p>
          </div>
          <label className="block text-sm"><span className="text-slate-700">Notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
          <details className="rounded-lg border border-slate-200 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Payroll adjustments</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {adjustmentFields.map(([label, value, setter]) => <label key={label} className="text-sm"><span className="text-slate-700">{label}</span><input type="number" min="0" step="0.01" value={value} onChange={(event) => setter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>)}
              <label className="text-sm sm:col-span-2"><span className="text-slate-700">Deduction template</span><select required value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2">{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
              <div className="flex gap-4 text-sm sm:col-span-2"><label className="flex items-center gap-2"><input type="checkbox" checked={applyNhi} onChange={(event) => setApplyNhi(event.target.checked)} /> NHI</label><label className="flex items-center gap-2"><input type="checkbox" checked={applySsb} onChange={(event) => setApplySsb(event.target.checked)} /> SSB</label></div>
            </div>
          </details>
          <button type="submit" disabled={saving || !employeeId || !templateId} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Save work time"}</button>
        </form>
        <aside className="h-fit rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-800">Pay preview</p>
          {!preview ? <p className="mt-2 text-slate-600">Select employee and times.</p> : <ul className="mt-3 space-y-1 text-slate-700"><li>Gross: {preview.gross.toFixed(2)}</li><li>Deductions: {preview.totalDeductions.toFixed(2)}</li><li className="font-semibold">Net: {preview.net.toFixed(2)}</li></ul>}
        </aside>
      </div>
    </div>
  );
}
