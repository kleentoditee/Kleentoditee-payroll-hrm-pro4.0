"use client";

import { apiBase, readApiJson } from "@/lib/api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/auth/password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const { data, rawText } = await readApiJson<{ message?: string; error?: string }>(res);
      if (!res.ok) {
        setError(data?.error ?? rawText ?? "Reset link is invalid or expired.");
        return;
      }
      setSuccess(data?.message ?? "Password reset. You can sign in with your new password.");
      setPassword("");
      setConfirm("");
    } catch {
      setError("Cannot reach the payroll server. Try again when the app is online.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {!token ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Reset token is missing.</p> : null}
      <label className="block text-sm">
        <span className="text-slate-700">New password</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={15}
          required
        />
      </label>
      <label className="block text-sm">
        <span className="text-slate-700">Confirm password</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={15}
          required
        />
      </label>
      <p className="text-xs text-slate-500">Use at least 15 characters with one letter and one number.</p>
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{success}</p> : null}
      <button
        type="submit"
        disabled={busy || !token}
        className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-soft disabled:opacity-60"
      >
        {busy ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-2 font-serif text-2xl text-slate-900">Choose a new password</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-brand hover:underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
