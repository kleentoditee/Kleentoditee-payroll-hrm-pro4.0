"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function DashboardPage() {
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [draftRuns, setDraftRuns] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [timeRes, runRes] = await Promise.all([
      fetch(`${apiBase()}/time/entries?queue=all&status=submitted`, { headers: { ...authHeaders() } }),
      fetch(`${apiBase()}/payroll/runs?status=draft`, { headers: { ...authHeaders() } })
    ]);
    if (!timeRes.ok || !runRes.ok) {
      throw new Error("Could not load dashboard metrics.");
    }
    const timeJson = (await timeRes.json()) as { items: unknown[] };
    const runJson = (await runRes.json()) as { items: unknown[] };
    return { submitted: timeJson.items.length, drafts: runJson.items.length };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await load();
        if (!cancelled) {
          setSubmittedCount(m.submitted);
          setDraftRuns(m.drafts);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load");
          setSubmittedCount(null);
          setDraftRuns(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Home</p>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">Dashboard</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          People, time, payroll, and audit routes are available from this console. Metrics below refresh when you open
          this page.
        </p>
        {error ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">{error}</p>
        ) : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time approvals</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {submittedCount === null ? "—" : submittedCount}
            </p>
            <p className="mt-1 text-sm text-slate-600">Submitted timesheets waiting for approval</p>
            <Link
              href="/dashboard/time/approvals"
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              Open approval queue →
            </Link>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50/90 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payroll drafts</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{draftRuns === null ? "—" : draftRuns}</p>
            <p className="mt-1 text-sm text-slate-600">Pay runs still in draft (finalize when ready)</p>
            <Link
              href="/dashboard/payroll/runs"
              className="mt-3 inline-block text-sm font-semibold text-brand hover:underline"
            >
              View pay runs →
            </Link>
          </article>
        </div>
        <p className="mt-6 flex flex-wrap gap-4">
          <Link
            href="/dashboard/people/employees"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            People — employees
          </Link>
          <Link
            href="/dashboard/time/entries"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            Time — timesheets
          </Link>
          <Link
            href="/dashboard/payroll/periods"
            className="text-sm font-semibold text-brand underline-offset-2 hover:underline"
          >
            Payroll — periods
          </Link>
          <Link href="/dashboard/audit" className="text-sm font-semibold text-brand underline-offset-2 hover:underline">
            Audit log
          </Link>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Workflow",
            body: "Draft → submit timesheets from the entry editor. Managers approve under Time → Approvals. Payroll admins build periods and runs from approved time."
          },
          {
            title: "Payroll status",
            body: "Pay periods, draft and finalized runs, paystubs, and CSV export are wired through the API and admin UI."
          },
          {
            title: "API",
            body: "Authenticated routes use JWT from /auth/login. Health check stays public at /health."
          },
          {
            title: "Deduction templates",
            body: "Each template can be loaded by id for faster edits; employees reference a template for NHI, SSB, and income tax rules."
          }
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-700"
          >
            <h3 className="font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-2 leading-relaxed">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
