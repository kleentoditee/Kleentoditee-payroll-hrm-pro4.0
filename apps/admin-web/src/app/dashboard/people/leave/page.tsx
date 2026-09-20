"use client";

import { apiFetch, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type Policy = {
  id: string;
  code: string;
  name: string;
  requestType: string;
  paid: boolean;
  annualAllowanceDays: number;
  active: boolean;
  sortOrder: number;
};

type PolicyBalance = {
  policyId: string;
  code: string;
  name: string;
  paid: boolean;
  allowanceDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number | null;
};

type BalanceRow = {
  employee: { id: string; fullName: string; role: string; defaultSite: string; active: boolean };
  balances: PolicyBalance[];
};

type BalancesResponse = { year: number; policies: Policy[]; rows: BalanceRow[] };

const days = (value: number | null) => (value === null ? "—" : String(Math.round(value * 100) / 100));

export default function LeaveBalancesPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowanceEdits, setAllowanceEdits] = useState<Record<string, string>>({});

  const load = useCallback(async (targetYear: number) => {
    const res = await apiFetch(`/leave/balances?year=${targetYear}`, { headers: { ...authHeaders() } });
    const json = await readApiData<BalancesResponse>(res);
    setData(json);
    setAllowanceEdits(
      Object.fromEntries(json.policies.map((policy) => [policy.id, String(policy.annualAllowanceDays)]))
    );
  }, []);

  useEffect(() => {
    setError(null);
    load(year).catch((e) => setError(e instanceof Error ? e.message : "Could not load leave balances."));
  }, [year, load]);

  async function seedDefaults() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/leave/policies/seed-defaults", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({})
      });
      await readApiData(res);
      setNotice("Default leave policies created.");
      await load(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create default policies.");
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(policy: Policy) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const allowance = Number(allowanceEdits[policy.id] ?? policy.annualAllowanceDays);
      const res = await apiFetch(`/leave/policies/${policy.id}`, {
        method: "PUT",
        headers: { ...authHeaders() },
        body: JSON.stringify({
          annualAllowanceDays: allowance,
          paid: policy.paid,
          active: policy.active
        })
      });
      await readApiData(res);
      setNotice(`${policy.name} updated.`);
      await load(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update policy.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePolicy(policy: Policy, field: "paid" | "active") {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/leave/policies/${policy.id}`, {
        method: "PUT",
        headers: { ...authHeaders() },
        body: JSON.stringify({ [field]: !policy[field] })
      });
      await readApiData(res);
      await load(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update policy.");
    } finally {
      setBusy(false);
    }
  }

  const policies = data?.policies ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#006D77]">People</p>
        <h2 className="mt-2 font-serif text-3xl text-slate-950">Leave balances</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Balances are computed from the Staff requests queue: approved time off / sick / unpaid leave counts as
          used, submitted and under-review requests count as pending. Approved unpaid leave reduces fixed-basis
          salaries pro-rata in the matching pay run.
        </p>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-serif text-xl text-slate-950">Leave policies</h3>
          {policies.length === 0 && (
            <button
              type="button"
              onClick={seedDefaults}
              disabled={busy}
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create default policies
            </button>
          )}
        </div>
        {policies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No leave policies yet. Create the defaults (annual vacation 15 days, sick leave 10 days, unpaid leave
            untracked) to start tracking balances.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Policy</th>
                  <th className="py-2 pr-3">Request type</th>
                  <th className="py-2 pr-3 text-right">Allowance (days/yr)</th>
                  <th className="py-2 pr-3">Paid</th>
                  <th className="py-2 pr-3">Active</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr key={policy.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-semibold">{policy.name}</td>
                    <td className="py-2 pr-3 text-slate-500">{policy.requestType.replace(/_/g, " ").toLowerCase()}</td>
                    <td className="py-2 pr-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={allowanceEdits[policy.id] ?? String(policy.annualAllowanceDays)}
                        onChange={(e) =>
                          setAllowanceEdits((prev) => ({ ...prev, [policy.id]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                      />
                      <span className="ml-1 text-xs text-slate-400">0 = untracked</span>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => togglePolicy(policy, "paid")}
                        disabled={busy}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          policy.paid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {policy.paid ? "Paid" : "Unpaid"}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => togglePolicy(policy, "active")}
                        disabled={busy}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          policy.active ? "bg-slate-200 text-slate-800" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {policy.active ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => savePolicy(policy)}
                        disabled={busy}
                        className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <h3 className="font-serif text-xl text-slate-950">Employee balances</h3>
          <label className="text-sm font-semibold text-slate-700">
            Year
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => {
                const next = Number(e.target.value);
                if (Number.isInteger(next) && next >= 2000 && next <= 2100) setYear(next);
              }}
              className="ml-2 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {!data ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : data.rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active employees.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Employee</th>
                  {policies.map((policy) => (
                    <th key={policy.id} className="py-2 pr-3 text-right">
                      {policy.name}
                      <span className="block text-[10px] font-normal normal-case text-slate-400">
                        used · pending · left
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.employee.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      {row.employee.fullName}
                      <span className="block text-xs text-slate-400">{row.employee.role}</span>
                    </td>
                    {row.balances.map((balance) => (
                      <td key={balance.policyId} className="py-2 pr-3 text-right">
                        {days(balance.usedDays)} · {days(balance.pendingDays)} ·{" "}
                        <span
                          className={
                            balance.remainingDays !== null && balance.remainingDays < 0
                              ? "font-semibold text-rose-700"
                              : "font-semibold"
                          }
                        >
                          {days(balance.remainingDays)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Review leave requests in the Staff requests tab; approved unpaid leave is applied to pay runs
          automatically.
        </p>
      </section>
    </div>
  );
}
