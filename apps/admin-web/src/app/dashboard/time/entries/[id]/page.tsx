"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Template = { id: string; name: string };

type Entry = {
  id: string;
  employeeId: string;
  month: string;
  periodStart: string | null;
  periodEnd: string | null;
  site: string;
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
  const [status, setStatus] = useState("draft");
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
  const [applyIncomeTax, setApplyIncomeTax] = useState(false);
  const [notes, setNotes] = useState("");
  const [employeeName, setEmployeeName] = useState("");

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
        setPeriodEnd(entry.periodEnd ? entry.periodEnd.slice(0, 10) : "");
        setSite(entry.site);
        setStatus(entry.status);
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
        setApplyIncomeTax(entry.applyIncomeTax);
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
          applyIncomeTax
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
    applySsb,
    applyIncomeTax
  ]);

  useEffect(() => {
    const t = setTimeout(runPreview, 300);
    return () => clearTimeout(t);
  }, [runPreview]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/entries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          month,
          periodStart: periodStart || null,
          periodEnd: periodEnd || null,
          site,
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
          applyIncomeTax,
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

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl text-slate-900">Edit timesheet</h2>
          <p className="text-sm text-slate-600">{employeeName}</p>
        </div>
        <Link href="/dashboard/time/entries" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr,280px]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs text-slate-500">
            Employee is fixed on this row. Create a new timesheet if you need a different employee.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Month</span>
              <input
                type="month"
                required
                value={month}
                onChange={(e) => setMonth(e.target.value)}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Period start</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Period end</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-slate-700">Site</span>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-4">
            <label className="block text-sm">
              <span className="text-slate-700">Days</span>
              <input
                type="number"
                step="0.5"
                value={daysWorked}
                onChange={(e) => setDaysWorked(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Hours</span>
              <input
                type="number"
                step="0.5"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">OT hours</span>
              <input
                type="number"
                step="0.5"
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
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
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={applyIncomeTax}
                onChange={(e) => setApplyIncomeTax(e.target.checked)}
              />
              Income tax
            </label>
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
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
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
