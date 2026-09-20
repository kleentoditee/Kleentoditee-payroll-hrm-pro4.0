"use client";

import { apiBase, logApiUnreachable, readApiJson } from "@/lib/api";
import { authHeaders, clearToken } from "@/lib/auth-storage";
import { greetingForTime } from "@/lib/staff-hub-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ProfileRes = { employee?: { fullName: string; defaultSite: string; paySchedule: string } };
type WorkAssignmentRow = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  locationName: string;
  status: string;
};

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function payScheduleLabel(s: string): string {
  return s === "weekly" || s === "biweekly" || s === "monthly" ? s : s;
}

function AppTile({
  href,
  title,
  detail
}: {
  href: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm active:scale-[0.99]"
    >
      <span className="block text-base font-semibold text-slate-950">{title}</span>
      <span className="mt-1 block text-sm text-slate-500">{detail}</span>
    </Link>
  );
}

export default function TrackerHome() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [paySchedule, setPaySchedule] = useState("");
  const [todayItems, setTodayItems] = useState<WorkAssignmentRow[]>([]);
  const [messageCount, setMessageCount] = useState<number | null>(null);
  const [rewardPoints, setRewardPoints] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const greeting = greetingForTime(today);
  const displayName = name.trim() || "Team member";

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const base = apiBase();
      const h = { ...authHeaders() };
      const [profileRes, todayRes, annRes, rewardsRes] = await Promise.all([
        fetch(`${base}/time/self/profile`, { headers: h }),
        fetch(`${base}/staff/self/schedule/today`, { headers: h }),
        fetch(`${base}/staff/self/announcements`, { headers: h }),
        fetch(`${base}/staff/self/rewards/summary`, { headers: h })
      ]);

      if (profileRes.status === 401) {
        router.replace("/login");
        return;
      }
      const profile = await readApiJson<ProfileRes>(profileRes);
      if (profileRes.ok && profile.data?.employee) {
        setName(profile.data.employee.fullName);
        setPaySchedule(profile.data.employee.paySchedule);
      }

      const todayJson = await readApiJson<{ items?: WorkAssignmentRow[] }>(todayRes);
      setTodayItems(todayRes.ok ? (todayJson.data?.items ?? []) : []);

      const annJson = await readApiJson<{ items?: unknown[] }>(annRes);
      setMessageCount(annRes.ok ? (annJson.data?.items?.length ?? 0) : null);

      const rewardsJson = await readApiJson<{ totalPoints?: number }>(rewardsRes);
      setRewardPoints(rewardsRes.ok ? (rewardsJson.data?.totalPoints ?? 0) : null);
    } catch (err) {
      logApiUnreachable(err);
      setLoadError("Cannot reach the payroll server.");
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
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

  function logout() {
    void fetch(`${apiBase()}/auth/logout`, {
      method: "POST",
      headers: { ...authHeaders() }
    }).catch(() => undefined);
    clearToken();
    router.push("/login");
  }

  if (!ready) {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">
            {greeting}, {displayName}
          </h1>
          {paySchedule ? <p className="mt-0.5 text-xs capitalize text-slate-500">{payScheduleLabel(paySchedule)} pay schedule</p> : null}
        </div>
        <button type="button" onClick={logout} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 active:bg-slate-100">
          Sign out
        </button>
      </header>

      {loadError ? <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{loadError}</p> : null}

      <section className="mb-4 rounded-2xl bg-[#0f2f38] p-4 text-white shadow-sm">
        <p className="text-xs uppercase tracking-widest text-white/60">{localYmd(today)}</p>
        <h2 className="mt-2 text-lg font-semibold">Today</h2>
        {todayItems.length === 0 ? (
          <p className="mt-2 text-sm text-white/75">No work assignment posted for today.</p>
        ) : (
          <div className="mt-2 space-y-1">
            {todayItems.slice(0, 2).map((item) => (
              <p key={item.id} className="text-sm text-white/85">
                <span className="font-semibold text-white">{item.locationName}</span>
                {item.startTime && item.endTime ? `, ${item.startTime}-${item.endTime}` : ""}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="grid flex-1 content-start gap-3">
        <AppTile href="/time" title="Time" detail="Add hours and submit lines" />
        <AppTile href="/paystubs" title="Paystubs" detail="View your pay history" />
        <AppTile href="/schedule" title="Schedule" detail="Today and next 7 days" />
        <AppTile href="/requests" title="Requests" detail="Time off, supplies, profile changes" />
        <AppTile href="/messages" title="Messages" detail={messageCount === null ? "Company announcements" : `${messageCount} current announcement${messageCount === 1 ? "" : "s"}`} />
        <AppTile href="/rewards" title="Rewards" detail={rewardPoints === null ? "Quiz and points" : `${rewardPoints} points`} />
      </div>
    </div>
  );
}
