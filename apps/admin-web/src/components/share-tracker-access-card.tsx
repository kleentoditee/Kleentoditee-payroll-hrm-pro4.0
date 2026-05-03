"use client";

import { authenticatedFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TrackerShareRes = {
  employeeId: string;
  loginUrl: string;
  appHomeUrl: string;
  linkedUser: { email: string; status: string } | null;
};

function buildShareMessage(loginUrl: string): string {
  return [
    "KleenToDiTee — time tracker",
    "",
    "Open this link to sign in and log your work time. Submit your entries for approval when ready.",
    "",
    loginUrl,
    "",
    "Use the user account your organization set up for you. Never share your password in email or chat."
  ].join("\n");
}

function mailtoHref(subject: string, body: string): string {
  const params = new URLSearchParams({ subject, body });
  return `mailto:?${params.toString()}`;
}

function whatsappHref(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

function publicFallbackBase(): string | null {
  const u = process.env.NEXT_PUBLIC_EMPLOYEE_TRACKER_URL?.replace(/\/$/, "");
  return u && u.length > 0 ? u : null;
}

export function ShareTrackerAccessCard({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [data, setData] = useState<TrackerShareRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const res = await authenticatedFetch(`/people/employees/${encodeURIComponent(employeeId)}/tracker-share`);
    if (res.ok) {
      setErr(null);
      setData((await res.json()) as TrackerShareRes);
    } else {
      const raw = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 404) {
        setErr("Employee not found.");
        setData(null);
      } else {
        setErr(raw.error ?? `Could not load tracker link (${res.status}).`);
        const fb = publicFallbackBase();
        if (fb) {
          setData({
            employeeId,
            loginUrl: `${fb}/login`,
            appHomeUrl: `${fb}/`,
            linkedUser: null
          });
        } else {
          setData(null);
        }
      }
    }
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loginUrl = data?.loginUrl ?? "";
  const message = buildShareMessage(loginUrl);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      setErr("Clipboard not available. Copy the URL from the field below.");
    }
  }

  return (
    <section
      className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/80 p-6 shadow-sm"
      aria-labelledby="tracker-share-heading"
    >
      <h2 id="tracker-share-heading" className="font-serif text-lg font-semibold text-slate-900">
        Share tracker access
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Send a link to the KleenToDiTee <strong>employee time tracker</strong> so {employeeName} can sign in and enter
        time remotely. The link only opens the app — it does <strong>not</strong> contain secrets or log them in
        automatically.
      </p>

      {loading ? <p className="mt-4 text-sm text-slate-500">Loading tracker address…</p> : null}
      {err && !data ? <p className="mt-4 text-sm text-amber-800">{err}</p> : null}
      {err && data ? (
        <p className="mt-2 text-sm text-amber-800">
          {err} Showing fallback from <code className="rounded bg-amber-50 px-1">NEXT_PUBLIC_EMPLOYEE_TRACKER_URL</code>{" "}
          if set.
        </p>
      ) : null}

      {data ? (
        <>
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="tracker-login-url">
              Sign-in URL
            </label>
            <input
              id="tracker-login-url"
              readOnly
              className="mt-1 w-full break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
              value={data.loginUrl}
            />
          </div>

          {data.linkedUser ? (
            <p className="mt-3 text-sm text-slate-700">
              <span className="font-semibold">Linked user account:</span>{" "}
              <span className="text-slate-900">{data.linkedUser.email}</span>{" "}
              <span className="text-slate-500">({data.linkedUser.status})</span>
              <br />
              <span className="text-xs text-slate-500">
                Share sign-in details through your normal secure channel. Do not put passwords in the messages below.
              </span>
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              No user account is linked to this employee yet. Use{" "}
              <Link className="font-semibold text-brand hover:underline" href="/dashboard/users/new">
                Invite user
              </Link>{" "}
              in the admin console, assign the <strong>employee tracker</strong> role, and link this employee.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onCopy()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              {copyOk ? "Copied" : "Copy link"}
            </button>
            <a
              href={mailtoHref("KleenToDiTee time tracker", message)}
              className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              Email link
            </a>
            <a
              href={whatsappHref(message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-emerald-600/30 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm hover:bg-emerald-100/80"
            >
              WhatsApp
            </a>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Email opens your mail app with a generic message. WhatsApp uses an official <code>api.whatsapp.com</code>{" "}
            link with the same text — no passwords, tax IDs, or one-time codes are included.
          </p>
        </>
      ) : null}
    </section>
  );
}
