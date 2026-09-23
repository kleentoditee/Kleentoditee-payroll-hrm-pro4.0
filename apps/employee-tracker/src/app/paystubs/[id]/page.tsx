"use client";

import { apiBase, logApiUnreachable, readApiJson } from "@/lib/api";
import { authHeaders, getToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PaystubDetail = {
  id: string;
  stubNumber: string;
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
      payrollTax: number;
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
type OneRes = { paystub?: PaystubDetail; error?: string };

function formatMoney(value: unknown): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

export default function PaystubDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");
  const [ready, setReady] = useState(false);
  const [paystub, setPaystub] = useState<PaystubDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${apiBase()}/time/self/paystubs/${id}`, { headers: { ...authHeaders() } });
      const { data, rawText } = await readApiJson<OneRes>(res);
      if (!res.ok || !data?.paystub) {
        setError(data?.error ?? rawText ?? `Error ${res.status}`);
        setPaystub(null);
        return;
      }
      setPaystub(data.paystub);
    } catch (err) {
      logApiUnreachable(err);
      setError("Cannot reach the payroll server.");
      setPaystub(null);
    }
  }, [id]);

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
          <h1 className="text-xl font-semibold text-slate-900">Paystub</h1>
        </div>
        <Link href="/paystubs" className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700">Back</Link>
      </header>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      {paystub ? (
        <article className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">{paystub.stubNumber}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{paystub.payload.periodLabel}</h2>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <p>{paystub.payload.startDate} - {paystub.payload.endDate}</p>
              <p>Issued: {paystub.issuedAt.slice(0, 10)}</p>
              <p>Pay date: {paystub.payload.payDate ?? "-"}</p>
              <p>{paystub.payload.employeeName}{paystub.payload.site ? ` · ${paystub.payload.site}` : ""}</p>
              <p className="capitalize">Schedule: {paystub.payload.schedule}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">Earnings</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Gross" value={formatMoney(paystub.payload.earnings.gross)} />
              <Row label="Bonus" value={formatMoney(paystub.payload.earnings.bonus)} />
              <Row label="Allowance" value={formatMoney(paystub.payload.earnings.allowance)} />
              <Row label="Flat gross override" value={formatMoney(paystub.payload.earnings.flatGross)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">Deductions</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="NHI" value={formatMoney(paystub.payload.deductions.nhi)} />
              <Row label="SSB" value={formatMoney(paystub.payload.deductions.ssb)} />
              <Row label="Payroll tax" value={formatMoney(paystub.payload.deductions.payrollTax)} />
              <Row label="Advance" value={formatMoney(paystub.payload.deductions.advance)} />
              <Row label="Withdrawal" value={formatMoney(paystub.payload.deductions.withdrawal)} />
              <Row label="Loan" value={formatMoney(paystub.payload.deductions.loan)} />
              <Row label="Other" value={formatMoney(paystub.payload.deductions.other)} />
              <Row label="Total deductions" value={formatMoney(paystub.payload.deductions.total)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-semibold text-slate-900">Period totals</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Days worked" value={String(paystub.payload.totals.daysWorked)} />
              <Row label="Hours worked" value={String(paystub.payload.totals.hoursWorked)} />
              <Row label="OT hours" value={String(paystub.payload.totals.overtimeHours)} />
            </dl>
          </section>

          <section className="rounded-2xl bg-[#0f2f38] px-6 py-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Net pay</p>
            <p className="mt-2 text-3xl font-semibold">{formatMoney(paystub.payload.totals.net)}</p>
          </section>
        </article>
      ) : null}
    </div>
  );
}
