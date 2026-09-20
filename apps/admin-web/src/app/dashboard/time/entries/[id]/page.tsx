"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Template = { id: string; name: string };
type LocationLine = { id: number; site: string; startTime: string; endTime: string; breakMinutes: string };

type Entry = {
  id: string;
  employeeId: string;
  month: string;
  periodStart: string | null;
  periodEnd: string | null;
  site: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  flatGross: number;
  bonus: number;
  allowance: number;
  advanceDeduction: number;
  withdrawalDeduction: number;
  loanDeduction: number;
  otherDeduction: number;
  templateId: string;
  applyNhi: boolean;
  applySsb: boolean;
  applyIncomeTax: boolean;
  notes: string;
};

function calculateShiftHours(start: string, end: string, breakValue: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  minutes -= Math.max(0, Number(breakValue) || 0);
  return Math.max(0, Math.round((minutes / 60 + Number.EPSILON) * 100) / 100);
}

export default function EditTimeEntryPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ gross: number; net: number; totalDeductions: number } | null>(null);

  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [site, setSite] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [status, setStatus] = useState("draft");
  const [originalStatus, setOriginalStatus] = useState("draft");
  const [daysWorked, setDaysWorked] = useState("0");
  const [hoursWorked, setHoursWorked] = useState("0");
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
  const [employeeName, setEmployeeName] = useState("");
  const [additionalLocations, setAdditionalLocations] = useState<LocationLine[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [templateRes, entryRes] = await Promise.all([
          fetch(`${apiBase()}/people/templates`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/time/entries/${id}`, { headers: { ...authHeaders() } })
        ]);
        if (!templateRes.ok || !entryRes.ok) {
          throw new Error("load");
        }
        const templateJson = (await templateRes.json()) as { items: Template[] };
        const entryJson = (await entryRes.json()) as { entry: Entry & { employee: { fullName: string } } };
        if (cancelled) {
          return;
        }
        setTemplates(templateJson.items);
        const entry = entryJson.entry;
        setEmployeeId(entry.employeeId);
        setEmployeeName(entry.employee.fullName);
        setMonth(entry.month);
        setPeriodStart(entry.periodStart ? entry.periodStart.slice(0, 10) : "");
        setPeriodEnd(entry.periodStart ? entry.periodStart.slice(0, 10) : "");
        setSite(entry.site);
        setStartTime(entry.startTime);
        setEndTime(entry.endTime);
        setBreakMinutes(String(entry.breakMinutes));
        setStatus(entry.status);
        setOriginalStatus(entry.status);
        setDaysWorked(String(entry.daysWorked));
        setHoursWorked(String(entry.hoursWorked));
        setOvertimeHours(String(entry.overtimeHours));
        setFlatGross(String(entry.flatGross));
        setBonus(String(entry.bonus));
        setAllowance(String(entry.allowance));
        setAdvanceDeduction(String(entry.advanceDeduction));
        setWithdrawalDeduction(String(entry.withdrawalDeduction));
        setLoanDeduction(String(entry.loanDeduction));
        setOtherDeduction(String(entry.otherDeduction));
        setTemplateId(entry.templateId);
        setApplyNhi(entry.applyNhi);
        setApplySsb(entry.applySsb);
        setNotes(entry.notes);
        setError(null);
      } catch {
        if (!cancelled) {
          setError("Could not load timesheet.");
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

  const runPreview = useCallback(async () => {
    if (!employeeId || !templateId) {
      return;
    }
    try {
      const res = await fetch(`${apiBase()}/time/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          employeeId,
          templateId,
          daysWorked: Number(daysWorked),
          hoursWorked: Number(hoursWorked),
          overtimeHours: Number(overtimeHours),
          flatGross: Number(flatGross),
          bonus: Number(bonus),
          allowance: Number(allowance),
          advanceDeduction: Number(advanceDeduction),
          withdrawalDeduction: Number(withdrawalDeduction),
          loanDeduction: Number(loanDeduction),
          otherDeduction: Number(otherDeduction),
          applyNhi,
          applySsb,
          applyIncomeTax: false
        })
      });
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { preview: typeof preview };
      setPreview(data.preview);
    } catch {
      setPreview(null);
    }
  }, [
    employeeId,
    templateId,
    daysWorked,
    hoursWorked,
    overtimeHours,
    flatGross,
    bonus,
    allowance,
    advanceDeduction,
    withdrawalDeduction,
    loanDeduction,
    otherDeduction,
    applyNhi,
    applySsb
  ]);

  useEffect(() => {
    const t = setTimeout(runPreview, 300);
    return () => clearTimeout(t);
  }, [runPreview]);

  useEffect(() => {
    if (!startTime || !endTime) return;
    const calculated = calculateShiftHours(startTime, endTime, breakMinutes);
    setHoursWorked(String(calculated));
    setDaysWorked(calculated > 0 ? "1" : "0");
  }, [startTime, endTime, breakMinutes]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/entries/${id}/locations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          month,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          site,
          startTime,
          endTime,
          breakMinutes: Number(breakMinutes),
          locations: [
            { site, startTime, endTime, breakMinutes: Number(breakMinutes) },
            ...additionalLocations.map((location) => ({
              site: location.site, startTime: location.startTime, endTime: location.endTime,
              breakMinutes: Number(location.breakMinutes)
            }))
          ],
          status,
          daysWorked: Number(daysWorked),
          hoursWorked: Number(hoursWorked),
          overtimeHours: Number(overtimeHours),
          flatGross: Number(flatGross),
          bonus: Number(bonus),
          allowance: Number(allowance),
          advanceDeduction: Number(advanceDeduction),
          withdrawalDeduction: Number(withdrawalDeduction),
          loanDeduction: Number(loanDeduction),
          otherDeduction: Number(otherDeduction),
          templateId,
          applyNhi,
          applySsb,
          applyIncomeTax: false,
          notes
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
    if (!window.confirm("Delete this timesheet?")) {
      return;
    }
    const res = await fetch(`${apiBase()}/time/entries/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    router.replace("/dashboard/time/entries");
  }

  function updateAdditionalLocation(id: number, field: keyof Omit<LocationLine, "id">, value: string) {
    setAdditionalLocations((current) => current.map((location) => location.id === id ? { ...location, [field]: value } : location));
  }

  function addLocation() {
    setAdditionalLocations((current) => [
      ...current,
      { id: (current.at(-1)?.id ?? 1) + 1, site: "", startTime: "", endTime: "", breakMinutes: "0" }
    ]);
  }

  function removeLocation(id: number) {
    setAdditionalLocations((current) => current.filter((location) => location.id !== id));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  const locked = originalStatus === "approved" || originalStatus === "paid";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-slate-900">Edit work time</h2>
          <p className="text-sm text-slate-600">{employeeName}</p>
        </div>
        <Link href="/dashboard/time/entries" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      {locked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This timesheet is {originalStatus} and is locked. Amounts and status can no longer be edited; reverse
          the pay run if changes are required.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <fieldset disabled={locked} className="space-y-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Work date</span>
              <input
                type="date"
                required
                value={periodStart}
                onChange={(e) => {
                  setPeriodStart(e.target.value);
                  setPeriodEnd(e.target.value);
                  setMonth(e.target.value.slice(0, 7));
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Work location</span>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder="Customer, property, or job site"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-slate-700">Start time</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Finish time</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Break minutes</span>
              <input
                type="number"
                min="0"
                step="1"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          {additionalLocations.map((location, index) => (
            <div key={location.id} className="space-y-3 border-t border-slate-200 pt-4">
              <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Location {index + 2}</p><button type="button" onClick={() => removeLocation(location.id)} className="text-sm font-semibold text-red-700 hover:underline">Remove</button></div>
              <label className="block text-sm"><span className="text-slate-700">Work location</span><input required value={location.site} onChange={(event) => updateAdditionalLocation(location.id, "site", event.target.value)} placeholder="Customer, property, or job site" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-sm"><span className="text-slate-700">Start time</span><input type="time" required value={location.startTime} onChange={(event) => updateAdditionalLocation(location.id, "startTime", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                <label className="text-sm"><span className="text-slate-700">Finish time</span><input type="time" required value={location.endTime} onChange={(event) => updateAdditionalLocation(location.id, "endTime", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                <label className="text-sm"><span className="text-slate-700">Break minutes</span><input type="number" min="0" step="1" value={location.breakMinutes} onChange={(event) => updateAdditionalLocation(location.id, "breakMinutes", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
                <label className="text-sm"><span className="text-slate-700">Hours</span><output className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">{calculateShiftHours(location.startTime, location.endTime, location.breakMinutes).toFixed(2)}</output></label>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={addLocation} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-slate-50">+ Add location</button>
            <p className="text-sm font-semibold text-slate-800">Total hours: {(Number(hoursWorked) + additionalLocations.reduce((total, location) => total + calculateShiftHours(location.startTime, location.endTime, location.breakMinutes), 0)).toFixed(2)}</p>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <details className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-slate-800">Payroll adjustments</summary>
            <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="text-slate-700">OT hours</span><input type="number" step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" /></label>
            <label className="block text-sm">
              <span className="text-slate-700">Flat gross</span>
              <input
                type="number"
                step="0.01"
                value={flatGross}
                onChange={(e) => setFlatGross(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Bonus</span>
              <input
                type="number"
                step="0.01"
                value={bonus}
                onChange={(e) => setBonus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Allowance</span>
              <input
                type="number"
                step="0.01"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Advance deduction</span>
              <input
                type="number"
                step="0.01"
                value={advanceDeduction}
                onChange={(e) => setAdvanceDeduction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Withdrawal deduction</span>
              <input
                type="number"
                step="0.01"
                value={withdrawalDeduction}
                onChange={(e) => setWithdrawalDeduction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Loan deduction</span>
              <input
                type="number"
                step="0.01"
                value={loanDeduction}
                onChange={(e) => setLoanDeduction(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Other deduction</span>
              <input
                type="number"
                step="0.01"
                value={otherDeduction}
                onChange={(e) => setOtherDeduction(e.target.value)}
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
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={applyNhi} onChange={(e) => setApplyNhi(e.target.checked)} />
              NHI
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={applySsb} onChange={(e) => setApplySsb(e.target.checked)} />
              SSB
            </label>
          </div>
            </div>
          </details>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || locked}
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
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

        <aside className="h-fit rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
          <p className="font-semibold text-slate-800">Live preview</p>
          {!preview ? (
            <p className="mt-2 text-slate-600">...</p>
          ) : (
            <ul className="mt-3 space-y-1 text-slate-700">
              <li>Gross: {preview.gross.toFixed(2)}</li>
              <li>Deductions: {preview.totalDeductions.toFixed(2)}</li>
              <li className="font-semibold">Net: {preview.net.toFixed(2)}</li>
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
