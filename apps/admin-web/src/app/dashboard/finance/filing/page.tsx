"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useEffect, useState } from "react";

type OrgSettings = {
  companyLegalName: string;
  companyRegistrationNumber: string;
  incorporationDate: string | null;
  registeredAgentName: string;
  registeredOfficeAddress: string;
  fiscalYearEndMonth: number;
  filesIrFinancialStatements: boolean;
  annualReturnExemptionBasis: string;
};

type AnnualReturn = {
  year: number;
  financialYearEnd: string;
  wording: string;
  identity: {
    companyLegalName: string;
    companyRegistrationNumber: string;
    incorporationDate: string | null;
    registeredAgentName: string;
    registeredOfficeAddress: string;
  };
  applicability: {
    hasRegisteredAgent: boolean;
    filesIrFinancialStatements: boolean;
    annualReturnExemptionBasis: string;
    note: string;
  };
  mapping: {
    totalAssets: number;
    totalLiabilities: number;
    netAssets: number;
    totalRevenue: number;
    totalExpenses: number;
    netIncome: number;
    balanceCheck: number;
  };
  payrollSupport: {
    employeeCount: number;
    runCount: number;
    gross: number;
    net: number;
    nhi: number;
    ssb: number;
    payrollTax: number;
  };
  deadlines: {
    annualReturnWithRegisteredAgent: string;
    inlandRevenueReturnApprox: string;
  };
  sources: string[];
};

