"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useCallback, useEffect, useMemo, useState } from "react";

type EmployeeOpt = { id: string; fullName: string };

type Row = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  locationName: string;
  locationAddress: string | null;
  notes: string | null;
  status: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function ScheduleAdminPage() {
  const [from, setFrom] = useState(() => ymd(new Date()));
  const [to, setTo] = useState(() => ymd(new Date(Date.now() + 14 * 86_400_000)));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeOpt[] | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    date: ymd(new Date()),
    startTime: "08:00",
    endTime: "16:00",
    locationName: "",
    locationAddress: "",
    notes: ""
  });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rangeOk = useMemo(() => {
    return from && to && from <= to;
  }, [from, to]);

  const load = useCallback(async () => {
    if (!rangeOk) {
      return;
    }
    setErr(null);
    const res = await fetch(
      `${apiBase()}/admin/schedules?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { headers: { ...authHeaders() } }
    );
    const { data, rawText } = await readApiJson<{ items?: Row[]; error?: string }>(res);
    if (!res.ok) {
      setErr(data?.error ?? rawText ?? `Error ${res.status}`);
      setRows([]);
      return;
    }
    setRows(data?.items ?? []);
  }, [from, to, rangeOk]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`${apiBase()}/people/employees`, { headers: { ...authHeaders() } });
      const { data } = await readApiJson<{
        items?: Array<{ id: string; fullName: string; active: boolean }>;
      }>(res);
      if (res.ok && data?.items) {
        setEmployees(
          data.items
            .filter((e) => e.active)
            .map((e) => ({ id: e.id, fullName: e.fullName }))
            .sort((a, b) => a.fullName.localeCompare(b.fullName))
        );
      } else {
        setEmployees([]);
      }
    })();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!form.employeeId) {
      setFormErr("Select an employee.");
      return;
    }
    if (!form.locationName.trim()) {
      setFormErr("Location is required.");
      return;
    }
    setSaving(true);
    const res = await fetch(`${apiBase()}/admin/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        employeeId: form.employeeId,
        date: form.date,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        locationName: form.locationName.trim(),
        locationAddress: form.locationAddress.trim() || null,
        notes: form.notes.trim() || null
      })
    });
    const { data, rawText } = await readApiJson<{ error?: string }>(res);
    if (!res.ok) {
      setFormErr((data as { error?: string })?.error ?? rawText);
      setSaving(false);
      return;
    }
    setSaving(false);
    setForm((f) => ({ ...f, locationName: "", locationAddress: "", notes: "" }));
    await load();
  }

  async function cancelRow(id: string) {
    if (!window.confirm("Cancel this assignment?")) {
      return;
    }
    setBusyId(id);
    const res = await fetch(`${apiBase()}/admin/schedules/${id}/cancel`, {
      method: "POST",
      headers: { ...authHeaders() }
    });
    setBusyId(null);
    if (!res.ok) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setErr((data as { error?: string })?.error ?? rawText);
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 text-sm text-slate-500">
        <a href="/dashboard" className="text-teal-700 hover:underline">
          Dashboard
        </a>
        <span className="mx-2">/</span>
        <span className="text-slate-800">Work schedule</span>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">Work assignments</h1>
      <p className="mt-1 text-sm text-slate-600">
        Assign when and where (Phase 3). Staff see their own rows in the employee tracker.
      </p>

      {err ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-slate-600">From</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-600">To</span>
          <input
            type="date"
            className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
        >
          Refresh
        </button>
      </div>

      <form
        onSubmit={createAssignment}
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">New assignment</h2>
        {formErr ? <p className="mt-2 text-sm text-red-600">{formErr}</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Employee</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.employeeId}
              onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            >
              <option value="">Select…</option>
              {(employees ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Date</span>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="text-slate-600">Start</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">End</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
              />
            </label>
          </div>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Location *</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.locationName}
              onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Address (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.locationAddress}
              onChange={(e) => setForm((f) => ({ ...f, locationAddress: e.target.value }))}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-slate-600">Notes</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Create assignment"}
        </button>
      </form>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">In range</h2>
      {rows === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-600">No assignments in this range.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-2">{r.employeeName}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.startTime && r.endTime ? `${r.startTime} – ${r.endTime}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{r.locationName}</div>
                    {r.locationAddress ? <div className="text-xs text-slate-500">{r.locationAddress}</div> : null}
                    {r.notes ? <div className="text-xs text-slate-500">{r.notes}</div> : null}
                  </td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-right">
                    {r.status === "CANCELLED" ? null : (
                      <button
                        type="button"
                        className="text-sm text-rose-700 hover:underline"
                        disabled={busyId === r.id}
                        onClick={() => void cancelRow(r.id)}
                      >
                        {busyId === r.id ? "…" : "Cancel"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
