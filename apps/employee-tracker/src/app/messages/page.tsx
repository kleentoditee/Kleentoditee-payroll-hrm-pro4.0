"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth-storage";
import { CLEANING_TIPS, pickForDay } from "@/lib/staff-hub-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type AnnRow = { id: string; title: string; body: string; category: string };

export default function MessagesPage() {
  const router = useRouter();
  const tip = useMemo(() => pickForDay(CLEANING_TIPS, new Date()), []);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<AnnRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`${apiBase()}/staff/self/announcements`, { headers: { ...authHeaders() } });
    const { data, rawText } = await readApiJson<{ items?: AnnRow[]; error?: string }>(res);
    if (!res.ok) {
      setError(data?.error ?? rawText ?? `Error ${res.status}`);
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, []);

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
          <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
          Home
        </Link>
      </header>

      <section className="mb-4 rounded-2xl border border-teal-100 bg-teal-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-teal-800">Daily tip</p>
        <p className="mt-2 text-sm text-slate-800">{tip}</p>
      </section>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-sm text-slate-500">No announcements right now.</li>
        ) : (
          items.map((a) => (
            <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{a.category}</p>
              <h2 className="mt-1 font-semibold text-slate-950">{a.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{a.body}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
