"use client";

import { apiBase } from "@/lib/api";
import { setToken } from "@/lib/auth-storage";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inviteToken, setInviteToken] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const applyQueryToken = useCallback(() => {
    const t = searchParams.get("token");
    if (t) {
      setInviteToken(t);
    }
  }, [searchParams]);

  useEffect(() => {
    applyQueryToken();
  }, [applyQueryToken]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/auth/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inviteToken.trim(),
          password,
          name: name.trim() || undefined
        })
      });
      const j = (await res.json()) as { error?: string; token?: string };
      if (!res.ok) {
        throw new Error(j.error ?? "Could not complete invitation");
      }
      if (j.token) {
        setToken(j.token);
        router.replace("/dashboard");
        return;
      }
      setError("Unexpected response from server");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-slate-100 px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="font-serif text-xl font-semibold text-slate-900">Accept invitation</h1>
        <p className="mt-1 text-sm text-slate-600">Set your password to activate your account.</p>
        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-700">Invitation token</span>
            <textarea
              required
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none ring-brand focus:ring-2"
              placeholder="Paste the token, or use the link with ?token="
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Display name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-700">Password (min. 8 characters)</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 outline-none ring-brand focus:ring-2"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-soft disabled:opacity-50"
          >
            {loading ? "Working…" : "Activate account"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href="/login" className="text-brand hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-screen max-w-md bg-slate-100 px-4 py-16 text-sm text-slate-600">Loading…</div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
