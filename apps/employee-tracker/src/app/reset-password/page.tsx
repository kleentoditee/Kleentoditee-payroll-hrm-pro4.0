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
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-lg shadow-slate-300/40"
    >
      {!token ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">Reset token is missing.</p> : null}
      <label className="block text-sm font-medium text-slate-800">
        New password
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={15}
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Confirm password
        <input
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={15}
          required
        />
      </label>
      <p className="text-xs leading-relaxed text-slate-500">
        Use at least 15 characters with one letter and one number.
      </p>
      {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {success ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{success}</p> : null}
      <button
        type="submit"
        disabled={busy || !token}
        className="rounded-2xl bg-brand py-3.5 text-base font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
      >
        {busy ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2f38] from-0% via-[#f6f8fa] via-25% to-[#eef2f5] to-100%">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KleenToDiTee</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
        </div>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-brand underline-offset-2 hover:underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
