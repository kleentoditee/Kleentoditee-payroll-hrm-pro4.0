"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type RunSummary = {
  id: string;
  status: string;
  summary: { gross: number; totalDeductions: number; net: number };
};

type PeriodDetail = {
  id: string;
  label: string;
  schedule: "weekly" | "biweekly" | "monthly";
  startDate: string;
  endDate: string;
  payDate: string | null;
  notes: string;
  runs: RunSummary[];
};

function formatMoney(value: number): string {
  return value.toFixed(2);
}

export default function PayrollPeriodDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");

  const [period, setPeriod] = useState<PeriodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingRun, setCreatingRun] = useState(false);

  const [label, setLabel] = useState("");
  const [schedule, setSchedule] = useState<"weekly" | "biweekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [payDate, setPayDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadPeriod = useCallback(async (isCancelled: () => boolean = () => false) => {
    try {
      const res = await fetch(`${apiBase()}/payroll/periods/${id}`, {
        headers: { ...authHeaders() }
      });
      const data = (await res.json()) as { error?: string; period?: PeriodDetail };
      if (!res.ok || !data.period) {
        throw new Error(data.error ?? "Load failed");
      }
      if (isCancelled()) {
        return;
      }
      setPeriod(data.period);
      setLabel(data.period.label);
      setSchedule(data.period.schedule);
      setStartDate(data.period.startDate.slice(0, 10));
      setEndDate(data.period.endDate.slice(0, 10));
      setPayDate(data.period.payDate ? data.period.payDate.slice(0, 10) : "");
      setNotes(data.period.notes ?? "");
      setError(null);
    } catch (e) {
      if (isCancelled()) {
        return;
      }
      setError(e instanceof Error ? e.message : "Load failed");
      setPeriod(null);
    } finally {
      if (!isCancelled()) {
        setLoading(false);
      }
    }
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    void loadPeriod(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadPeriod]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/periods/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          label,
          schedule,
          startDate,
          endDate,
          payDate: payDate || null,
          notes
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Save failed");
      }
      await loadPeriod();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onCreateRun() {
    setCreatingRun(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/payroll/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ periodId: id })
      });
      const data = (await res.json()) as { error?: string; run?: { id: string } };
      if (!res.ok || !data.run) {
        throw new Error(data.error ?? "Create failed");
      }
      router.push(`/dashboard/payroll/runs/${data.run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreatingRun(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  if (!period) {
    return <p className="text-sm text-slate-600">Period not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payroll</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">{period.label}</h2>
        </div>
        <Link href="/dashboard/payroll/periods" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back to periods
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <form onSubmit={onSave} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-2">
        <label className="text-sm">
          <span className="text-slate-700">Label</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Schedule</span>
          <select
            value={schedule}
            onChange={(e) => setSchedule(e.target.value as typeof schedule)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          >
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Pay date</span>
          <input
            type="date"
            value={payDate}
            onChange={(e) => setPayDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-slate-700">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="lg:col-span-2 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save period"}
          </button>
          <button
            type="button"
            disabled={creatingRun || period.runs.length > 0}
            onClick={onCreateRun}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            {creatingRun ? "Building..." : period.runs.length > 0 ? "Run already exists" : "Create pay run"}
          </button>
        </div>
      </form>

      <section className="space-y-4">
        <div>
          <h3 className="font-serif text-xl text-slate-900">Runs for this period</h3>
          <p className="mt-1 text-sm text-slate-600">
            A period can produce one draft run, which then becomes the immutable payroll snapshot for export and
            paystubs.
          </p>
        </div>
        {period.runs.length === 0 ? (
          <p className="text-sm text-slate-600">No run yet for this period.</p>
        ) : (
          <div className="grid gap-4">
            {period.runs.map((run) => (
              <article key={run.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold capitalize text-slate-900">{run.status}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Gross {formatMoney(run.summary.gross)} | Net {formatMoney(run.summary.net)}
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/payroll/runs/${run.id}`}
                    className="text-sm font-semibold text-brand hover:underline"
                  >
                    Open run
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
