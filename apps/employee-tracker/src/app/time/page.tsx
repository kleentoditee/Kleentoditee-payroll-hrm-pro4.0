"use client";

import { apiBase, logApiUnreachable, readApiJson } from "@/lib/api";
import { authHeaders, clearToken, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type EntryRow = {
  id: string;
  month: string;
  periodStart: string | null;
  site: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  notes: string;
};
type ProfileRes = { employee?: { defaultSite: string } };
type ListRes = { month: string; items: EntryRow[]; error?: string };
type OneEntryRes = { entry?: EntryRow; error?: string };
type LocationLine = { id: number; site: string; startTime: string; endTime: string; breakMinutes: string };

function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(d: Date): string {
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

export default function TimePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [month, setMonth] = useState(() => monthKeyFromDate(new Date()));
  const [items, setItems] = useState<EntryRow[]>([]);
  const [workDate, setWorkDate] = useState(() => dateKey(new Date()));
  const [locations, setLocations] = useState<LocationLine[]>([
    { id: 1, site: "", startTime: "", endTime: "", breakMinutes: "0" }
  ]);
  const [notes, setNotes] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      return;
    }
    setLoadError(null);
    try {
      const base = apiBase();
      const profileRes = await fetch(`${base}/time/self/profile`, { headers: { ...authHeaders() } });
      if (profileRes.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      const profile = await readApiJson<ProfileRes>(profileRes);
      if (profileRes.ok && profile.data?.employee) {
        setLocations((current) => current.map((location, index) =>
          index === 0 && !location.site ? { ...location, site: profile.data?.employee?.defaultSite || "" } : location
        ));
      }
      const res = await fetch(`${base}/time/self/entries?month=${encodeURIComponent(month)}`, {
        headers: { ...authHeaders() }
      });
      if (res.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      const { data, rawText } = await readApiJson<ListRes>(res);
      if (!res.ok) {
        setLoadError(data?.error ?? rawText ?? `Error ${res.status}`);
        setItems([]);
        return;
      }
      setItems(data?.items ?? []);
    } catch (err) {
      logApiUnreachable(err);
      setLoadError("Cannot reach the payroll server.");
      setItems([]);
    }
  }, [month, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    setReady(false);
    void load().finally(() => {
      if (!cancelled) {
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const submitForApproval = submitter?.value === "submit";

    if (!workDate || locations.some((location) => !location.startTime || !location.endTime || !location.site.trim())) {
      setFormError("Enter the work date, location, start time, and finish time for every row.");
      return;
    }
    if (locations.some((location) => !Number.isInteger(Number(location.breakMinutes)) || Number(location.breakMinutes) < 0)) {
      setFormError("Break must be entered as non-negative whole minutes.");
      return;
    }

    setSaving(true);
    try {
      const entryMonth = workDate.slice(0, 7);
      const res = await fetch(`${apiBase()}/time/self/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          month: entryMonth,
          periodStart: workDate,
          periodEnd: workDate,
          locations: locations.map((location) => ({
            site: location.site.trim(), startTime: location.startTime, endTime: location.endTime,
            breakMinutes: Number(location.breakMinutes)
          })),
          submit: submitForApproval,
          notes: notes.trim()
        })
      });
      const { data, rawText } = await readApiJson<OneEntryRes>(res);
      if (res.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setFormError(data?.error ?? rawText ?? "Could not save");
        return;
      }
      setLocations((current) => [{ id: 1, site: current[0]?.site ?? "", startTime: "", endTime: "", breakMinutes: "0" }]);
      setNotes("");
      setMonth(entryMonth);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitEntry(id: string) {
    setLoadError(null);
    const res = await fetch(`${apiBase()}/time/self/entries/${id}/submit`, {
      method: "POST",
      headers: { ...authHeaders() }
    });
    if (res.status === 401) {
      clearToken();
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setLoadError(data?.error ?? rawText);
      return;
    }
    await load();
  }

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

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this draft line?")) {
      return;
    }
    const res = await fetch(`${apiBase()}/time/self/entries/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (res.status === 401) {
      clearToken();
      router.replace("/login");
      return;
    }
    if (!res.ok && res.status !== 204) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setLoadError(data?.error ?? rawText);
      return;
    }
    await load();
  }

  if (!ready) {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">Time</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">Home</Link>
      </header>

      <form onSubmit={addEntry} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mt-3 grid gap-3">
          <label className="text-sm"><span className="text-slate-600">Work date</span><input type="date" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required /></label>
          <div className="divide-y divide-slate-200 border-y border-slate-200">
            {locations.map((location, index) => (
              <div key={location.id} className="space-y-3 py-4">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-800">Location {index + 1}</p>{locations.length > 1 ? <button type="button" onClick={() => removeLocation(location.id)} className="text-sm font-semibold text-red-700">Remove</button> : null}</div>
                <label className="block text-sm"><span className="text-slate-600">Work location</span><input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={location.site} onChange={(e) => updateLocation(location.id, "site", e.target.value)} placeholder="Customer, property, or job site" required /></label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm"><span className="text-slate-600">Start time</span><input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={location.startTime} onChange={(e) => updateLocation(location.id, "startTime", e.target.value)} required /></label>
                  <label className="text-sm"><span className="text-slate-600">Finish time</span><input type="time" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={location.endTime} onChange={(e) => updateLocation(location.id, "endTime", e.target.value)} required /></label>
                </div>
                <div className="grid grid-cols-[1fr,90px] gap-2">
                  <label className="text-sm"><span className="text-slate-600">Unpaid break (minutes)</span><input type="number" min="0" step="1" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={location.breakMinutes} onChange={(e) => updateLocation(location.id, "breakMinutes", e.target.value)} /></label>
                  <label className="text-sm"><span className="text-slate-600">Hours</span><output className="mt-1 block rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-semibold">{shiftHours(location.startTime, location.endTime, location.breakMinutes).toFixed(2)}</output></label>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2"><button type="button" onClick={addLocation} className="rounded-lg border border-brand px-3 py-2 text-sm font-semibold text-brand">+ Add location</button><span className="text-sm font-semibold text-slate-800">Total {locations.reduce((total, location) => total + shiftHours(location.startTime, location.endTime, location.breakMinutes), 0).toFixed(2)}h</span></div>
          <input className="rounded-lg border border-slate-200 px-3 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
        </div>

        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        <div className="mt-4 grid grid-cols-[1fr,auto] gap-2">
          <button type="submit" name="intent" value="submit" disabled={saving} className="rounded-2xl bg-brand py-3 font-semibold text-white disabled:opacity-60">
            {saving ? "Saving..." : "Submit for approval"}
          </button>
          <button type="submit" name="intent" value="draft" disabled={saving} className="rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 disabled:opacity-60">
            Save draft
          </button>
        </div>
      </form>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-800">This month</h2>
      {loadError ? <p className="mb-2 text-sm text-red-600">{loadError}</p> : null}
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-sm text-slate-500">No lines for {month} yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{item.site}</p>
                  <p className="text-sm text-slate-500">{item.periodStart?.slice(0, 10) || item.month} · {item.startTime || "-"} to {item.endTime || "-"} · {item.hoursWorked} hours</p>
                  {item.notes ? <p className="mt-1 text-sm text-slate-600">{item.notes}</p> : null}
                </div>
                <span className="text-xs uppercase text-slate-500">{item.status}</span>
              </div>
              {item.status === "draft" ? (
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => void submitEntry(item.id)} className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">Submit</button>
                  <button type="button" onClick={() => void deleteEntry(item.id)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">Delete</button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
