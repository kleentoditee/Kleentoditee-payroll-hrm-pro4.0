"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { authHeaders, clearToken, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type EntryRow = {
  id: string;
  month: string;
  site: string;
  status: string;
  daysWorked: number;
  hoursWorked: number;
  overtimeHours: number;
  notes: string;
  updatedAt: string;
};

type ProfileRes = { employee?: { fullName: string; defaultSite: string; paySchedule: string } };

function payScheduleLabel(s: string): string {
  if (s === "weekly" || s === "biweekly" || s === "monthly") {
    return s;
  }
  return s;
}
type ListRes = { month: string; items: EntryRow[] };
type OneEntryRes = { entry?: EntryRow };

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default function TrackerHome() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState<string>("");
  const [paySchedule, setPaySchedule] = useState<string>("");
  const [month, setMonth] = useState(() => monthKeyFromDate(new Date()));
  const [items, setItems] = useState<EntryRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [site, setSite] = useState("");
  const [days, setDays] = useState("");
  const [hours, setHours] = useState("");
  const [ot, setOt] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!getToken()) {
      return;
    }
    setLoadError(null);
    const resP = await fetch(`${apiBase()}/time/self/profile`, { headers: { ...authHeaders() } });
    const { data: prof } = await readApiJson<ProfileRes>(resP);
    if (resP.ok && prof?.employee) {
      setName(prof.employee.fullName);
      setPaySchedule(prof.employee.paySchedule);
      setSite((prev) => prev || (prof.employee?.defaultSite ?? ""));
    }
    const resL = await fetch(`${apiBase()}/time/self/entries?month=${encodeURIComponent(month)}`, {
      headers: { ...authHeaders() }
    });
    const { data: list, rawText } = await readApiJson<ListRes & { error?: string }>(resL);
    if (!resL.ok) {
      setLoadError(list?.error ?? (rawText || `Error ${resL.status}`));
      setItems([]);
      return;
    }
    setItems(list?.items ?? []);
  }, [month]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!getToken()) {
      setReady(true);
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
  }, [load, month]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase()}/time/self/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          month,
          site: site.trim(),
          daysWorked: days === "" ? 0 : Number(days),
          hoursWorked: hours === "" ? 0 : Number(hours),
          overtimeHours: ot === "" ? 0 : Number(ot),
          notes: notes.trim()
        })
      });
      const { data, rawText } = await readApiJson<OneEntryRes>(res);
      if (!res.ok) {
        setFormError((data as { error?: string })?.error ?? (rawText || "Could not save"));
        return;
      }
      setDays("");
      setHours("");
      setOt("");
      setNotes("");
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
    if (!res.ok) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setLoadError(data?.error ?? rawText);
      return;
    }
    await load();
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this draft line?")) {
      return;
    }
    setLoadError(null);
    const res = await fetch(`${apiBase()}/time/self/entries/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
    });
    if (!res.ok && res.status !== 204) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setLoadError(data?.error ?? rawText);
      return;
    }
    await load();
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  if (!getToken()) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f2f38] from-0% via-[#f6f8fa] via-20% to-[#eef2f5] to-100%">
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-black/25">
            KT
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KleenToDiTee</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Remote time entry</h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            Use this app on your phone or browser to add time lines by month, keep drafts, and submit to your payroll
            team for approval. Your pay basis (daily, hourly, or fixed) and pay schedule (weekly, biweekly, or monthly) are
            stored on your employee profile in KleenToDiTee and used on the payroll run.
          </p>
          <ul className="w-full max-w-sm space-y-2 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left text-sm text-slate-700 shadow-md shadow-slate-200/50">
            <li className="flex gap-2">
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>
              <span>Secure sign-in (same company users as the admin app).</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>
              <span>Monthly time lines — pick the pay month and add days, hours, and overtime as needed.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-emerald-600" aria-hidden>
                ✓
              </span>
              <span>Submit when ready; payroll reviews and approves in the admin console.</span>
            </li>
          </ul>
          <Link
            className="rounded-2xl bg-brand px-10 py-3.5 text-lg font-semibold text-white shadow-md shadow-brand/30"
            href="/login"
          >
            Sign in
          </Link>
          <p className="text-xs text-slate-500">If you do not have an account, ask your manager or HR to invite and link you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
          <h1 className="text-xl font-semibold text-slate-900">{name || "My time"}</h1>
          {paySchedule ? (
            <p className="mt-0.5 text-xs capitalize text-slate-500">Pay schedule: {payScheduleLabel(paySchedule)}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 active:bg-slate-100"
        >
          Sign out
        </button>
      </header>

      <nav aria-label="Staff Hub" className="mb-6 grid grid-cols-2 gap-2">
        <span className="rounded-xl bg-brand/10 px-3 py-2 text-center text-sm font-semibold text-brand">
          Time
        </span>
        <Link
          href="/requests"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 active:bg-slate-100"
        >
          Requests
        </Link>
      </nav>

      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500">Month</label>
        <input
          type="month"
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <form onSubmit={addEntry} className="mb-8 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Add time line</h2>
        <p className="mb-3 text-xs text-slate-500">Creates a <strong>draft</strong> row for the selected month. Submit when ready.</p>
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Site / job</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-sm">
              <span className="text-slate-600">Days</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">Hours</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="text-sm">
              <span className="text-slate-600">OT hrs</span>
              <input
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                value={ot}
                onChange={(e) => setOt(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="text-slate-600">Notes</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 w-full rounded-2xl bg-brand py-3 text-base font-semibold text-white active:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save draft"}
        </button>
      </form>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">This month</h2>
      {loadError ? <p className="mb-2 text-sm text-red-600">{loadError}</p> : null}
      <ul className="flex flex-col gap-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-3 py-6 text-center text-sm text-slate-500">
            No lines for {month} yet.
          </li>
        ) : (
          items.map((e) => (
            <li key={e.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{e.site || "—"}</p>
                  <p className="text-sm text-slate-600">
                    {e.daysWorked}d · {e.hoursWorked}h · {e.overtimeHours}h OT
                  </p>
                  {e.notes ? <p className="mt-1 text-xs text-slate-500">{e.notes}</p> : null}
                </div>
                <span
                  className={
                    e.status === "draft"
                      ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      : e.status === "submitted"
                        ? "rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                  }
                >
                  {e.status}
                </span>
              </div>
              {e.status === "draft" ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void submitEntry(e.id)}
                    className="flex-1 rounded-xl bg-brand py-2 text-sm font-semibold text-white"
                  >
                    Submit for approval
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteEntry(e.id)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
