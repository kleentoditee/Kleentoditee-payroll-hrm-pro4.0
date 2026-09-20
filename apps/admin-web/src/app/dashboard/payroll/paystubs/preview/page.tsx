"use client";

import { PaystubDocument, type PaystubPayload } from "@/components/paystub-document";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Period = {
  id: string;
  label: string;
  schedule: string;
  startDate: string;
  endDate: string;
  payDate: string | null;
};

type PreviewItem = {
  employeeId: string;
  employeeName: string;
  payload: PaystubPayload;
};

type PreviewResponse = {
  period: Period;
  items: PreviewItem[];
};

export default function PaystubPreviewPage() {
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [periodId, setPeriodId] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBase()}/payroll/periods`, { headers: { ...authHeaders() } })
      .then((response) => readApiData<{ items: Period[] }>(response, "Could not load pay periods."))
      .then((data) => {
        if (cancelled) return;
        setPeriods(data.items);
        setPeriodId((current) => current || data.items[0]?.id || "");
        setError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setPeriods([]);
        setError(reason instanceof Error ? reason.message : "Could not load pay periods.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!periodId) {
      setPreview(null);
      setEmployeeId("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetch(`${apiBase()}/payroll/paystubs/preview?periodId=${encodeURIComponent(periodId)}`, {
      headers: { ...authHeaders() }
    })
      .then((response) => readApiData<PreviewResponse>(response, "Could not build the paystub preview."))
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setEmployeeId((current) =>
          data.items.some((item) => item.employeeId === current) ? current : data.items[0]?.employeeId || ""
        );
        setError(null);
      })
      .catch((reason) => {
        if (cancelled) return;
        setPreview(null);
        setEmployeeId("");
        setError(reason instanceof Error ? reason.message : "Could not build the paystub preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const selected = useMemo(
    () => preview?.items.find((item) => item.employeeId === employeeId) ?? null,
    [employeeId, preview]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Payroll</p>
          <h2 className="mt-1 font-serif text-2xl text-slate-900">Staff paystub preview</h2>
        </div>
        <Link href="/dashboard/payroll/runs" className="text-sm font-semibold text-brand hover:underline">
          {"<-"} Back to pay runs
        </Link>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 print:hidden">
        <label className="text-sm">
          <span className="font-medium text-slate-700">Pay period</span>
          <select
            value={periodId}
            onChange={(event) => setPeriodId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            disabled={!periods?.length}
          >
            {(periods ?? []).map((period) => (
              <option key={period.id} value={period.id}>
                {period.label} ({period.schedule})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium text-slate-700">Employee</span>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            disabled={!preview?.items.length}
          >
            {(preview?.items ?? []).map((item) => (
              <option key={item.employeeId} value={item.employeeId}>{item.employeeName}</option>
            ))}
          </select>
        </label>
      </div>

      {periods && periods.length === 0 ? (
        <p className="text-sm text-slate-600">
          Create a pay period before previewing paystubs. <Link href="/dashboard/payroll/periods" className="font-semibold text-brand hover:underline">Open pay periods</Link>
        </p>
      ) : loading ? (
        <p className="text-sm text-slate-600">Calculating preview...</p>
      ) : preview && preview.items.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No staff paystub is available for this period. Approve matching time entries, or confirm that fixed-pay employees use this pay schedule.
        </p>
      ) : selected ? (
        <PaystubDocument
          payload={selected.payload}
          stubNumber="PREVIEW"
          issuedDate="Not issued"
          preview
        />
      ) : null}
    </div>
  );
}
