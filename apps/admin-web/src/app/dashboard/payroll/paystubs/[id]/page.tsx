"use client";

import { apiBase } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { PaystubDocument, type PaystubPayload } from "@/components/paystub-document";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type PaystubDetail = {
  id: string;
  stubNumber: string;
  createdAt: string;
  issuedAt: string;
  payload: PaystubPayload;
};

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

      <PaystubDocument
        payload={paystub.payload}
        stubNumber={paystub.stubNumber}
        issuedDate={paystub.issuedAt.slice(0, 10)}
      />
    </div>
  );
}
