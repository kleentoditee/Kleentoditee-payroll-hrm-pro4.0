"use client";

import { apiBase, logApiUnreachable, readApiJson } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaystubRow = {
  id: string;
  stubNumber: string;
  issuedAt: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  gross: number;
  net: number;
};
type ListRes = { items: PaystubRow[]; error?: string };

function formatMoney(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export default function PaystubsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<PaystubRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/self/paystubs`, { headers: { ...authHeaders() } });
      const { data, rawText } = await readApiJson<ListRes>(res);
      if (!res.ok) {
        setError(data?.error ?? rawText ?? `Error ${res.status}`);
        setItems([]);
        return;
      }
      setItems(data?.items ?? []);
    } catch (err) {
      logApiUnreachable(err);
      setError("Cannot reach the payroll server.");
      setItems([]);
    }
  }, []);

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

  if (!ready) {
    return <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">Paystubs</h1>
        </div>
        <Link href="/" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">Home</Link>
      </header>
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-sm text-slate-500">No paystubs yet.</li>
        ) : (
          items.map((stub) => (
            <li key={stub.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <Link href={`/paystubs/${stub.id}`} className="block active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{stub.periodLabel}</p>
                    <p className="text-sm text-slate-500">{stub.startDate?.slice(0, 10)} - {stub.endDate?.slice(0, 10)}</p>
                    <p className="mt-1 text-xs text-slate-400">{stub.stubNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Net</p>
                    <p className="text-lg font-semibold text-slate-900">{formatMoney(stub.net)}</p>
                  </div>
                </div>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
