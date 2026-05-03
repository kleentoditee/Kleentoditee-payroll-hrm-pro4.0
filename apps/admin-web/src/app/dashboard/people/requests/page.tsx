"use client";

import { authenticatedFetch, readApiJson } from "@/lib/api";
import {
  allowedNextStatuses,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  STATUS_BADGE_CLASS,
  STAFF_REQUEST_STATUSES,
  STAFF_REQUEST_TYPES,
  type StaffRequest,
  type StaffRequestStatus,
  type StaffRequestType
} from "@/lib/staff-requests";
import { useCallback, useEffect, useMemo, useState } from "react";

type ListRes = { items?: StaffRequest[]; error?: string };
type OneRes = { item?: StaffRequest; error?: string };

const STATUS_FILTER_OPTIONS: { value: "" | StaffRequestStatus; label: string }[] = [
  { value: "", label: "All statuses" },
  ...STAFF_REQUEST_STATUSES.map((s) => ({ value: s, label: REQUEST_STATUS_LABELS[s] }))
];

const TYPE_FILTER_OPTIONS: { value: "" | StaffRequestType; label: string }[] = [
  { value: "", label: "All types" },
  ...STAFF_REQUEST_TYPES.map((t) => ({ value: t, label: REQUEST_TYPE_LABELS[t] }))
];

function formatDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  return new Date(iso).toLocaleDateString();
}

export default function StaffRequestsPage() {
  const [items, setItems] = useState<StaffRequest[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | StaffRequestStatus>("");
  const [typeFilter, setTypeFilter] = useState<"" | StaffRequestType>("");
  const [selected, setSelected] = useState<StaffRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<StaffRequestStatus | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const params = new URLSearchParams();
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    if (typeFilter) {
      params.set("type", typeFilter);
    }
    const qs = params.toString();
    const res = await authenticatedFetch(`/admin/staff-requests${qs ? `?${qs}` : ""}`);
    const { data, rawText } = await readApiJson<ListRes>(res);
    if (!res.ok) {
      setLoadError(data?.error ?? rawText ?? `Error ${res.status}`);
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setReviewNote(selected?.reviewNote ?? "");
    setActionError(null);
  }, [selected?.id, selected?.reviewNote]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    if (!items) {
      return out;
    }
    for (const it of items) {
      out[it.status] = (out[it.status] ?? 0) + 1;
    }
    return out;
  }, [items]);

  async function applyStatus(target: StaffRequestStatus) {
    if (!selected) {
      return;
    }
    setActionError(null);
    setActionBusy(target);
    try {
      const res = await authenticatedFetch(`/admin/staff-requests/${selected.id}/status`, {
        method: "PATCH",
      body: JSON.stringify({ status: target, reviewNote: reviewNote.trim() || undefined })
      });
      const { data, rawText } = await readApiJson<OneRes>(res);
      if (!res.ok) {
        setActionError(data?.error ?? rawText ?? `Error ${res.status}`);
        return;
      }
      if (data?.item) {
        setSelected(data.item);
      }
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Network error");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Staff requests</h1>
        <p className="mt-1 text-sm text-slate-600">
          Review and act on time off, supplies, equipment, incidents, profile updates and other employee requests
          submitted from the Staff Hub.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-sm">
          <span className="text-slate-600">Status</span>
          <select
            className="mt-1 block w-44 rounded-lg border border-slate-200 bg-white px-3 py-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | StaffRequestStatus)}
          >
            {STATUS_FILTER_OPTIONS.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-slate-600">Type</span>
          <select
            className="mt-1 block w-52 rounded-lg border border-slate-200 bg-white px-3 py-2"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "" | StaffRequestType)}
          >
            {TYPE_FILTER_OPTIONS.map((s) => (
              <option key={s.value || "all"} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap gap-2 text-xs text-slate-600">
          {STAFF_REQUEST_STATUSES.map((s) => (
            <span
              key={s}
              className={`rounded-full px-2 py-0.5 ${STATUS_BADGE_CLASS[s]}`}
              title={`${counts[s] ?? 0} ${REQUEST_STATUS_LABELS[s]}`}
            >
              {REQUEST_STATUS_LABELS[s]}: {counts[s] ?? 0}
            </span>
          ))}
        </div>
      </div>

      {loadError ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Queue
          </div>
          <ul className="divide-y divide-slate-100">
            {items === null ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-slate-500">No requests match the filters.</li>
            ) : (
              items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r)}
                    className={`block w-full px-4 py-3 text-left transition-colors ${
                      selected?.id === r.id ? "bg-brand/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {r.employee?.fullName ?? "(deleted employee)"}
                        </p>
                        <p className="truncate text-xs text-slate-600">
                          {REQUEST_TYPE_LABELS[r.type]}
                          {r.subject ? ` · ${r.subject}` : ""}
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-slate-500">{formatDate(r.createdAt)}</p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}
                      >
                        {REQUEST_STATUS_LABELS[r.status]}
                      </span>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-sm text-slate-500">
              Select a request to review.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">
                    {REQUEST_TYPE_LABELS[selected.type]}
                  </p>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selected.employee?.fullName ?? "(deleted employee)"}
                  </h2>
                  {selected.subject ? <p className="text-sm text-slate-700">{selected.subject}</p> : null}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[selected.status]}`}
                >
                  {REQUEST_STATUS_LABELS[selected.status]}
                </span>
              </div>

              <dl className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Submitted</dt>
                  <dd className="text-slate-800">{formatDate(selected.createdAt)}</dd>
                </div>
                {selected.startDate || selected.endDate ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Date range</dt>
                    <dd className="text-slate-800">
                      {formatDate(selected.startDate)} → {formatDate(selected.endDate)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Site</dt>
                  <dd className="text-slate-800">{selected.employee?.defaultSite || "—"}</dd>
                </div>
                {selected.reviewedAt ? (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Reviewed</dt>
                    <dd className="text-slate-800">
                      {formatDate(selected.reviewedAt)}
                      {selected.reviewedBy?.name ? ` by ${selected.reviewedBy.name}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selected.reason ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purpose</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.reason}</p>
                </div>
              ) : null}
              {selected.details ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Details</p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-800">{selected.details}</p>
                </div>
              ) : null}
              {selected.requestedContactUpdate ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Requested profile changes
                  </p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(selected.requestedContactUpdate).map(([k, v]) => (
                      <li key={k} className="flex justify-between gap-2">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-800">{v}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <label className="text-sm">
                  <span className="text-slate-600">Reviewer note</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Optional message saved with the next status change."
                    maxLength={2000}
                  />
                </label>
                {actionError ? <p className="mt-2 text-sm text-rose-600">{actionError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {allowedNextStatuses(selected.status).length === 0 ? (
                    <p className="text-sm text-slate-500">
                      This request is in a final state ({REQUEST_STATUS_LABELS[selected.status]}). No more actions.
                    </p>
                  ) : (
                    allowedNextStatuses(selected.status).map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => void applyStatus(target)}
                        disabled={actionBusy !== null}
                        className={`rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                          target === "DENIED" || target === "CANCELLED"
                            ? "bg-rose-600 hover:bg-rose-700"
                            : target === "APPROVED" || target === "COMPLETED"
                              ? "bg-emerald-600 hover:bg-emerald-700"
                              : "bg-brand hover:bg-brand-soft"
                        }`}
                      >
                        {actionBusy === target ? "…" : REQUEST_STATUS_LABELS[target]}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
