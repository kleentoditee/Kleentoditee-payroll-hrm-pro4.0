"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type PaystubDetail = {
  id: string;
  stubNumber: string;
  createdAt: string;
  issuedAt: string;
  payload: {
    employeeName: string;
    employeeRole: string;
    site: string;
    templateName: string;
    periodLabel: string;
    schedule: string;
    startDate: string;
    endDate: string;
    payDate: string | null;
    earnings: { gross: number; bonus: number; allowance: number; flatGross: number };
    deductions: {
      nhi: number;
      ssb: number;
      incomeTax: number;
      manual: number;
      advance: number;
      withdrawal: number;
      loan: number;
      other: number;
      total: number;
    };
    totals: { daysWorked: number; hoursWorked: number; overtimeHours: number; net: number };
  };
};

function formatMoney(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export default function PaystubPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const [paystub, setPaystub] = useState<PaystubDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/payroll/paystubs/${id}`, {
          headers: { ...authHeaders() }
        });
        const data = (await res.json()) as { error?: string; paystub?: PaystubDetail };
        if (!res.ok || !data.paystub) {
          throw new Error(data.error ?? "Load failed");
        }
        if (!cancelled) {
          setPaystub(data.paystub);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
          setPaystub(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!paystub) {
    return <p className="text-sm text-slate-600">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <Link href="/dashboard/payroll/runs" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back to runs
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Print paystub
        </button>
      </div>

      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Kleentoditee</p>
            <h2 className="mt-1 font-serif text-3xl text-slate-900">Paystub</h2>
            <p className="mt-2 text-sm text-slate-600">{paystub.stubNumber}</p>
          </div>
          <div className="text-sm text-slate-600">
            <p>Issued: {paystub.issuedAt.slice(0, 10)}</p>
            <p>Pay date: {paystub.payload.payDate ?? "-"}</p>
            <p>{paystub.payload.periodLabel}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Employee</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{paystub.payload.employeeName}</p>
              <p>{paystub.payload.employeeRole || "-"}</p>
              <p>{paystub.payload.site || "-"}</p>
              <p>Template: {paystub.payload.templateName}</p>
              <p>Schedule: {paystub.payload.schedule}</p>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-500">Period</h3>
            <div className="mt-3 space-y-1 text-sm text-slate-700">
              <p>{paystub.payload.startDate}</p>
              <p>{paystub.payload.endDate}</p>
              <p>Days: {paystub.payload.totals.daysWorked}</p>
              <p>Hours: {paystub.payload.totals.hoursWorked}</p>
              <p>OT hours: {paystub.payload.totals.overtimeHours}</p>
            </div>
          </section>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-900">Earnings</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <dt>Gross</dt>
                <dd>{formatMoney(paystub.payload.earnings.gross)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Bonus</dt>
                <dd>{formatMoney(paystub.payload.earnings.bonus)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Allowance</dt>
                <dd>{formatMoney(paystub.payload.earnings.allowance)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Flat gross override</dt>
                <dd>{formatMoney(paystub.payload.earnings.flatGross)}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-2xl bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-900">Deductions</h3>
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <dt>NHI</dt>
                <dd>{formatMoney(paystub.payload.deductions.nhi)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>SSB</dt>
                <dd>{formatMoney(paystub.payload.deductions.ssb)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Income tax</dt>
                <dd>{formatMoney(paystub.payload.deductions.incomeTax)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Manual deductions</dt>
                <dd>{formatMoney(paystub.payload.deductions.manual)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Total deductions</dt>
                <dd>{formatMoney(paystub.payload.deductions.total)}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-8 rounded-2xl bg-brand px-6 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80">Net pay</p>
          <p className="mt-2 text-4xl font-semibold">{formatMoney(paystub.payload.totals.net)}</p>
        </div>
      </article>
    </div>
  );
}
