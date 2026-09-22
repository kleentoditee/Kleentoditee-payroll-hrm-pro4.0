"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

type OrgSettings = {
  id: string;
  companyLegalName: string;
  companyAddress: string;
  ssbEmployerNumber: string;
  nhiEmployerNumber: string;
  defaultPaySchedule: "weekly" | "biweekly" | "monthly";
  defaultPayDayOfMonth: number;
  ssbEmployeeRate: number;
  ssbEmployerRate: number;
  ssbAnnualCeiling: number;
  ssbEnabled: boolean;
  nhiEmployeeRate: number;
  nhiEmployerRate: number;
  nhiAnnualCeiling: number;
  nhiEnabled: boolean;
  payrollTaxEnabled: boolean;
  payrollTaxEmployeeRate: number;
  payrollTaxEmployerClass: "NOT_SET" | "CLASS_1" | "CLASS_2";
  payrollTaxAnnualExemption: number;
  statutoryEffectiveYear: number;
};

const inputClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [systemReadiness, setSystemReadiness] = useState<{
    database: string;
    passwordResetEmail: string;
    documentStorage: string;
  } | null>(null);

  const [companyLegalName, setCompanyLegalName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [ssbEmployerNumber, setSsbEmployerNumber] = useState("");
  const [nhiEmployerNumber, setNhiEmployerNumber] = useState("");
  const [defaultPaySchedule, setDefaultPaySchedule] =
    useState<OrgSettings["defaultPaySchedule"]>("monthly");
  const [defaultPayDayOfMonth, setDefaultPayDayOfMonth] = useState("0");
  const [ssbEmployeeRate, setSsbEmployeeRate] = useState("0");
  const [ssbEmployerRate, setSsbEmployerRate] = useState("0");
  const [ssbAnnualCeiling, setSsbAnnualCeiling] = useState("53400");
  const [ssbEnabled, setSsbEnabled] = useState(true);
  const [nhiEmployeeRate, setNhiEmployeeRate] = useState("0");
  const [nhiEmployerRate, setNhiEmployerRate] = useState("0");
  const [nhiAnnualCeiling, setNhiAnnualCeiling] = useState("106800");
  const [nhiEnabled, setNhiEnabled] = useState(true);
  const [payrollTaxEnabled, setPayrollTaxEnabled] = useState(true);
  const [payrollTaxEmployeeRate, setPayrollTaxEmployeeRate] = useState("8");
  const [payrollTaxEmployerClass, setPayrollTaxEmployerClass] =
    useState<OrgSettings["payrollTaxEmployerClass"]>("NOT_SET");
  const [payrollTaxAnnualExemption, setPayrollTaxAnnualExemption] = useState("10000");
  const [statutoryEffectiveYear, setStatutoryEffectiveYear] = useState("2026");
  const [statutoryVerification, setStatutoryVerification] = useState<{
    effectiveYear: number;
    hasVersion: boolean;
    verified: boolean;
    approved: boolean;
    sourceUrl: string;
    verifiedAt: string | null;
    verifiedBy: string;
    approvedAt: string | null;
    approvedBy: string;
  } | null>(null);

  const [loaded, setLoaded] = useState(false);

  function applySettings(row: OrgSettings) {
    setCompanyLegalName(row.companyLegalName ?? "");
    setCompanyAddress(row.companyAddress ?? "");
    setSsbEmployerNumber(row.ssbEmployerNumber ?? "");
    setNhiEmployerNumber(row.nhiEmployerNumber ?? "");
    setDefaultPaySchedule(row.defaultPaySchedule ?? "monthly");
    setDefaultPayDayOfMonth(String(row.defaultPayDayOfMonth ?? 0));
    setSsbEmployeeRate(String((row.ssbEmployeeRate ?? 0) * 100));
    setSsbEmployerRate(String((row.ssbEmployerRate ?? 0) * 100));
    setSsbAnnualCeiling(String(row.ssbAnnualCeiling ?? 53400));
    setSsbEnabled(Boolean(row.ssbEnabled));
    setNhiEmployeeRate(String((row.nhiEmployeeRate ?? 0) * 100));
    setNhiEmployerRate(String((row.nhiEmployerRate ?? 0) * 100));
    setNhiAnnualCeiling(String(row.nhiAnnualCeiling ?? 106800));
    setNhiEnabled(Boolean(row.nhiEnabled));
    setPayrollTaxEnabled(Boolean(row.payrollTaxEnabled));
    setPayrollTaxEmployeeRate(String((row.payrollTaxEmployeeRate ?? 0.08) * 100));
    setPayrollTaxEmployerClass(row.payrollTaxEmployerClass ?? "NOT_SET");
    setPayrollTaxAnnualExemption(String(row.payrollTaxAnnualExemption ?? 10000));
    setStatutoryEffectiveYear(String(row.statutoryEffectiveYear ?? 2026));
    setLoaded(true);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, healthRes] = await Promise.all([
          fetch(`${apiBase()}/settings/org`, { headers: { ...authHeaders() } }),
          fetch(`${apiBase()}/health/ready`)
        ]);
        const data = (await res.json()) as {
          error?: string;
          settings?: OrgSettings;
          statutoryVerification?: {
            effectiveYear: number;
            hasVersion: boolean;
            verified: boolean;
            approved: boolean;
            sourceUrl: string;
            verifiedAt: string | null;
            verifiedBy: string;
            approvedAt: string | null;
            approvedBy: string;
          };
        };
        if (!res.ok || !data.settings) {
          throw new Error(data.error ?? "Load failed");
        }
        if (!cancelled && data.statutoryVerification) {
          setStatutoryVerification(data.statutoryVerification);
        }
        if (healthRes.ok) {
          const health = (await healthRes.json()) as {
            database: string;
            passwordResetEmail: string;
            documentStorage: string;
          };
          if (!cancelled) setSystemReadiness(health);
        }
        if (!cancelled) {
          applySettings(data.settings);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load settings.");
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
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Validate numeric fields before any Number() conversion - a blank input
    // would otherwise silently save as 0 (e.g. wiping the SSB rate).
    const numericInputs: Array<[string, string]> = [
      ["Pay day of month", defaultPayDayOfMonth],
      ["SSB employee rate", ssbEmployeeRate],
      ["SSB employer rate", ssbEmployerRate],
      ["SSB annual ceiling", ssbAnnualCeiling],
      ["NHI employee rate", nhiEmployeeRate],
      ["NHI employer rate", nhiEmployerRate],
      ["NHI annual ceiling", nhiAnnualCeiling],
      ["Payroll tax employee rate", payrollTaxEmployeeRate],
      ["Payroll tax annual exemption", payrollTaxAnnualExemption],
      ["Statutory effective year", statutoryEffectiveYear]
    ];
    for (const [label, value] of numericInputs) {
      if (!String(value).trim() || !Number.isFinite(Number(value))) {
        setError(`${label} must be a valid number.`);
        setSuccess(null);
        return;
      }
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase()}/settings/org`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyLegalName,
          companyAddress,
          ssbEmployerNumber,
          nhiEmployerNumber,
          defaultPaySchedule,
          defaultPayDayOfMonth: Number(defaultPayDayOfMonth),
          ssbEmployeeRate: Number(ssbEmployeeRate) / 100,
          ssbEmployerRate: Number(ssbEmployerRate) / 100,
          ssbAnnualCeiling: Number(ssbAnnualCeiling),
          ssbEnabled,
          nhiEmployeeRate: Number(nhiEmployeeRate) / 100,
          nhiEmployerRate: Number(nhiEmployerRate) / 100,
          nhiAnnualCeiling: Number(nhiAnnualCeiling),
          nhiEnabled,
          payrollTaxEnabled,
          payrollTaxEmployeeRate: Number(payrollTaxEmployeeRate) / 100,
          payrollTaxEmployerClass,
          payrollTaxAnnualExemption: Number(payrollTaxAnnualExemption),
          statutoryEffectiveYear: Number(statutoryEffectiveYear)
        })
      });
      const data = (await res.json()) as { error?: string; settings?: OrgSettings };
      if (!res.ok || !data.settings) {
        setError(data.error ?? "Save failed");
        return;
      }
      applySettings(data.settings);
      setSuccess("Settings saved.");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading…</p>;
  }


  if (!loaded) {
    // Load failed: never render the form on hardcoded defaults — a save here
    // would overwrite live statutory settings with placeholders.
    return (
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-semibold">Settings could not be loaded.</p>
          <p className="mt-1">{error ?? "Load failed."}</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-2 rounded-md bg-rose-700 px-3 py-1.5 text-white">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-slate-900">Organization settings</h2>
      </div>

      {statutoryVerification?.verified && statutoryVerification.approved ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Statutory rates for {statutoryVerification.effectiveYear} are verified
          {statutoryVerification.verifiedBy ? ` by ${statutoryVerification.verifiedBy}` : ""} and approved for payroll use.
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">
            Statutory rates for {statutoryVerification?.effectiveYear ?? statutoryEffectiveYear} are not verified against official BVI sources.
          </p>
          <p className="mt-1">
            Verify NHI, SSB, and payroll tax rates, ceilings, and the employer tax class at the official agencies
            before processing live payroll. Payroll calculations use the values below until a verified,
            approved rate version is recorded.
          </p>
        </div>
      )}

      {systemReadiness ? (
        <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
          <h3 className="font-semibold text-slate-900">System readiness</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <p className={systemReadiness.database === "ready" ? "text-emerald-700" : "text-red-700"}>
              Database: {systemReadiness.database}
            </p>
            <p className={systemReadiness.passwordResetEmail === "configured" ? "text-emerald-700" : "text-red-700"}>
              Password email: {systemReadiness.passwordResetEmail === "configured" ? "ready" : "needs SMTP setup"}
            </p>
            <p className="text-slate-700">Documents: {systemReadiness.documentStorage}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Company</h3>
          <label className="block text-sm">
            <span className="text-slate-700">Company legal name</span>
            <input
              value={companyLegalName}
              onChange={(e) => setCompanyLegalName(e.target.value)}
              placeholder="e.g. KleenToDiTee Ltd."
              className={inputClass}
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Company address</span>
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">SSB employer number</span>
              <input value={ssbEmployerNumber} onChange={(e) => setSsbEmployerNumber(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">NHI employer number</span>
              <input value={nhiEmployerNumber} onChange={(e) => setNhiEmployerNumber(e.target.value)} className={inputClass} />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">Pay calendar defaults</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Default pay schedule</span>
              <select
                value={defaultPaySchedule}
                onChange={(e) =>
                  setDefaultPaySchedule(e.target.value as OrgSettings["defaultPaySchedule"])
                }
                className={inputClass}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Default pay day of month (0–31)</span>
              <input
                type="number"
                min={0}
                max={31}
                step={1}
                value={defaultPayDayOfMonth}
                onChange={(e) => setDefaultPayDayOfMonth(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">BVI Social Security (SSB)</h3>
          <p className="text-xs text-slate-500">
            Enter rates as percentages. The annual ceiling is converted
            automatically for weekly, biweekly, and monthly payroll.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ssbEnabled} onChange={(e) => setSsbEnabled(e.target.checked)} />
            Social Security enabled
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-slate-700">Employee rate (%)</span>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={ssbEmployeeRate}
                onChange={(e) => setSsbEmployeeRate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Employer rate (%)</span>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={ssbEmployerRate}
                onChange={(e) => setSsbEmployerRate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Annual ceiling</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={ssbAnnualCeiling}
                onChange={(e) => setSsbAnnualCeiling(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">National Health Insurance (NHI)</h3>
          <p className="text-xs text-slate-500">
            Enter rates as percentages. The annual ceiling is converted
            automatically for each pay schedule.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={nhiEnabled} onChange={(e) => setNhiEnabled(e.target.checked)} />
            National Health Insurance enabled
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="text-slate-700">Employee rate (%)</span>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={nhiEmployeeRate}
                onChange={(e) => setNhiEmployeeRate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Employer rate (%)</span>
              <input
                type="number"
                step="0.0001"
                min={0}
                value={nhiEmployerRate}
                onChange={(e) => setNhiEmployerRate(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Annual ceiling</span>
              <input
                type="number"
                step="0.01"
                min={0}
                value={nhiAnnualCeiling}
                onChange={(e) => setNhiAnnualCeiling(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-slate-900">BVI payroll tax</h3>
          <p className="text-xs text-slate-500">
            The employee share is withheld after the employee&apos;s annual exemption is used. Employer
            Class 1 adds 2%; Class 2 adds 6%.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={payrollTaxEnabled}
              onChange={(e) => setPayrollTaxEnabled(e.target.checked)}
            />
            Payroll tax enabled
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-slate-700">Employee rate (%)</span>
              <input type="number" step="0.0001" min={0} value={payrollTaxEmployeeRate} onChange={(e) => setPayrollTaxEmployeeRate(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Employer class</span>
              <select value={payrollTaxEmployerClass} onChange={(e) => setPayrollTaxEmployerClass(e.target.value as OrgSettings["payrollTaxEmployerClass"])} className={inputClass}>
                <option value="NOT_SET">Select class</option>
                <option value="CLASS_1">Class 1 (2% employer)</option>
                <option value="CLASS_2">Class 2 (6% employer)</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Annual exemption</span>
              <input type="number" step="0.01" min={0} value={payrollTaxAnnualExemption} onChange={(e) => setPayrollTaxAnnualExemption(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-sm">
              <span className="text-slate-700">Statutory year</span>
              <input type="number" min={2020} max={2100} step={1} value={statutoryEffectiveYear} onChange={(e) => setStatutoryEffectiveYear(e.target.value)} className={inputClass} />
            </label>
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
