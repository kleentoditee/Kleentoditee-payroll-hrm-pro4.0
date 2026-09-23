"use client";

import { apiBase, readApiJson } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function FirstOwnerSetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${apiBase()}/auth/setup-status`)
      .then(async (res) => {
        const { data } = await readApiJson<{ needsSetup?: boolean }>(res);
        return { ok: res.ok, data };
      })
      .then(({ ok, data }) => {
        if (!cancelled && ok && data?.needsSetup !== true) router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) setError("Cannot reach the payroll server.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), password })
      });
      const { data, rawText } = await readApiJson<{ token?: string; error?: string }>(res);
      if (!res.ok || !data?.token) {
        setError(data?.error ?? rawText ?? "Could not create the owner account.");
        return;
      }
      setToken(data.token);
      router.replace("/dashboard");
    } catch {
      setError("Cannot reach the payroll server.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">Checking setup...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-2 font-serif text-3xl text-slate-950">Create the owner account</h1>
        <p className="mt-2 text-sm text-slate-600">This one-time setup creates the first administrator for a new installation.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm text-slate-700">
            Full name
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          </label>
          <label className="block text-sm text-slate-700">
            Email
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required />
          </label>
          <label className="block text-sm text-slate-700">
            Password
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2" value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={15} autoComplete="new-password" required />
          </label>
          <label className="block text-sm text-slate-700">
            Confirm password
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" minLength={15} autoComplete="new-password" required />
          </label>
          <p className="text-xs text-slate-500">Use at least 15 characters with one letter and one number.</p>
          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">
            {busy ? "Creating account..." : "Create owner account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm"><Link href="/login" className="font-medium text-brand hover:underline">Back to sign in</Link></p>
      </div>
    </div>
  );
}
