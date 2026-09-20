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
        body: JSON.stringify({ email: email.trim().toLowerCase(), app: "admin" })
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-2 font-serif text-2xl text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter the email for your admin or staff account.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 outline-none ring-brand focus:ring-2"
              type="text"
              inputMode="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-950">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-soft disabled:opacity-60"
          >
            {busy ? "Sending..." : "Send reset instructions"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm">
          <Link className="font-medium text-brand hover:underline" href="/login">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
