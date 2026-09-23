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

type PolicyV2 = Policy & {
  basis: "days" | "hours";
  accrualPerMonth: number;
  carryoverCap: number;
  maxBalance: number;
  excludePublicHolidays: boolean;
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

type V2PolicyBalance = {
  policyId: string;
  code: string;
  name: string;
  basis: "days" | "hours";
  paid: boolean;
  balance: number;
  used: number;
  pending: number;
  accrued: number;
  carried: number;
};

type V2BalanceRow = {
  employee: { id: string; fullName: string; role: string; active: boolean };
  balances: V2PolicyBalance[];
};

type V2BalancesResponse = { year: number; policies: PolicyV2[]; rows: V2BalanceRow[] };

type Holiday = { id: string; date: string; name: string };

type LeaveEventRow = {
  id: string;
  kind: string;
  amount: number;
  eventDate: string;
  sourceType: string;
  note: string;
  employee: { id: string; fullName: string };
  policy: { id: string; code: string; name: string };
};

const fmt = (value: number | null) => (value === null ? "—" : String(Math.round(value * 100) / 100));

export default function LeaveBalancesPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [v2, setV2] = useState<V2BalancesResponse | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [events, setEvents] = useState<LeaveEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [allowanceEdits, setAllowanceEdits] = useState<Record<string, string>>({});
  const [v2Edits, setV2Edits] = useState<
    Record<
      string,
      { basis: "days" | "hours"; accrualPerMonth: string; carryoverCap: string; maxBalance: string; excludePublicHolidays: boolean }
    >
  >({});
  const [holidayDate, setHolidayDate] = useState("");
  const [holidayName, setHolidayName] = useState("");
  const [tftEmployeeId, setTftEmployeeId] = useState("");
  const [tftPolicyId, setTftPolicyId] = useState("");
  const [tftHours, setTftHours] = useState("");
  const [tftNote, setTftNote] = useState("");

  const load = useCallback(async (targetYear: number) => {
    const res = await apiFetch(`/leave/balances?year=${targetYear}`, { headers: { ...authHeaders() } });
    const json = await readApiData<BalancesResponse>(res);
    setData(json);
    setAllowanceEdits(
      Object.fromEntries(json.policies.map((policy) => [policy.id, String(policy.annualAllowanceDays)]))
    );
  }, []);

  const loadV2 = useCallback(async (targetYear: number) => {
    const [balRes, holRes, evRes] = await Promise.all([
      apiFetch(`/leave/v2/balances?year=${targetYear}`, { headers: { ...authHeaders() } }),
      apiFetch(`/leave/v2/holidays?year=${targetYear}`, { headers: { ...authHeaders() } }),
      apiFetch(`/leave/v2/events?year=${targetYear}`, { headers: { ...authHeaders() } })
    ]);
    const bal = await readApiData<V2BalancesResponse>(balRes);
    const hol = await readApiData<{ year: number; rows: Holiday[] }>(holRes);
    const ev = await readApiData<{ rows: LeaveEventRow[] }>(evRes);
    setV2(bal);
    setHolidays(hol.rows);
    setEvents(ev.rows);
    setV2Edits(
      Object.fromEntries(
        bal.policies.map((p) => [
          p.id,
          {
            basis: p.basis,
            accrualPerMonth: String(p.accrualPerMonth),
            carryoverCap: String(p.carryoverCap),
            maxBalance: String(p.maxBalance),
            excludePublicHolidays: p.excludePublicHolidays
          }
        ])
      )
    );
  }, []);

  const reload = useCallback(
    async (targetYear: number) => {
      await Promise.all([load(targetYear), loadV2(targetYear)]);
    },
    [load, loadV2]
  );

  useEffect(() => {
    setError(null);
    reload(year).catch((e) => setError(e instanceof Error ? e.message : "Could not load leave balances."));
  }, [year, reload]);

  async function runAction(fn: () => Promise<string>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      setNotice(await fn());
      await reload(year);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function seedDefaults() {
    await runAction(async () => {
      const res = await apiFetch("/leave/policies/seed-defaults", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({})
      });
      await readApiData(res);
      return "Default leave policies created.";
    });
  }

  async function savePolicy(policy: Policy) {
    await runAction(async () => {
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
      return `${policy.name} updated.`;
    });
  }

  async function togglePolicy(policy: Policy, field: "paid" | "active") {
    await runAction(async () => {
      const res = await apiFetch(`/leave/policies/${policy.id}`, {
        method: "PUT",
        headers: { ...authHeaders() },
        body: JSON.stringify({ [field]: !policy[field] })
      });
      await readApiData(res);
      return `${policy.name} updated.`;
    });
  }

  async function savePolicyV2(policy: PolicyV2) {
    const edit = v2Edits[policy.id];
    if (!edit) return;
    await runAction(async () => {
      const res = await apiFetch(`/leave/v2/policies/${policy.id}`, {
        method: "PATCH",
        headers: { ...authHeaders() },
        body: JSON.stringify({
          basis: edit.basis,
          accrualPerMonth: Number(edit.accrualPerMonth) || 0,
          carryoverCap: Number(edit.carryoverCap) || 0,
          maxBalance: Number(edit.maxBalance) || 0,
          excludePublicHolidays: edit.excludePublicHolidays
        })
      });
      await readApiData(res);
      return `${policy.name} engine settings saved.`;
    });
  }

  async function seedHolidays() {
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/holidays/seed", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ year })
      });
      const json = await readApiData<{ result: { year: number; seeded: number; total: number } }>(res);
      return `BVI public holidays for ${json.result.year}: ${json.result.seeded} added (${json.result.total} total).`;
    });
  }

  async function addHoliday() {
    if (!holidayDate || !holidayName.trim()) {
      setError("Enter a date and a name for the holiday.");
      return;
    }
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/holidays", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ date: holidayDate, name: holidayName.trim() })
      });
      await readApiData(res);
      setHolidayDate("");
      setHolidayName("");
      return `Holiday "${holidayName.trim()}" added.`;
    });
  }

  async function deleteHoliday(holiday: Holiday) {
    await runAction(async () => {
      const res = await apiFetch(`/leave/v2/holidays/${holiday.id}`, {
        method: "DELETE",
        headers: { ...authHeaders() }
      });
      await readApiData(res);
      return `Holiday "${holiday.name}" removed.`;
    });
  }

  async function postAccruals() {
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/accruals/post", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ year })
      });
      const json = await readApiData<{ result: { posted: number; capped: number } }>(res);
      return `Accruals posted for ${year}: ${json.result.posted} new events (${json.result.capped} capped at max balance). Safe to re-run — already-posted months are skipped.`;
    });
  }

  async function postCarryovers() {
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/carryovers/post", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ year })
      });
      const json = await readApiData<{ result: { posted: number } }>(res);
      return `Carryovers posted for ${year}: ${json.result.posted} new events.`;
    });
  }

  async function backfillEvents() {
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/backfill", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({})
      });
      const json = await readApiData<{ result: { requests: number; created: number; skipped: number } }>(res);
      return `Backfill complete: ${json.result.created} usage events created from ${json.result.requests} historical approved requests (${json.result.skipped} already recorded).`;
    });
  }

  async function submitTimeForTime() {
    const hours = Number(tftHours);
    if (!tftEmployeeId || !tftPolicyId || !Number.isFinite(hours) || hours <= 0) {
      setError("Choose an employee, an hours-basis policy, and a positive number of hours.");
      return;
    }
    await runAction(async () => {
      const res = await apiFetch("/leave/v2/time-for-time", {
        method: "POST",
        headers: { ...authHeaders() },
        body: JSON.stringify({ employeeId: tftEmployeeId, policyId: tftPolicyId, hours, note: tftNote })
      });
      await readApiData(res);
      setTftHours("");
      setTftNote("");
      return `${hours} overtime hour(s) converted to leave credit.`;
    });
  }

  const policies = data?.policies ?? [];
  const v2Policies = v2?.policies ?? [];
  const hoursPolicies = v2Policies.filter((p) => p.basis === "hours");
  const v2Employees = (v2?.rows ?? []).map((r) => r.employee);

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
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          The accrual engine (v2) below keeps an append-only ledger per employee and policy: monthly accruals,
          year-start carryovers, schedule- and holiday-aware usage, and overtime-to-leave (time for time).
          Balances always reproduce from the ledger events.
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
        <div className="flex flex-wrap items-end gap-4">
          <h3 className="font-serif text-xl text-slate-950">Reporting year</h3>
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
      </section>

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
        <h3 className="font-serif text-xl text-slate-950">Accrual engine (v2)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Per-policy engine settings. Basis chooses days or hours (hours enables time-for-time credits). Accrual
          per month posts automatically for completed months; carryover cap limits what moves into a new year;
          max balance caps total accrual. All 0 = engine off for that policy.
        </p>
        {v2Policies.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No policies yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Policy</th>
                  <th className="py-2 pr-3">Basis</th>
                  <th className="py-2 pr-3 text-right">Accrual / month</th>
                  <th className="py-2 pr-3 text-right">Carryover cap</th>
                  <th className="py-2 pr-3 text-right">Max balance</th>
                  <th className="py-2 pr-3">Excl. holidays</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {v2Policies.map((policy) => {
                  const edit = v2Edits[policy.id];
                  return (
                    <tr key={policy.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-semibold">{policy.name}</td>
                      <td className="py-2 pr-3">
                        <select
                          value={edit?.basis ?? policy.basis}
                          onChange={(e) =>
                            setV2Edits((prev) => ({
                              ...prev,
                              [policy.id]: { ...prev[policy.id]!, basis: e.target.value as "days" | "hours" }
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="days">days</option>
                          <option value="hours">hours</option>
                        </select>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.25"
                          value={edit?.accrualPerMonth ?? String(policy.accrualPerMonth)}
                          onChange={(e) =>
                            setV2Edits((prev) => ({
                              ...prev,
                              [policy.id]: { ...prev[policy.id]!, accrualPerMonth: e.target.value }
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={edit?.carryoverCap ?? String(policy.carryoverCap)}
                          onChange={(e) =>
                            setV2Edits((prev) => ({
                              ...prev,
                              [policy.id]: { ...prev[policy.id]!, carryoverCap: e.target.value }
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={edit?.maxBalance ?? String(policy.maxBalance)}
                          onChange={(e) =>
                            setV2Edits((prev) => ({
                              ...prev,
                              [policy.id]: { ...prev[policy.id]!, maxBalance: e.target.value }
                            }))
                          }
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          type="checkbox"
                          checked={edit?.excludePublicHolidays ?? policy.excludePublicHolidays}
                          onChange={(e) =>
                            setV2Edits((prev) => ({
                              ...prev,
                              [policy.id]: { ...prev[policy.id]!, excludePublicHolidays: e.target.checked }
                            }))
                          }
                        />
                      </td>
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() => savePolicyV2(policy)}
                          disabled={busy}
                          className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={postAccruals}
            disabled={busy}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Post accruals for {year}
          </button>
          <button
            type="button"
            onClick={postCarryovers}
            disabled={busy}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Post carryovers into {year}
          </button>
          <button
            type="button"
            onClick={backfillEvents}
            disabled={busy}
            className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Backfill events from approved requests
          </button>
        </div>
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-xl text-slate-950">BVI public holidays</h3>
            <p className="mt-1 text-sm text-slate-600">
              Holidays are excluded from leave usage when the policy has &quot;excl. holidays&quot; on. Seeded dates
              follow the gazette pattern — verify against the official gazette each year.
            </p>
          </div>
          <button
            type="button"
            onClick={seedHolidays}
            disabled={busy}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Seed BVI holidays for {year}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Date
            <input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Name
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="e.g. Territory Day"
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={addHoliday}
            disabled={busy}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Add holiday
          </button>
        </div>
        {!holidays ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : holidays.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No holidays recorded for {year} yet.</p>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {holidays.map((holiday) => (
              <li
                key={holiday.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-semibold">{holiday.date.slice(0, 10)}</span> · {holiday.name}
                </span>
                <button
                  type="button"
                  onClick={() => deleteHoliday(holiday)}
                  disabled={busy}
                  className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-950">Time for time (overtime to leave)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Convert approved overtime hours into a leave credit on an hours-basis policy.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Employee
            <select
              value={tftEmployeeId}
              onChange={(e) => setTftEmployeeId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {v2Employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Policy (hours basis)
            <select
              value={tftPolicyId}
              onChange={(e) => setTftPolicyId(e.target.value)}
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {hoursPolicies.map((policy) => (
                <option key={policy.id} value={policy.id}>
                  {policy.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Hours
            <input
              type="number"
              min={0}
              step="0.5"
              value={tftHours}
              onChange={(e) => setTftHours(e.target.value)}
              className="ml-2 w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Note
            <input
              type="text"
              value={tftNote}
              onChange={(e) => setTftNote(e.target.value)}
              placeholder="Optional"
              className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={submitTimeForTime}
            disabled={busy || hoursPolicies.length === 0}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Convert to leave
          </button>
        </div>
        {hoursPolicies.length === 0 && (
          <p className="mt-2 text-xs text-slate-500">
            No hours-basis policy yet — set a policy&apos;s basis to &quot;hours&quot; in the accrual engine section
            above.
          </p>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-950">Ledger balances (v2)</h3>
        {!v2 ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : v2.rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active employees.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Employee</th>
                  {v2Policies.map((policy) => (
                    <th key={policy.id} className="py-2 pr-3 text-right">
                      {policy.name}
                      <span className="block text-[10px] font-normal normal-case text-slate-400">
                        accrued + carried − used = balance ({policy.basis})
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v2.rows.map((row) => (
                  <tr key={row.employee.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">
                      {row.employee.fullName}
                      <span className="block text-xs text-slate-400">{row.employee.role}</span>
                    </td>
                    {row.balances.map((balance) => (
                      <td key={balance.policyId} className="py-2 pr-3 text-right">
                        {fmt(balance.accrued)} + {fmt(balance.carried)} − {fmt(balance.used)} ={" "}
                        <span className={balance.balance < 0 ? "font-semibold text-rose-700" : "font-semibold"}>
                          {fmt(balance.balance)}
                        </span>
                        {balance.pending > 0 && (
                          <span className="block text-[10px] text-amber-700">{fmt(balance.pending)} pending</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-950">Employee balances (request-based)</h3>
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
                        {fmt(balance.usedDays)} · {fmt(balance.pendingDays)} ·{" "}
                        <span
                          className={
                            balance.remainingDays !== null && balance.remainingDays < 0
                              ? "font-semibold text-rose-700"
                              : "font-semibold"
                          }
                        >
                          {fmt(balance.remainingDays)}
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

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-xl text-slate-950">Leave events ({year})</h3>
        <p className="mt-1 text-sm text-slate-600">
          Append-only ledger: accruals, carryovers, usage, releases, adjustments, and time-for-time credits.
        </p>
        {!events ? (
          <p className="mt-3 text-sm text-slate-500">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No events recorded for {year}.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Policy</th>
                  <th className="py-2 pr-3">Kind</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3">Source</th>
                  <th className="py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{event.eventDate.slice(0, 10)}</td>
                    <td className="py-2 pr-3">{event.employee.fullName}</td>
                    <td className="py-2 pr-3 text-slate-500">{event.policy.name}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          event.kind === "usage"
                            ? "bg-rose-100 text-rose-700"
                            : event.kind === "usage_release"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {event.kind.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">{fmt(event.amount)}</td>
                    <td className="py-2 pr-3 text-slate-500">{event.sourceType.replace(/_/g, " ")}</td>
                    <td className="py-2 text-slate-500">{event.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
