"use client";

import { apiBase, readApiJson } from "@/lib/api";
import Link from "next/link";
import { useState } from "react";

const SAFE_MESSAGE = "If an account exists for that email, password reset instructions have been sent.";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase()}/auth/password/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), app: "tracker" })
      });
      const { data } = await readApiJson<{ message?: string }>(res);
      setMessage(data?.message ?? SAFE_MESSAGE);
    } catch {
      setMessage("Cannot reach the payroll server. Try again when the app is online.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2f38] from-0% via-[#f6f8fa] via-25% to-[#eef2f5] to-100%">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KleenToDiTee</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Reset your password</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Enter the email for your staff tracker account.
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
          {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-2xl bg-brand py-3.5 text-base font-semibold text-white shadow-md shadow-brand/30 disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send reset instructions"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-brand underline-offset-2 hover:underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
