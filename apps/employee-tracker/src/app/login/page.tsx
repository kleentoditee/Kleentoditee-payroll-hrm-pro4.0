"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const isDev = process.env.NODE_ENV === "development";

type LoginRes = { token?: string; error?: string };

export default function TrackerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password })
      });
      const { data } = await readApiJson<LoginRes>(res);
      if (!res.ok) {
        setError(data?.error ?? `Sign-in failed (${res.status}).`);
        return;
      }
      if (data?.token) {
        setToken(data.token);
        router.push("/");
        router.refresh();
        return;
      }
      setError("No token in response.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error. Is the API on :8787 running?");
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
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Sign in to enter your work time, add draft lines for each month, and submit to payroll for approval.
            Supports monthly entry aligned with your pay schedule.
          </p>
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
        </form>
        {isDev ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/50 px-3 py-2 text-center text-xs text-slate-500">
            Local dev: after <code className="rounded bg-slate-100 px-1">db:seed</code>, a sample tracker account is
            <code className="mt-1 block text-[0.7rem] text-slate-700">maria.tracker@kleentoditee.local</code> with the
            same password as the seed admin.
          </p>
        ) : null}
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-brand underline-offset-2 hover:underline" href="/">
            ← What is the tracker?
          </Link>
        </p>
      </div>
    </div>
  );
}
