"use client";

import { AppShell } from "@/components/app-shell";
import { apiBase } from "@/lib/api";
import { authHeaders, clearToken, getToken } from "@/lib/auth-storage";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { id: string; email: string; name: string; roles: string[] };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
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
        clearToken();
        router.replace("/login");
      }}
    >
      {children}
    </AppShell>
  );
}
