"use client";

import { apiBase, apiDiagnosticLabel, logApiUnreachable, readApiJson } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const isDev = process.env.NODE_ENV === "development";
const TRACKER_ROLE = "employee_tracker_user";

const PUBLIC_SIGNIN_ERROR =
  "Email or password is invalid, or your tracker access is not active.";

type LoginRes = {
  token?: string;
  error?: string;
  code?: string;
  user?: { roles?: string[]; employeeId?: string | null };
};

export default function TrackerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState(isDev ? "maria.tracker@kleentoditee.local" : "");
  const [password, setPassword] = useState(isDev ? "ChangeMe!Dev123" : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const base = apiBase();
      if (isDev) {
        console.info("[employee-tracker] Login API:", apiDiagnosticLabel());
      }
      const res = await fetch(`${base}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const { data } = await readApiJson<LoginRes>(res);
      if (!res.ok) {
        if (isDev && data) {
          console.info("[employee-tracker] Login rejected:", { code: data.code, error: data.error });
        }
        if (data?.code === "invitation_pending") {
          setError(
            data.error ??
              "Complete your invitation before signing in. If you were invited but never created a password, ask your manager to resend your invite link."
          );
          return;
        }
        if (data?.code === "account_inactive") {
          setError(PUBLIC_SIGNIN_ERROR);
          return;
        }
        setError(PUBLIC_SIGNIN_ERROR);
        return;
      }
      const token = data?.token;
      const user = data?.user;
      if (!token) {
        setError(PUBLIC_SIGNIN_ERROR);
        return;
      }

      const roles = user?.roles ?? [];
      const employeeId = user?.employeeId ?? null;
      if (!roles.includes(TRACKER_ROLE) || !employeeId) {
        if (isDev) {
          console.info("[employee-tracker] Login OK but tracker gate failed:", {
            hasTrackerRole: roles.includes(TRACKER_ROLE),
            employeeLinked: Boolean(employeeId)
          });
        }
        setError(
          "Your login works, but tracker access is not enabled. Ask your manager to link your user account to your employee profile."
        );
        return;
      }

      const profRes = await fetch(`${base}/time/self/profile`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const profParsed = await readApiJson<{ employee?: { active?: boolean } }>(profRes);
      if (!profRes.ok) {
        if (isDev) {
          console.info("[employee-tracker] Profile check after login:", profRes.status, profParsed.rawText);
        }
        setError(
          "Your login works, but tracker access is not enabled. Ask your manager to link your user account to your employee profile."
        );
        return;
      }
      if (profParsed.data?.employee?.active === false) {
        setError(PUBLIC_SIGNIN_ERROR);
        return;
      }

      setToken(token);
      router.push("/");
      router.refresh();
    } catch (err) {
      logApiUnreachable(err);
      setError(
        "Cannot reach the payroll server. On local dev, start the API on port 8787 and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2f38] from-0% via-[#f6f8fa] via-25% to-[#eef2f5] to-100%">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <div className="mb-2 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-black/20">
            KT
          </div>
        </div>
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KleenToDiTee</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Time tracker</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to your employee account.</p>
        </div>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-300/40"
        >
          <label className="block text-sm font-medium text-slate-800">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Password
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-brand py-3.5 text-base font-semibold text-white shadow-md shadow-brand/30 active:opacity-90 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <Link className="text-center text-sm font-medium text-brand underline-offset-2 hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </form>
      </div>
    </div>
  );
}
