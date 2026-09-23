"use client";

import { FinanceRecordBreadcrumbs } from "@/components/finance/record-breadcrumb";
import { BoundedTable, RecordCard, RecordCardField, RecordCardFields, RecordCardList } from "@/components/finance/record-cards";
import { apiBase, readApiData } from "@/lib/api";
import { authHeaders } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AccountLite = {
  id: string;
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

type AvailablePayment = {
  id: string;
  number: string;
  paymentDate: string;
  method: string;
  amount: number;
  reference: string;
  customer: { id: string; displayName: string };
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function NewDepositPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [depositDate, setDepositDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [available, setAvailable] = useState<AvailablePayment[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adhoc, setAdhoc] = useState<Array<{ accountId: string; description: string; amount: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase()}/finance/accounts`, {
          headers: { ...authHeaders() }
        });
        const data = await readApiData<{ items: AccountLite[] }>(res);
        if (!cancelled) setAccounts(data.items ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load accounts");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bankAccountId) {
      setAvailable([]);
      setPicked(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${apiBase()}/finance/deposits/available-payments?bankAccountId=${encodeURIComponent(
            bankAccountId
          )}`,
          { headers: { ...authHeaders() } }
        );
        const data = await readApiData<{ items: AvailablePayment[] }>(res);
        if (!cancelled) {
          setAvailable(data.items ?? []);
          setPicked(new Set());
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load available payments");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bankAccountId]);

  const assetAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);

  const total = useMemo(
    () => round2(
      available.filter((p) => picked.has(p.id)).reduce((s, p) => s + p.amount, 0) +
        adhoc.filter((l) => l.accountId && Number(l.amount) > 0).reduce((s, l) => s + Number(l.amount), 0)
    ),
    [picked, available, adhoc]
  );

  function togglePick(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setPicked(new Set(available.map((p) => p.id)));
  }

  function selectNone() {
    setPicked(new Set());
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const adhocLines = adhoc.filter((l) => l.accountId && Number(l.amount) > 0);
    if (picked.size === 0 && adhocLines.length === 0) {
      setError("Select at least one payment or add an ad-hoc line.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const lines = [
        ...available
          .filter((p) => picked.has(p.id))
          .map((p, i) => ({
            position: i + 1,
            paymentId: p.id,
            amount: p.amount,
            description: `${p.number} · ${p.customer.displayName}`
          })),
        ...adhocLines.map((l, i) => ({
          position: picked.size + i + 1,
          accountId: l.accountId,
          amount: round2(Number(l.amount)),
          description: l.description || "Ad-hoc deposit line"
        }))
      ];
      const res = await fetch(`${apiBase()}/finance/deposits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ bankAccountId, depositDate, memo, lines })
      });
      const data = await readApiData<{ deposit: { id: string } }>(res);
      router.push(`/dashboard/finance/deposits/${data.deposit.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create deposit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <FinanceRecordBreadcrumbs recordLabel="New deposit" />
      <div>
        <h2 className="mt-1 font-serif text-2xl text-slate-900">New deposit</h2>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            <span className="text-slate-700">Bank account</span>
            <select
              required
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            >
              <option value="">Select an asset account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-700">Deposit date</span>
            <input
              type="date"
              required
              value={depositDate}
              onChange={(e) => setDepositDate(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="text-sm md:col-span-3">
            <span className="text-slate-700">Memo</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-700">Undeposited payments</h3>
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={selectAll}
                disabled={available.length === 0}
                className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline disabled:text-slate-400"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={selectNone}
                disabled={picked.size === 0}
                className="inline-flex min-h-11 items-center font-semibold text-slate-500 hover:underline disabled:text-slate-300"
              >
                Clear
              </button>
            </div>
          </div>
          {!bankAccountId ? (
            <p className="text-sm text-slate-600">Pick a bank account to see undeposited payments.</p>
          ) : available.length === 0 ? (
            <p className="text-sm text-slate-600">
              No undeposited payments for this account.
            </p>
          ) : (
            <>
            <RecordCardList>
              {available.map((payment) => (
                <RecordCard key={payment.id}>
                  <label className="flex min-h-11 cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={picked.has(payment.id)} onChange={() => togglePick(payment.id)} className="mt-1 h-5 w-5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-950">{payment.number}</span>
                      <span className="block break-words text-sm text-slate-600">{payment.customer.displayName}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-950">${payment.amount.toFixed(2)}</span>
                  </label>
                  <RecordCardFields>
                    <RecordCardField label="Date">{new Date(payment.paymentDate).toISOString().slice(0, 10)}</RecordCardField>
                    <RecordCardField label="Method">{payment.method}{payment.reference ? ` - ${payment.reference}` : ""}</RecordCardField>
                  </RecordCardFields>
                </RecordCard>
              ))}
            </RecordCardList>
            <BoundedTable>
            <table className="min-w-[760px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2"></th>
                  <th className="pb-2">Payment</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {available.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={picked.has(p.id)}
                        onChange={() => togglePick(p.id)}
                      />
                    </td>
                    <td className="py-2 font-medium text-slate-900">{p.number}</td>
                    <td className="py-2 text-slate-700">{p.customer.displayName}</td>
                    <td className="py-2 text-slate-600">
                      {new Date(p.paymentDate).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2 text-slate-600">
                      {p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </td>
                    <td className="py-2 text-right">${p.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </BoundedTable>
            </>
          )}
          <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <span className="text-slate-600">Deposit total</span>
            <span className="font-semibold text-slate-900">${total.toFixed(2)}</span>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Ad-hoc lines (no payment)</h3>
            <button
              type="button"
              onClick={() => setAdhoc([...adhoc, { accountId: "", description: "", amount: "" }])}
              className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-brand hover:bg-slate-50"
            >
              Add line
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Cash received without a customer payment. Each line needs the offset account it belongs to
            (e.g. Sales or Other income) — required before the deposit can post.
          </p>
          {adhoc.length > 0 ? (
            <>
            <RecordCardList>
              {adhoc.map((line, index) => (
                <RecordCard key={index}>
                  <p className="font-semibold text-slate-950">Deposit line {index + 1}</p>
                  <div className="mt-3 grid gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      Offset account
                      <select value={line.accountId} onChange={(event) => setAdhoc(adhoc.map((item, itemIndex) => itemIndex === index ? { ...item, accountId: event.target.value } : item))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                        <option value="">Choose account...</option>
                        {accounts.filter((account) => account.type === "revenue" || account.type === "asset" || account.type === "liability" || account.type === "equity").map((account) => <option key={account.id} value={account.id}>{account.code} - {account.name}</option>)}
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Description
                      <input value={line.description} onChange={(event) => setAdhoc(adhoc.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Amount
                      <input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setAdhoc(adhoc.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-right text-sm" />
                    </label>
                    <button type="button" onClick={() => setAdhoc(adhoc.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-rose-200 px-3 text-sm font-semibold text-rose-700">Remove line</button>
                  </div>
                </RecordCard>
              ))}
            </RecordCardList>
            <BoundedTable>
            <table className="mt-3 min-w-[760px] text-sm">
              <tbody className="divide-y divide-slate-100">
                {adhoc.map((l, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-2">
                      <select
                        value={l.accountId}
                        onChange={(e) => setAdhoc(adhoc.map((x, j) => (j === i ? { ...x, accountId: e.target.value } : x)))}
                        className="min-h-11 w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Offset account…</option>
                        {accounts
                          .filter((a) => a.type === "revenue" || a.type === "asset" || a.type === "liability" || a.type === "equity")
                          .map((a) => (
                            <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
                          ))}
                      </select>
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="text"
                        value={l.description}
                        placeholder="Description"
                        onChange={(e) => setAdhoc(adhoc.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                        className="min-h-11 w-48 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.amount}
                        placeholder="0.00"
                        onChange={(e) => setAdhoc(adhoc.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                        className="min-h-11 w-28 rounded-md border border-slate-300 px-2 py-1.5 text-right text-sm"
                      />
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => setAdhoc(adhoc.filter((_, j) => j !== i))} className="min-h-11 text-xs font-semibold text-rose-600 hover:underline">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </BoundedTable>
            </>
          ) : null}
        </section>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => router.push("/dashboard/finance/deposits")}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || (picked.size === 0 && !adhoc.some((l) => l.accountId && Number(l.amount) > 0))}
            className="min-h-11 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save draft deposit"}
          </button>
        </div>
      </form>
    </div>
  );
}
