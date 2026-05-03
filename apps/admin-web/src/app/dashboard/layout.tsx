"use client";

import { AppShell } from "@/components/app-shell";
import { fetchCurrentUser, logout, type AdminUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const currentUser = await fetchCurrentUser();
        if (!cancelled) {
          setUser(currentUser);
        }
      } catch {
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
        logout();
        router.replace("/login");
      }}
    >
      {children}
    </AppShell>
  );
}
