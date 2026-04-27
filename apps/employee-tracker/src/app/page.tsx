"use client";

import { apiBase, readApiJson } from "@/lib/api";
import {
  CLEANING_TIPS,
  DAILY_QUIZZES,
  greetingForTime,
  pickForDay
} from "@/lib/staff-hub-data";
import { authHeaders, clearToken, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

type WorkAssignmentRow = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  locationName: string;
  locationAddress: string | null;
  notes: string | null;
  status: string;
};

type AnnRow = { id: string; title: string; body: string; category: string; createdAt: string };
type DailyQuizApi = { id: string; question: string; choices: string[] };

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addLocalDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function scrollToId(id: string) {
  if (typeof document === "undefined") {
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function HubSection({
  id,
  title,
  sub,
  children
}: {
  id: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-slate-900">{title}</h2>
      {sub ? <p className="mt-0.5 text-xs text-slate-500">{sub}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
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

  const [scheduleToday, setScheduleToday] = useState<WorkAssignmentRow[] | null>(null);
  const [scheduleWeek, setScheduleWeek] = useState<WorkAssignmentRow[] | null>(null);
  const [announcements, setAnnouncements] = useState<AnnRow[] | null>(null);
  const [dailyQuizFromApi, setDailyQuizFromApi] = useState<DailyQuizApi | null>(null);
  const [dailyQuizLoading, setDailyQuizLoading] = useState(false);
  const [rewardPoints, setRewardPoints] = useState<number | null>(null);
  const [staffHubErr, setStaffHubErr] = useState<string | null>(null);

  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const localDailyQuiz = useMemo(() => pickForDay(DAILY_QUIZZES, today), [today]);
  const cleaningTip = useMemo(() => pickForDay(CLEANING_TIPS, today), [today]);
  const greeting = greetingForTime(today);
  const displayName = name.trim() || "Team member";

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

  const loadStaffHub = useCallback(async () => {
    if (!getToken()) {
      return;
    }
    setStaffHubErr(null);
    setDailyQuizLoading(true);
    try {
      const base = apiBase();
      const h = { ...authHeaders() };
      const from = localYmd(today);
      const to = localYmd(addLocalDays(today, 7));
      const [todayRes, wRes, aRes, qRes, rRes] = await Promise.all([
        fetch(`${base}/staff/self/schedule/today`, { headers: h }),
        fetch(`${base}/staff/self/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
          headers: h
        }),
        fetch(`${base}/staff/self/announcements`, { headers: h }),
        fetch(`${base}/staff/self/quiz/daily`, { headers: h }),
        fetch(`${base}/staff/self/rewards/summary`, { headers: h })
      ]);
      const tj = await readApiJson<{ items?: WorkAssignmentRow[] }>(todayRes);
      setScheduleToday(todayRes.ok ? (tj.data?.items ?? []) : []);
      const wj = await readApiJson<{ items?: WorkAssignmentRow[] }>(wRes);
      setScheduleWeek(wRes.ok ? (wj.data?.items ?? []) : []);
      const aj = await readApiJson<{ items?: AnnRow[] }>(aRes);
      setAnnouncements(aRes.ok ? (aj.data?.items ?? []) : []);
      const qj = await readApiJson<{ question?: DailyQuizApi | null }>(qRes);
      setDailyQuizFromApi(qRes.ok ? (qj.data?.question ?? null) : null);
      const rj = await readApiJson<{ totalPoints?: number }>(rRes);
      setRewardPoints(rRes.ok ? (rj.data?.totalPoints ?? 0) : null);
    } catch {
      setStaffHubErr("Could not load schedule or announcements.");
      setScheduleToday([]);
      setScheduleWeek([]);
      setAnnouncements([]);
      setDailyQuizFromApi(null);
    } finally {
      setDailyQuizLoading(false);
    }
  }, [today]);

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
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined" || !getToken()) {
      return;
    }
    void loadStaffHub();
  }, [loadStaffHub]);

  async function onQuizSelect(i: number) {
    if (dailyQuizFromApi) {
      setQuizChoice(i);
      setQuizFeedback(null);
      const res = await fetch(`${apiBase()}/staff/self/quiz/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ questionId: dailyQuizFromApi.id, selectedIndex: i })
      });
      const { data } = await readApiJson<{
        correct?: boolean;
        explanation?: string | null;
        error?: string;
      }>(res);
      if (res.status === 409) {
        setQuizFeedback(data?.error ?? "Already answered today.");
        return;
      }
      if (!res.ok) {
        setQuizFeedback(data?.error ?? "Could not submit answer.");
        return;
      }
      setQuizFeedback(
        data?.correct
          ? (data.explanation ?? "Correct — points added to your ledger.")
          : "Not quite — try again tomorrow."
      );
      await loadStaffHub();
      return;
    }
    setQuizChoice(i);
  }

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
        setFormError((data as { error?: string })?.error ?? rawText ?? "Could not save");
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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff Hub</h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-600">
            Sign in for time entry, your work schedule, company messages, and more. Same company account as the admin
            app.
          </p>
          <Link
            className="rounded-2xl bg-brand px-10 py-3.5 text-lg font-semibold text-white shadow-md shadow-brand/30"
            href="/login"
          >
            Sign in
          </Link>
          <p className="text-xs text-slate-500">If you do not have an account, ask HR to invite and link you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">
            {greeting}, {displayName}
          </h1>
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

      <nav aria-label="Staff Hub" className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <span className="rounded-xl bg-brand/10 px-2 py-2 text-center text-xs font-semibold text-brand sm:text-sm">
          Home
        </span>
        <Link
          href="/requests"
          className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-center text-xs font-semibold text-slate-700 active:bg-slate-100 sm:text-sm"
        >
          Requests
        </Link>
      </nav>

      <p className="mb-3 text-center text-sm text-slate-500">Quick links</p>
      <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:text-sm">
        {(
          [
            { label: "Today", id: "hub-today" },
            { label: "Checklist", id: "hub-checklist" },
            { label: "Time", id: "hub-time" },
            { label: "Schedule", id: "hub-week" },
            { label: "Messages", id: "hub-messages" },
            { label: "Tips", id: "hub-tips" },
            { label: "Quiz", id: "hub-quiz" }
          ] as const
        ).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => scrollToId(a.id)}
            className="min-h-12 rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-2 text-center font-semibold text-slate-800 shadow-sm active:scale-[0.98]"
          >
            {a.label}
          </button>
        ))}
      </div>

      {staffHubErr ? (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-900">
          {staffHubErr}
        </p>
      ) : null}

      <div className="space-y-4">
        <HubSection id="hub-today" title="Today" sub="Work assignment (location)">
          {scheduleToday === null ? (
            <p className="text-sm text-slate-500">Loading today…</p>
          ) : scheduleToday.length === 0 ? (
            <p className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">No schedule assigned for today.</span> When your manager
              posts an assignment, it will show here.
            </p>
          ) : (
            <ul className="space-y-2">
              {scheduleToday.map((s) => (
                <li key={s.id} className="rounded-xl border border-teal-100 bg-teal-50/80 px-3 py-2 text-sm text-slate-800">
                  <p className="font-semibold text-slate-900">{s.locationName}</p>
                  {s.locationAddress ? <p className="text-xs text-slate-600">{s.locationAddress}</p> : null}
                  <p className="mt-1 text-slate-700">
                    {s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : "Time TBD"}{" "}
                    <span className="rounded bg-white/80 px-1.5 text-xs text-slate-600">{s.status}</span>
                  </p>
                  {s.notes ? <p className="mt-1 text-xs text-slate-600">{s.notes}</p> : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
            <span className="font-semibold">Daily reminder</span> — check supplies, uniform, and your assigned site
            before work.
          </p>
        </HubSection>

        <HubSection id="hub-checklist" title="Daily checklist" sub="Coming soon">
          <p className="text-sm text-slate-600">
            A checklist (PPE, sign-in, equipment) may be linked to your schedule in a future update.
          </p>
        </HubSection>

        <HubSection id="hub-time" title="Time" sub="This month’s lines">
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500">Month</label>
            <input
              type="month"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <form onSubmit={addEntry} className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Add time line</h3>
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
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">Hours</span>
                  <input
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-600">OT</span>
                  <input
                    inputMode="decimal"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-2"
                    value={ot}
                    onChange={(e) => setOt(e.target.value)}
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
              className="mt-3 w-full rounded-2xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save draft"}
            </button>
          </form>
          {loadError ? <p className="mb-2 text-sm text-red-600">{loadError}</p> : null}
          <h3 className="mb-2 text-sm font-semibold text-slate-800">This month</h3>
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
                        Submit
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
        </HubSection>

        <HubSection id="hub-week" title="Schedule" sub="Next 7 days">
          {scheduleWeek === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : scheduleWeek.length === 0 ? (
            <p className="text-sm text-slate-600">No assignments in the next week.</p>
          ) : (
            <ul className="space-y-2 text-sm text-slate-800">
              {scheduleWeek.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-2">
                  <span className="font-medium">{s.date}</span> — {s.locationName}{" "}
                  <span className="text-xs text-slate-500">({s.status})</span>
                </li>
              ))}
            </ul>
          )}
        </HubSection>

        <HubSection id="hub-messages" title="Messages" sub="Company announcements (in-app)">
          {announcements === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-slate-600">No announcements right now.</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">{a.category}</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </HubSection>

        <HubSection id="hub-tips" title="Tips & training" sub="For fun and best practice">
          <p className="text-sm text-slate-700">{cleaningTip}</p>
        </HubSection>

        <HubSection id="hub-quiz" title="Quiz & rewards" sub="Engagement only — not pay">
          {rewardPoints !== null ? (
            <p className="mb-2 text-sm font-semibold text-emerald-900">Your points: {rewardPoints}</p>
          ) : null}
          {dailyQuizLoading ? (
            <p className="text-sm text-slate-500">Loading quiz…</p>
          ) : dailyQuizFromApi ? (
            <>
              <p className="mb-2 text-sm text-slate-600">{dailyQuizFromApi.question}</p>
              <div className="space-y-2">
                {dailyQuizFromApi.choices.map((opt, i) => {
                  const show = quizChoice !== null;
                  const chosen = quizChoice === i;
                  return (
                    <button
                      key={`${dailyQuizFromApi.id}-${i}`}
                      type="button"
                      disabled={quizChoice !== null}
                      onClick={() => void onQuizSelect(i)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                        show
                          ? chosen
                            ? quizFeedback?.includes("Already") || quizFeedback?.includes("Not quite")
                              ? "border-rose-300 bg-rose-50"
                              : "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-slate-50/80 opacity-60"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {quizFeedback ? <p className="mt-2 text-sm text-slate-800">{quizFeedback}</p> : null}
            </>
          ) : (
            <>
              <p className="mb-1 text-xs text-slate-500">No server quiz — practice question:</p>
              <p className="mb-2 text-sm text-slate-600">{localDailyQuiz.question}</p>
              <div className="space-y-2">
                {localDailyQuiz.options.map((opt, i) => {
                  const show = quizChoice !== null;
                  const correct = i === localDailyQuiz.correctIndex;
                  const chosen = quizChoice === i;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={quizChoice !== null}
                      onClick={() => onQuizSelect(i)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm ${
                        show
                          ? correct
                            ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                            : chosen
                              ? "border-rose-300 bg-rose-50"
                              : "border-slate-200 bg-slate-50/80 opacity-60"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {quizChoice !== null ? (
                <p
                  className={`mt-2 text-sm font-medium ${
                    quizChoice === localDailyQuiz.correctIndex ? "text-emerald-800" : "text-rose-800"
                  }`}
                >
                  {quizChoice === localDailyQuiz.correctIndex
                    ? localDailyQuiz.praise
                    : "Not quite — see tips above."}
                </p>
              ) : null}
            </>
          )}
        </HubSection>
      </div>
    </div>
  );
}
