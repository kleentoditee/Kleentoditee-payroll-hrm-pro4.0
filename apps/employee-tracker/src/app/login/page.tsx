"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginRes = { token?: string; error?: string };

export default function TrackerLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("maria.tracker@kleentoditee.local");
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Employee sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use the account your administrator set up for the tracker.</p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
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
          className="rounded-2xl bg-brand py-3.5 text-base font-semibold text-white shadow-lg shadow-brand/25 active:opacity-90 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-slate-500">
        After <code className="rounded bg-slate-100 px-1">db:seed</code>, the sample tracker account is
        <br />
        <code className="text-[11px]">maria.tracker@kleentoditee.local</code> with the same password as admin.
      </p>
      <p className="mt-2 text-center text-sm">
        <Link className="text-brand underline-offset-2 hover:underline" href="/">
          Back to home
        </Link>
      </p>
    </div>
  );
}
