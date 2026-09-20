"use client";

import { AppShell } from "@/components/app-shell";
import { apiBase } from "@/lib/api";
import { authHeaders, clearToken } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; roles: string[] };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Cookie-first: the session lives in the HttpOnly kt_session cookie,
        // so we ask the API directly instead of requiring a stored token.
        const res = await fetch(`${apiBase()}/auth/me`, { headers: { ...authHeaders() } });
        if (!res.ok) {
          throw new Error("unauthorized");
        }
        const data = (await res.json()) as { user: Me };
        if (!cancelled) {
          setUser(data.user);
        }
      } catch {
        clearToken();
        if (!cancelled) {
          router.replace("/login");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">
        Checking session…
      </div>
    );
  }

  return (
    <AppShell
      userName={user.name}
      userEmail={user.email}
      userRoles={user.roles}
      onLogout={() => {
        // Revoke the session server-side (bumps tokenVersion, expires cookies),
        // then clear any legacy stored token and return to the sign-in page.
        void fetch(`${apiBase()}/auth/logout`, {
          method: "POST",
          headers: { ...authHeaders() }
        }).catch(() => undefined);
        clearToken();
        router.replace("/login");
      }}
    >
      {children}
    </AppShell>
  );
}
