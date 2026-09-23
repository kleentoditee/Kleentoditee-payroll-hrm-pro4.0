"use client";

import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useState } from "react";

type Master = { id: string; code?: string; name: string; active?: boolean };
type EmployeeOption = { id: string; fullName: string };

type Contract = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employmentType: string;
  notes?: string;
  department?: Master | null;
  position?: Master | null;
  costCentre?: Master | null;
  location?: Master | null;
  workSchedule?: { id: string; name: string } | null;
  manager?: { id: string; fullName: string } | null;
};

type Asset = {
  id: string;
  name: string;
  assetTag: string;
  serialNumber: string;
  condition: string;
  issuedAt: string;
  returnedAt: string | null;
  notes: string;
};

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "casual", label: "Casual" },
  { value: "fixed_term", label: "Fixed term" }
] as const;

const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "—");

export function EmployeeStructureSection({
  employeeId,
  assignment
}: {
  employeeId: string;
  assignment: {
    departmentId: string | null;
    positionId: string | null;
    costCentreId: string | null;
    locationId: string | null;
    workScheduleId: string | null;
    managerId: string | null;
  };
}) {
  const [masters, setMasters] = useState<Record<string, Master[]>>({});
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assign, setAssign] = useState({ ...assignment });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // contract form
  const [cFrom, setCFrom] = useState("");
  const [cType, setCType] = useState<string>("full_time");
  const [cDept, setCDept] = useState("");
  const [cPos, setCPos] = useState("");
  const [cCc, setCCc] = useState("");
  const [cLoc, setCLoc] = useState("");
  const [cSched, setCSched] = useState("");
  const [cMgr, setCMgr] = useState("");
  const [cNotes, setCNotes] = useState("");
  // asset form
  const [aName, setAName] = useState("");
  const [aTag, setATag] = useState("");
  const [aCond, setACond] = useState("");

  const get = useCallback(async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${apiBase()}${path}`, { headers: { ...authHeaders() } });
    return readApiData<T>(res);
  }, []);

  const loadContracts = useCallback(async () => {
    const data = await get<{ rows: Contract[] }>(`/hr-structure/employees/${employeeId}/contracts`);
    setContracts(data.rows);
  }, [get, employeeId]);

  const loadAssets = useCallback(async () => {
    const data = await get<{ rows: Asset[] }>(`/hr-structure/employees/${employeeId}/assets`);
    setAssets(data.rows);
  }, [get, employeeId]);

  useEffect(() => {
    (async () => {
      try {
        const [dept, pos, cc, loc, sched, emps] = await Promise.all([
          get<{ rows: Master[] }>("/hr-structure/masters/departments"),
          get<{ rows: Master[] }>("/hr-structure/masters/positions"),
          get<{ rows: Master[] }>("/hr-structure/masters/cost-centres"),
          get<{ rows: Master[] }>("/hr-structure/masters/locations"),
          get<{ rows: Master[] }>("/hr-structure/masters/work-schedules"),
          get<{ items: EmployeeOption[] }>("/people/employees")
        ]);
        setMasters({
          departmentId: dept.rows.filter((r) => r.active !== false),
          positionId: pos.rows.filter((r) => r.active !== false),
          costCentreId: cc.rows.filter((r) => r.active !== false),
          locationId: loc.rows.filter((r) => r.active !== false),
          workScheduleId: sched.rows.filter((r) => r.active !== false)
        });
        setEmployees(emps.items.filter((e) => e.id !== employeeId));
      } catch {
        setError("Could not load structure masters.");
      }
      loadContracts().catch(() => undefined);
      loadAssets().catch(() => undefined);
    })();
  }, [get, employeeId, loadContracts, loadAssets]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function send(method: string, path: string, body?: Record<string, unknown>) {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    return readApiData<Record<string, unknown>>(res);
  }

  const saveAssignment = () =>
    run(async () => {
      await send("PATCH", `/people/employees/${employeeId}`, {
        departmentId: assign.departmentId || null,
        positionId: assign.positionId || null,
        costCentreId: assign.costCentreId || null,
        locationId: assign.locationId || null,
        workScheduleId: assign.workScheduleId || null,
        managerId: assign.managerId || null
      });
      setNotice("Assignment saved.");
    });

  const addContract = () =>
    run(async () => {
      if (!cFrom) {
        setError("Pick the effective-from date.");
        return;
      }
      await send("POST", `/hr-structure/employees/${employeeId}/contracts`, {
        effectiveFrom: cFrom,
        employmentType: cType,
        departmentId: cDept || null,
        positionId: cPos || null,
        costCentreId: cCc || null,
        locationId: cLoc || null,
        workScheduleId: cSched || null,
        managerId: cMgr || null,
        notes: cNotes
      });
      setCFrom("");
      setCDept("");
      setCPos("");
      setCCc("");
      setCLoc("");
      setCSched("");
      setCMgr("");
      setCNotes("");
      await loadContracts();
      setNotice("Contract recorded. If it is in force today the employee assignment now follows it.");
    });

  const withdrawContract = (id: string) =>
    run(async () => {
      await send("DELETE", `/hr-structure/contracts/${id}`);
      await loadContracts();
      setNotice("Future-dated contract withdrawn.");
    });

  const issueAsset = () =>
    run(async () => {
      if (!aName.trim()) {
        setError("Asset name is required.");
        return;
      }
      await send("POST", `/hr-structure/employees/${employeeId}/assets`, {
        name: aName,
        assetTag: aTag,
        condition: aCond
      });
      setAName("");
      setATag("");
      setACond("");
      await loadAssets();
      setNotice("Asset issued.");
    });

  const returnAsset = (id: string) =>
    run(async () => {
      await send("PATCH", `/hr-structure/assets/${id}`, { returnedAt: new Date().toISOString() });
      await loadAssets();
      setNotice("Asset marked returned.");
    });

  const select = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: Master[] | EmployeeOption[],
    nameKey: "name" | "fullName" = "name"
  ) => (
    <label className="text-sm">
      <span className="text-slate-700">{label}</span>
      <select
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {"code" in o && o.code ? `${o.code} · ` : ""}
            {nameKey === "fullName" ? (o as EmployeeOption).fullName : (o as Master).name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Current assignment</h3>
        <p className="mt-1 text-xs text-slate-500">
          Saved directly on the employee. When a contract is in force today, its terms overwrite these values.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {select("Department", assign.departmentId ?? "", (v) => setAssign((a) => ({ ...a, departmentId: v })), masters.departmentId ?? [])}
          {select("Position", assign.positionId ?? "", (v) => setAssign((a) => ({ ...a, positionId: v })), masters.positionId ?? [])}
          {select("Cost centre", assign.costCentreId ?? "", (v) => setAssign((a) => ({ ...a, costCentreId: v })), masters.costCentreId ?? [])}
          {select("Location / site", assign.locationId ?? "", (v) => setAssign((a) => ({ ...a, locationId: v })), masters.locationId ?? [])}
          {select("Work schedule", assign.workScheduleId ?? "", (v) => setAssign((a) => ({ ...a, workScheduleId: v })), masters.workScheduleId ?? [])}
          {select("Reports to (manager)", assign.managerId ?? "", (v) => setAssign((a) => ({ ...a, managerId: v })), employees, "fullName")}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={saveAssignment}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save assignment
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Employment contracts (career history)</h3>
        <p className="mt-1 text-xs text-slate-500">
          Effective-dated and immutable once in force — add a correcting contract instead of editing history.
        </p>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Effective</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Dept / Position</th>
              <th className="py-2 pr-2">Manager</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((k) => (
              <tr key={k.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">
                  {dateOnly(k.effectiveFrom)}{k.effectiveTo ? ` → ${dateOnly(k.effectiveTo)}` : " → present"}
                </td>
                <td className="py-2 pr-2">{EMPLOYMENT_TYPES.find((t) => t.value === k.employmentType)?.label ?? k.employmentType}</td>
                <td className="py-2 pr-2 text-xs text-slate-600">
                  {k.department?.name ?? "—"}{k.position ? ` / ${k.position.name}` : ""}
                </td>
                <td className="py-2 pr-2 text-xs text-slate-600">{k.manager?.fullName ?? "—"}</td>
                <td className="py-2 text-right">
                  {new Date(k.effectiveFrom) > new Date() && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => withdrawContract(k.id)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Withdraw
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr><td className="py-3 text-sm text-slate-500" colSpan={5}>No contracts yet — run the backfill or add one below.</td></tr>
            )}
          </tbody>
        </table>

        <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
          <label className="text-sm">
            <span className="text-slate-700">Effective from</span>
            <input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={cFrom} onChange={(e) => setCFrom(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Employment type</span>
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={cType} onChange={(e) => setCType(e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Notes</span>
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Promotion, transfer, ..." />
          </label>
          {select("Department", cDept, setCDept, masters.departmentId ?? [])}
          {select("Position", cPos, setCPos, masters.positionId ?? [])}
          {select("Cost centre", cCc, setCCc, masters.costCentreId ?? [])}
          {select("Location", cLoc, setCLoc, masters.locationId ?? [])}
          {select("Work schedule", cSched, setCSched, masters.workScheduleId ?? [])}
          {select("Manager", cMgr, setCMgr, employees, "fullName")}
          <div className="sm:col-span-3">
            <button
              type="button"
              disabled={busy || !cFrom}
              onClick={addContract}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Add contract
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Assets issued</h3>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-2">Asset</th>
              <th className="py-2 pr-2">Tag</th>
              <th className="py-2 pr-2">Condition</th>
              <th className="py-2 pr-2">Issued</th>
              <th className="py-2 pr-2">Returned</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-100">
                <td className="py-2 pr-2">{a.name}</td>
                <td className="py-2 pr-2 font-mono text-xs">{a.assetTag || "—"}</td>
                <td className="py-2 pr-2 text-xs">{a.condition || "—"}</td>
                <td className="py-2 pr-2 text-xs">{dateOnly(a.issuedAt)}</td>
                <td className="py-2 pr-2 text-xs">{a.returnedAt ? dateOnly(a.returnedAt) : "—"}</td>
                <td className="py-2 text-right">
                  {!a.returnedAt && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => returnAsset(a.id)}
                      className="text-xs font-semibold text-slate-600 hover:underline"
                    >
                      Mark returned
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {assets.length === 0 && (
              <tr><td className="py-3 text-sm text-slate-500" colSpan={6}>No assets issued.</td></tr>
            )}
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Asset name" value={aName} onChange={(e) => setAName(e.target.value)} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Tag (optional)" value={aTag} onChange={(e) => setATag(e.target.value)} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Condition (optional)" value={aCond} onChange={(e) => setACond(e.target.value)} />
          <button
            type="button"
            disabled={busy || !aName.trim()}
            onClick={issueAsset}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Issue asset
          </button>
        </div>
      </section>
    </div>
  );
}
