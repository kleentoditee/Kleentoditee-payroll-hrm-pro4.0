"use client";

import { readApiJson } from "@/lib/api";
import { authenticatedFetch } from "@/lib/auth-client";
import {
  isActiveStatus,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  STATUS_BADGE_CLASS,
  STAFF_REQUEST_TYPES,
  type StaffRequest,
  type StaffRequestType
} from "@/lib/staff-requests";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ListRes = { items?: StaffRequest[]; error?: string };
type OneRes = { item?: StaffRequest; error?: string };

const TIME_OFF_TYPES: StaffRequestType[] = ["TIME_OFF", "SICK_LEAVE"];
const DETAILS_REQUIRED_TYPES: StaffRequestType[] = [
  "SUPPLIES_REQUEST",
  "EQUIPMENT_UNIFORM_REQUEST",
  "INCIDENT_REPORT",
  "DAMAGE_REPORT"
];

const PROFILE_FIELDS = [
  { key: "phone", label: "Phone" },
  { key: "personalEmail", label: "Personal email" },
  { key: "address", label: "Home address" },
  { key: "emergencyContactName", label: "Emergency contact name" },
  { key: "emergencyContactPhone", label: "Emergency contact phone" },
  { key: "emergencyContactRelationship", label: "Emergency contact relationship" },
  { key: "uniformSize", label: "Uniform size" }
] as const;

function formatDate(iso: string | null): string {
  if (!iso) {
    return "";
  }
  return iso.slice(0, 10);
}

export default function RequestsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<StaffRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [type, setType] = useState<StaffRequestType>("TIME_OFF");
  const [subject, setSubject] = useState("");
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [profileFields, setProfileFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const res = await authenticatedFetch("/staff/self/requests");
    if (res.status === 401 || res.status === 403) {
      router.replace("/login");
      return;
    }
    const { data, rawText } = await readApiJson<ListRes>(res);
    if (!res.ok) {
      setLoadError(data?.error ?? rawText ?? `Error ${res.status}`);
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
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

  const showStartEnd = useMemo(() => TIME_OFF_TYPES.includes(type), [type]);
  const showReason = useMemo(() => type === "JOB_LETTER", [type]);
  const showDetails = useMemo(
    () => type === "JOB_LETTER" || DETAILS_REQUIRED_TYPES.includes(type),
    [type]
  );
  const showProfile = useMemo(() => type === "PROFILE_UPDATE", [type]);

  function resetForm() {
    setSubject("");
    setReason("");
    setDetails("");
    setStartDate("");
    setEndDate("");
    setProfileFields({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { type };
      if (subject.trim()) {
        body.subject = subject.trim();
      }
      if (showReason && reason.trim()) {
        body.reason = reason.trim();
      }
      if (showDetails && details.trim()) {
        body.details = details.trim();
      }
      if (showStartEnd) {
        if (!startDate || !endDate) {
          setFormError("Please pick a start date and end date.");
          setSubmitting(false);
          return;
        }
        body.startDate = startDate;
        body.endDate = endDate;
      }
      if (showProfile) {
        const trimmed: Record<string, string> = {};
        for (const [k, v] of Object.entries(profileFields)) {
          const t = v.trim();
          if (t) {
            trimmed[k] = t;
          }
        }
        if (Object.keys(trimmed).length === 0) {
          setFormError("Fill at least one profile field to update.");
          setSubmitting(false);
          return;
        }
        body.requestedContactUpdate = trimmed;
      }

      const res = await authenticatedFetch("/staff/self/requests", {
        method: "POST",
        body: JSON.stringify(body)
      });
      const { data, rawText } = await readApiJson<OneRes>(res);
      if (!res.ok) {
        setFormError(data?.error ?? rawText ?? `Error ${res.status}`);
        return;
      }
      setSuccessMsg("Request submitted. We will let you know when it is reviewed.");
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRequest(id: string) {
    if (!window.confirm("Cancel this request?")) {
      return;
    }
    setLoadError(null);
    const res = await authenticatedFetch(`/staff/self/requests/${id}/cancel`, { method: "POST" });
    if (!res.ok) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setLoadError(data?.error ?? rawText ?? `Error ${res.status}`);
      return;
    }
    await load();
  }

  if (!ready) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-md flex-col px-4 py-6">
      <header className="mb-6 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Staff Hub</p>
          <h1 className="text-xl font-semibold text-slate-900">My requests</h1>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 active:bg-slate-100"
        >
          ← Time
        </Link>
      </header>

      <form onSubmit={submit} className="mb-8 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">New request</h2>
        <div className="grid gap-3">
          <label className="text-sm">
            <span className="text-slate-600">Type</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              value={type}
              onChange={(e) => {
                setType(e.target.value as StaffRequestType);
                setFormError(null);
              }}
            >
              {STAFF_REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {REQUEST_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-600">Subject (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short title"
              maxLength={200}
            />
          </label>
          {showStartEnd ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="text-slate-600">Start date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-600">End date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </label>
            </div>
          ) : null}
          {showReason ? (
            <label className="text-sm">
              <span className="text-slate-600">Purpose / addressed to</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bank, embassy, landlord, etc."
                maxLength={1000}
              />
            </label>
          ) : null}
          {showDetails ? (
            <label className="text-sm">
              <span className="text-slate-600">Details</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={
                  type === "JOB_LETTER"
                    ? "Anything specific that needs to be on the letter."
                    : "What happened, what is needed, sizes, quantity, location, etc."
                }
                maxLength={4000}
              />
            </label>
          ) : null}
          {showProfile ? (
            <div className="rounded-xl bg-slate-50/80 p-3">
              <p className="mb-2 text-xs text-slate-600">
                Update only what you want changed. We do not collect tax IDs through this form.
              </p>
              <div className="grid gap-2">
                {PROFILE_FIELDS.map((f) => (
                  <label key={f.key} className="text-sm">
                    <span className="text-slate-600">{f.label}</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                      value={profileFields[f.key] ?? ""}
                      onChange={(e) =>
                        setProfileFields((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                      maxLength={200}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        {formError ? <p className="mt-2 text-sm text-red-600">{formError}</p> : null}
        {successMsg ? <p className="mt-2 text-sm text-emerald-700">{successMsg}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-2xl bg-brand py-3 text-base font-semibold text-white active:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>

      <h2 className="mb-2 text-sm font-semibold text-slate-800">Recent requests</h2>
      {loadError ? <p className="mb-2 text-sm text-red-600">{loadError}</p> : null}
      <ul className="flex flex-col gap-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 bg-white/50 px-3 py-6 text-center text-sm text-slate-500">
            You have no requests yet.
          </li>
        ) : (
          items.map((r) => (
            <li key={r.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{REQUEST_TYPE_LABELS[r.type]}</p>
                  {r.subject ? <p className="text-sm text-slate-700">{r.subject}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted {formatDate(r.createdAt)}
                    {r.startDate ? ` · ${formatDate(r.startDate)} → ${formatDate(r.endDate)}` : ""}
                  </p>
                  {r.reviewNote ? (
                    <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-700">
                      <span className="font-semibold">Reviewer note:</span> {r.reviewNote}
                    </p>
                  ) : null}
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}
                >
                  {REQUEST_STATUS_LABELS[r.status]}
                </span>
              </div>
              {isActiveStatus(r.status) ? (
                <div className="mt-3 flex">
                  <button
                    type="button"
                    onClick={() => void cancelRequest(r.id)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  >
                    Cancel request
                  </button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