const fmt = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function FilingSupportPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [annualReturn, setAnnualReturn] = useState<AnnualReturn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadSettings() {
    const res = await fetch(`${apiBase()}/settings/org`, { headers: { ...authHeaders() } });
    const data = await readApiData<{ settings: OrgSettings }>(res);
    setSettings(data.settings);
  }

  async function loadAnnualReturn(y: number) {
    const res = await fetch(`${apiBase()}/finance/filing/annual-return?year=${y}`, {
      headers: { ...authHeaders() }
    });
    const data = await readApiData<{ annualReturn: AnnualReturn }>(res);
    setAnnualReturn(data.annualReturn);
  }

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadSettings(), loadAnnualReturn(year)]);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load filing support data");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeYear(y: number) {
    setYear(y);
    setAnnualReturn(null);
    try {
      await loadAnnualReturn(y);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load annual return mapping");
    }
  }

  async function saveIdentity() {
    if (!settings) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/settings/org`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          companyRegistrationNumber: settings.companyRegistrationNumber,
          incorporationDate: settings.incorporationDate,
          registeredAgentName: settings.registeredAgentName,
          registeredOfficeAddress: settings.registeredOfficeAddress,
          fiscalYearEndMonth: settings.fiscalYearEndMonth,
          filesIrFinancialStatements: settings.filesIrFinancialStatements,
          annualReturnExemptionBasis: settings.annualReturnExemptionBasis
        })
      });
      await readApiData(res);
      await Promise.all([loadSettings(), loadAnnualReturn(year)]);
      setNotice("Filing identity saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function lockSnapshot() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${apiBase()}/finance/statements/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ type: "annual_return", year, label: `Annual return mapping ${year}` })
      });
      await readApiData(res);
      setNotice(`Locked an immutable annual-return snapshot for ${year}. Find it under Financial statements → Lock snapshot history.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Snapshot failed");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">BVI filing support</h2>
        <p className="text-sm text-slate-600">
          Annual-return identity and financial mapping for British Virgin Islands obligations.
        </p>
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
        Filing support only — this page prepares and locks data mappings. It does not file anything, and no
        electronic submission exists. Confirm applicability and deadlines with your registered agent or
        Inland Revenue before relying on them.
      </p>

      {error ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {notice ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p> : null}

      {settings ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Filing identity &amp; applicability</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Company registration number
              <input
                className={field}
                value={settings.companyRegistrationNumber}
                onChange={(e) => setSettings({ ...settings, companyRegistrationNumber: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Incorporation date
              <input
                type="date"
                className={field}
                value={settings.incorporationDate ? settings.incorporationDate.slice(0, 10) : ""}
                onChange={(e) => setSettings({ ...settings, incorporationDate: e.target.value || null })}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Registered agent name
              <input
                className={field}
                value={settings.registeredAgentName}
                onChange={(e) => setSettings({ ...settings, registeredAgentName: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Registered office address
              <input
                className={field}
                value={settings.registeredOfficeAddress}
                onChange={(e) => setSettings({ ...settings, registeredOfficeAddress: e.target.value })}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Financial year-end month
              <select
                className={field}
                value={settings.fiscalYearEndMonth}
                onChange={(e) => setSettings({ ...settings, fiscalYearEndMonth: Number(e.target.value) })}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Annual return exemption basis (if any)
              <input
                className={field}
                value={settings.annualReturnExemptionBasis}
                onChange={(e) => setSettings({ ...settings, annualReturnExemptionBasis: e.target.value })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={settings.filesIrFinancialStatements}
                onChange={(e) => setSettings({ ...settings, filesIrFinancialStatements: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300"
              />
              Company files a tax return with financial statements with Inland Revenue
            </label>
          </div>
          <button
            disabled={busy}
            onClick={() => void saveIdentity()}
            className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save filing identity
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Loading…</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Annual return mapping</h3>
            <p className="text-xs text-slate-500">
              Balance-sheet and profit-and-loss figures mapped for the annual return.
            </p>
          </div>
          <label className="text-sm font-medium text-slate-700">
            Fiscal year
            <input
              type="number"
              value={year}
              onChange={(e) => void changeYear(Number(e.target.value))}
              className="mt-1 block w-28 rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        {annualReturn ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Total assets" value={fmt(annualReturn.mapping.totalAssets)} />
              <Stat label="Total liabilities" value={fmt(annualReturn.mapping.totalLiabilities)} />
              <Stat label="Net assets" value={fmt(annualReturn.mapping.netAssets)} />
              <Stat label="Total revenue" value={fmt(annualReturn.mapping.totalRevenue)} />
              <Stat label="Total expenses" value={fmt(annualReturn.mapping.totalExpenses)} />
              <Stat label="Net income" value={fmt(annualReturn.mapping.netIncome)} />
            </dl>

            <p className={`rounded-md px-3 py-2 text-sm ${annualReturn.mapping.balanceCheck === 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
              {annualReturn.mapping.balanceCheck === 0
                ? "Balance check passed — assets equal liabilities plus equity at year end."
                : `Balance check FAILED — the books are out of balance by ${fmt(annualReturn.mapping.balanceCheck)}. Do not use this mapping until resolved.`}
            </p>

            <div>
              <h4 className="text-sm font-semibold text-slate-900">Payroll support (financial year)</h4>
              <dl className="mt-2 grid gap-3 sm:grid-cols-3">
                <Stat label="Active employees" value={String(annualReturn.payrollSupport.employeeCount)} />
                <Stat label="Pay runs" value={String(annualReturn.payrollSupport.runCount)} />
                <Stat label="Gross wages" value={fmt(annualReturn.payrollSupport.gross)} />
                <Stat label="Net pay" value={fmt(annualReturn.payrollSupport.net)} />
                <Stat label="NHI (EE + ER)" value={fmt(annualReturn.payrollSupport.nhi)} />
                <Stat label="SSB (EE + ER)" value={fmt(annualReturn.payrollSupport.ssb)} />
                <Stat label="Payroll tax (EE + ER)" value={fmt(annualReturn.payrollSupport.payrollTax)} />
              </dl>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-900">Deadlines &amp; applicability</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>Financial year-end: {annualReturn.financialYearEnd}</li>
                <li>
                  Annual return with registered agent (FYE + 9 months):{" "}
                  {annualReturn.deadlines.annualReturnWithRegisteredAgent}
                </li>
                <li>
                  Inland Revenue return (approximate, FYE + 90 days — verify before relying):{" "}
                  {annualReturn.deadlines.inlandRevenueReturnApprox}
                </li>
              </ul>
              <p className="mt-2 text-sm text-slate-600">{annualReturn.applicability.note}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {annualReturn.sources.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>

            <button
              disabled={busy}
              onClick={() => void lockSnapshot()}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Lock annual-return snapshot
            </button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Loading mapping…</p>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}
