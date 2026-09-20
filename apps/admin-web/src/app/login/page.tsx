"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

function InviteActivatedBanner({
  onInviteReturn
}: {
  onInviteReturn: (p: { email: string | null; invited: boolean }) => void;
}) {
  const sp = useSearchParams();

  useEffect(() => {
    const invited = sp.get("invited") === "1";
    const email = sp.get("email");
    onInviteReturn({ email, invited });
  }, [sp, onInviteReturn]);

  if (sp.get("invited") !== "1") {
    return null;
  }

  return (
    <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      <p className="font-semibold">Account activated</p>
      <p className="mt-1">Your invitation is complete. Sign in with the password you just created.</p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const isDev = process.env.NODE_ENV === "development";
  const [email, setEmail] = useState(isDev ? "admin@kleentoditee.local" : "");
  const [password, setPassword] = useState(isDev ? "ChangeMe!Dev123" : "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBase()}/auth/setup-status`)
      .then((res) => res.json())
      .then((data: { needsSetup?: boolean }) => {
        if (!cancelled) setNeedsSetup(Boolean(data.needsSetup));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const onInviteReturn = useCallback((p: { email: string | null; invited: boolean }) => {
    if (p.invited) {
      if (p.email) {
        setEmail(p.email);
      }
      setPassword("");
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const { data, rawText } = await readApiJson<{ token?: string; error?: string }>(res);

      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            (rawText ? `Server returned non-JSON (HTTP ${res.status})` : `HTTP ${res.status}`)
        );
        return;
      }

      if (!data?.token) {
        setError("No token returned" + (rawText && !data ? ` - ${rawText.slice(0, 80)}` : ""));
        return;
      }

      setToken(data.token);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-2 font-serif text-3xl text-slate-950">Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in to manage payroll, HR, time, and finance.</p>

        <Suspense fallback={null}>
          <InviteActivatedBanner onInviteReturn={onInviteReturn} />
        </Suspense>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="text"
              name="email"
              inputMode="email"
              autoComplete="username"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              required
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              required
            />
          </label>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-soft disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-5 space-y-2 text-center text-sm text-slate-600">
          {needsSetup ? (
            <p>
              <Link href="/setup" className="font-semibold text-brand hover:underline">
                Create the first owner account
              </Link>
            </p>
          ) : null}
          <p>
            <Link href="/forgot-password" className="font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </p>
          <p>
            <Link href="/accept-invite" className="font-medium text-brand hover:underline">
              Accept an invitation
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
