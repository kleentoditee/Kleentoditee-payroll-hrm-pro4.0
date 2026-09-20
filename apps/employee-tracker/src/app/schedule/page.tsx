"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addLocalDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export default function SchedulePage() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<WorkAssignmentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const from = localYmd(today);
    const to = localYmd(addLocalDays(today, 7));
    const res = await fetch(`${apiBase()}/staff/self/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      headers: { ...authHeaders() }
    });
    const { data, rawText } = await readApiJson<{ items?: WorkAssignmentRow[]; error?: string }>(res);
    if (!res.ok) {
      setError(data?.error ?? rawText ?? `Error ${res.status}`);
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, [today]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void load().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  if (!ready) {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">Schedule</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">Home</Link>
      </header>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-sm text-slate-500">No assignments in the next week.</li>
        ) : (
          items.map((s) => (
            <li key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{s.date}</p>
              <h2 className="mt-1 font-semibold text-slate-950">{s.locationName}</h2>
              {s.locationAddress ? <p className="mt-1 text-sm text-slate-600">{s.locationAddress}</p> : null}
              <p className="mt-2 text-sm text-slate-700">{s.startTime && s.endTime ? `${s.startTime} - ${s.endTime}` : "Time TBD"} · {s.status}</p>
              {s.notes ? <p className="mt-2 text-sm text-slate-600">{s.notes}</p> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
