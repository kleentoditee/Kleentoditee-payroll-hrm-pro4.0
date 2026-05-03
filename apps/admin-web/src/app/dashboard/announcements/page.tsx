"use client";

import { authenticatedFetch, readApiJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const CATS = [
  "GENERAL",
  "SAFETY",
  "HOLIDAY",
  "POLICY",
  "WEATHER",
  "PAYROLL",
  "SCHEDULE"
] as const;
const AUDS = ["ALL", "EMPLOYEES", "MANAGERS"] as const;

type Item = {
  id: string;
  title: string;
  body: string;
  category: string;
  audience: string;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  createdAt: string;
};

function isoDate(d: string | null): string {
  if (!d) {
    return "";
  }
  return d.slice(0, 10);
}

export default function StaffAnnouncementsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "GENERAL" as (typeof CATS)[number],
    audience: "EMPLOYEES" as (typeof AUDS)[number]
  });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [toggleBusy, setToggleBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    const res = await authenticatedFetch("/admin/announcements");
    const { data, rawText } = await readApiJson<{ items?: Item[]; error?: string }>(res);
    if (!res.ok) {
      setErr(data?.error ?? rawText ?? `Error ${res.status}`);
      setItems([]);
      return;
    }
    setItems(data?.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    if (!form.title.trim() || !form.body.trim()) {
      setFormErr("Title and body are required.");
      return;
    }
    setSaving(true);
    const res = await authenticatedFetch("/admin/announcements", {
      method: "POST",
      body: JSON.stringify({
        title: form.title.trim(),
        body: form.body.trim(),
        category: form.category,
        audience: form.audience
      })
    });
    const { data, rawText } = await readApiJson<{ error?: string }>(res);
    setSaving(false);
    if (!res.ok) {
      setFormErr((data as { error?: string })?.error ?? rawText);
      return;
    }
    setForm((f) => ({ ...f, title: "", body: "" }));
    await load();
  }

  async function setActive(id: string, active: boolean) {
    setToggleBusy(id);
    const res = await authenticatedFetch(`/admin/announcements/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ active })
    });
    setToggleBusy(null);
    if (!res.ok) {
      const { data, rawText } = await readApiJson<{ error?: string }>(res);
      setErr((data as { error?: string })?.error ?? rawText);
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <div className="mb-6 text-sm text-slate-500">
        <a href="/dashboard" className="text-teal-700 hover:underline">
          Dashboard
        </a>
        <span className="mx-2">/</span>
        <span className="text-slate-800">Staff announcements</span>
      </div>
      <h1 className="text-2xl font-semibold text-slate-900">Announcements</h1>
      <p className="mt-1 text-sm text-slate-600">Visible in the employee tracker (in-app; no auto email).</p>
      {err ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{err}</p>
      ) : null}

      <form
        onSubmit={onCreate}
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">New announcement</h2>
        {formErr ? <p className="mt-2 text-sm text-red-600">{formErr}</p> : null}
        <div className="mt-3 grid gap-3">
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Message (plain text)"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <div className="flex flex-wrap gap-3 text-sm">
            <label>
              Category
              <select
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as (typeof CATS)[number] }))
                }
              >
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Audience
              <select
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
                value={form.audience}
                onChange={(e) =>
                  setForm((f) => ({ ...f, audience: e.target.value as (typeof AUDS)[number] }))
                }
              >
                {AUDS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Publishing…" : "Publish"}
        </button>
      </form>

      <h2 className="mt-10 text-lg font-semibold text-slate-900">All</h2>
      {items === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">No announcements yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {a.category} · {a.audience} · {a.active ? "active" : "inactive"}
                    {a.startsAt ? ` · starts ${isoDate(a.startsAt)}` : ""}
                    {a.endsAt ? ` · ends ${isoDate(a.endsAt)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={toggleBusy === a.id}
                  onClick={() => void setActive(a.id, !a.active)}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  {toggleBusy === a.id ? "…" : a.active ? "Deactivate" : "Activate"}
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{a.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
