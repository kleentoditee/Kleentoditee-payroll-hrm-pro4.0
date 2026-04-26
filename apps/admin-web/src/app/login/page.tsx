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
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
      <p className="font-semibold">Account activated</p>
      <p className="mt-1">
        Your invitation is complete. Sign in with your email and the password you set on the accept-invite page.
      </p>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kleentoditee.local");
  const [password, setPassword] = useState("ChangeMe!Dev123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  const [apiCheck, setApiCheck] = useState<"idle" | "ok" | "fail">("idle");
  const [dbStatus, setDbStatus] = useState<
    | "idle"
    | "loading"
    | {
        userCount: number | null;
        firstUserEmail: string | null;
        databaseUrl: string | null;
        jwtSecretSet: boolean;
        dbError: string | null;
      }
    | "missing"
  >("idle");

  const onInviteReturn = useCallback((p: { email: string | null; invited: boolean }) => {
    if (p.invited) {
      if (p.email) {
        setEmail(p.email);
      }
      setPassword("");
    }
  }, []);

  async function checkApi() {
    setApiCheck("idle");
    try {
      const res = await fetch(`${apiBase()}/health`);
      setApiCheck(res.ok ? "ok" : "fail");
    } catch {
      setApiCheck("fail");
    }
  }

  async function checkDb() {
    setDbStatus("loading");
    try {
      const res = await fetch(`${apiBase()}/dev/db-status`);
      if (res.status === 404) {
        setDbStatus("missing");
        return;
      }
      if (!res.ok) {
        setDbStatus("missing");
        return;
      }
      const data = (await res.json()) as {
        userCount: number | null;
        firstUserEmail: string | null;
        databaseUrl: string | null;
        jwtSecretSet: boolean;
        dbError: string | null;
      };
      setDbStatus(data);
    } catch {
      setDbStatus("missing");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const emailNorm = email.trim().toLowerCase();
    try {
      const res = await fetch(`${apiBase()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailNorm, password })
      });
      const { data, rawText } = await readApiJson<{ token?: string; error?: string }>(res);
      if (!res.ok) {
        const msg =
          (data && typeof data.error === "string" && data.error) ||
          (rawText ? `Server returned non-JSON (HTTP ${res.status})` : `HTTP ${res.status}`);
        setError(
          msg +
            (res.status === 401 || (data && String(data.error).toLowerCase().includes("invalid"))
              ? " — Use “Check database (users)” below. If userCount is 0, stop the API, run seed, restart. If userCount is 1+ but this still fails, the password is wrong or email does not match .env (SEED_ADMIN_*)."
              : " — If the API is down, open http://127.0.0.1:8787/health in a new tab. If that works but this page does not, restart `start-platform` so Next can proxy to :8787.")
        );
        return;
      }
      if (!data?.token) {
        setError("No token returned" + (rawText && !data ? " — " + rawText.slice(0, 80) : ""));
        return;
      }
      setToken(data.token);
      router.replace("/dashboard");
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Network error") +
          " — start the stack from the repo root: `start-platform.bat`. Direct API check: http://127.0.0.1:8787/health" +
          " (must show JSON with ok:true). In dev, same-origin test: " +
          (typeof window !== "undefined" ? window.location.origin : "") +
          "/__kleentoditee_api/health"
      );
    } finally {
      setLoading(false);
    }
  }

  async function devEmergency() {
    setError(null);
    setEmergencyLoading(true);
    try {
      const res = await fetch(`${apiBase()}/auth/dev-emergency`, { method: "POST" });
      const { data, rawText } = await readApiJson<{ token?: string; error?: string }>(res);
      if (!res.ok) {
        setError(
          (data && typeof data.error === "string" && data.error) ||
            `Dev emergency failed (HTTP ${res.status}). Set ALLOW_DEV_EMERGENCY_LOGIN=1 in repo root .env, restart the API, and ensure a user exists (db:seed). ${rawText ? rawText : ""}`
        );
        return;
      }
      if (data?.token) {
        setToken(data.token);
        router.replace("/dashboard");
        return;
      }
      setError("No token returned" + (rawText ? " — " + rawText : ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Emergency login failed (network). Is the API running on :8787?");
    } finally {
      setEmergencyLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">KleenToDiTee</p>
        <h1 className="mt-2 font-serif text-2xl text-slate-900">Admin sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Before sign-in, you only see this screen. <strong>After a successful sign-in</strong> the app goes to{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">/dashboard</code> (URL and page change) with People, Time,
          Audit, and the rest. If you stay here, check the red error under the form or that you ran{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">db:seed</code>.
        </p>

        <Suspense fallback={null}>
          <InviteActivatedBanner onInviteReturn={onInviteReturn} />
        </Suspense>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Default dev login (after running seed once)</p>
          <p className="mt-1 font-mono text-xs">
            admin@kleentoditee.local
            <br />
            ChangeMe!Dev123
          </p>
          <p className="mt-2 text-xs text-amber-900">
            <strong>Tip:</strong> the text above is not a live “error” from the app — it is the usual email/password. If
            sign-in is rejected, use <strong>Check database (users)</strong> below. First-time with no user? In folder{" "}
            <strong>kleentoditee-payroll-pro</strong> run <code className="rounded bg-white/80 px-1">npm run db:seed</code> or{" "}
            <code className="rounded bg-white/80 px-1">seed-database.bat</code> while the dev servers are <strong>stopped</strong>{" "}
            (avoids SQLite lock).
          </p>
        </div>

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
          <p className="text-xs text-slate-500">
            Using <code className="rounded bg-slate-100 px-1">.local</code> addresses: keep this as <strong>text</strong> (not
            &quot;email&quot;) so the browser does not block <code className="rounded bg-slate-100 px-1">admin@kleentoditee.local</code>.
          </p>
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
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-white hover:bg-brand-soft disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-3 text-center text-sm text-slate-600">
          <Link href="/accept-invite" className="font-medium text-brand hover:underline">
            Accept an invitation (set password)
          </Link>
        </p>

        {process.env.NODE_ENV === "development" ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/90 p-3 text-xs text-rose-950">
            <p className="font-semibold">Emergency: sign in without password (local dev only)</p>
            <p className="mt-1.5">
              Easiest: double-click <code className="rounded bg-white/80 px-1">enable-emergency-login.bat</code> in the
              repo root (same folder as <code className="rounded bg-white/80 px-1">start-platform.bat</code>). Or in
              root <code className="rounded bg-white/80 px-1">.env</code> add:{" "}
              <code className="block mt-1 rounded bg-white/80 px-1 py-0.5">ALLOW_DEV_EMERGENCY_LOGIN=1</code>
            </p>
            <p className="mt-1">Save, restart <code className="rounded bg-white/80 px-1">start-platform.bat</code>. In the API log you should see:{" "}
              <code className="block mt-0.5 rounded bg-white/80 px-1 text-[10px]">[api] Emergency passwordless login is ON</code>
            </p>
            <button
              type="button"
              onClick={devEmergency}
              disabled={emergencyLoading}
              className="mt-2 w-full rounded-lg border border-rose-300 bg-white py-2 text-sm font-medium text-rose-900 hover:bg-rose-100 disabled:opacity-50"
            >
              {emergencyLoading ? "Working…" : "Sign in (emergency, first user in DB)"}
            </button>
            <p className="mt-2 text-rose-800/80">Remove that line from .env before any real deployment. Needs at least one user (run seed). If the red error said “Not found,” your API did not pick up the flag — use exactly ALLOW_DEV_EMERGENCY_LOGIN=1 in the same folder as start-platform.</p>
          </div>
        ) : null}

        <div className="mt-6 space-y-2 border-t border-slate-100 pt-6 text-xs text-slate-600">
          <p>
            API should be at <code className="rounded bg-slate-100 px-1">{apiBase()}</code> (port{" "}
            <strong>8787</strong>). Admin is port <strong>3000</strong> — both start with{" "}
            <strong>start-platform.bat</strong> or <code className="rounded bg-slate-100 px-1">npm run boot</code>.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={checkApi}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
            >
              Test API connection
            </button>
            <a
              href={`${apiBase()}/health`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-brand hover:bg-slate-50"
            >
              Open /health in new tab
            </a>
            <button
              type="button"
              onClick={checkDb}
              disabled={dbStatus === "loading"}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              {dbStatus === "loading" ? "Checking…" : "Check database (users)"}
            </button>
          </div>
          {apiCheck === "ok" ? <p className="text-emerald-700">API responded OK.</p> : null}
          {apiCheck === "fail" ? (
            <p className="text-red-700">API not reachable. Start the platform from kleentoditee-payroll-pro first.</p>
          ) : null}
          {dbStatus === "missing" ? (
            <p className="text-amber-800">Could not read /dev/db-status (update API, or open the JSON in a new tab: /dev/db-status)</p>
          ) : null}
          {dbStatus !== "idle" && dbStatus !== "loading" && dbStatus !== "missing" && "dbError" in dbStatus && dbStatus.dbError ? (
            <p className="text-red-700">Database error: {dbStatus.dbError}</p>
          ) : null}
          {dbStatus !== "idle" && dbStatus !== "loading" && dbStatus !== "missing" && "userCount" in dbStatus ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-800">
              <p>
                <strong>
                  Users in this API’s database:{" "}
                  {dbStatus.userCount === null ? "— (could not count)" : dbStatus.userCount}
                </strong>
              </p>
              {dbStatus.userCount === 0 ? (
                <p className="mt-1 text-amber-900">
                  None yet — the API is not seeing a seeded user. Stop start-platform, run seed, start again. Make sure you
                  only have one <code className="rounded bg-white px-1">.env</code> in the repo root and one copy of the project.
                </p>
              ) : dbStatus.userCount !== null && dbStatus.userCount > 0 ? (
                <p className="mt-1">
                  Seeded users are present. Use this exact <strong>email</strong> in the form:{" "}
                  <code className="break-all rounded bg-white px-1 text-slate-900">
                    {dbStatus.firstUserEmail ?? "unknown — re-run check"}
                  </code>{" "}
                  (must match <code className="rounded bg-white px-1">SEED_ADMIN_*</code> in <code className="rounded bg-white px-1">.env</code>).
                </p>
              ) : null}
              <p className="mt-1 break-all text-slate-500">
                DATABASE_URL in use: {dbStatus.databaseUrl ?? "unset — check repo root .env"}
              </p>
              {dbStatus.jwtSecretSet ? null : <p className="mt-1 text-red-700">JWT_SECRET is missing in .env — the API will fail to issue tokens.</p>}
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          <Link href="/" className="text-brand underline-offset-2 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
