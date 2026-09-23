"use client";

import { usePathname } from "next/navigation";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { NavDrawer } from "./nav/drawer";
import { Sidebar } from "./nav/sidebar";
import { Topbar } from "./nav/topbar";

// Optional compact launcher — lazy-loaded so it ships no UI until opened.
const AllAppsLauncher = lazy(() => import("./nav/all-apps-launcher"));

const DRAWER_ID = "mobile-nav-drawer";

/**
 * Application shell. Props interface preserved exactly — dashboard/layout.tsx
 * passes userName/userEmail/userRoles/onLogout. Navigation itself lives in
 * `components/nav/*` with definitions centralized in `lib/dashboard-nav.ts`.
 */
export function AppShell({
  children,
  userName,
  userEmail,
  userRoles,
  onLogout
}: {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  userRoles?: string[];
  onLogout?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastPathname = useRef(pathname);

  // Close transient navigation after a route change (drawer + launcher),
  // without stealing focus — the new page owns focus after navigation.
  useEffect(() => {
    if (lastPathname.current !== pathname) {
      lastPathname.current = pathname;
      setMobileOpen(false);
      setAllAppsOpen(false);
    }
  }, [pathname]);

  // Explicit drawer close (ESC, backdrop, close button, link selection on a
  // touch device) returns keyboard focus to the menu button that opened it.
  const closeDrawer = useCallback(() => {
    setMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const openAllApps = useCallback(() => {
    setMobileOpen(false);
    setAllAppsOpen(true);
  }, []);

  const closeAllApps = useCallback(() => {
    setAllAppsOpen(false);
  }, []);

  return (
    <div className="flex h-screen min-h-screen bg-[#F4F7FA]">
      <div className="hidden h-screen shrink-0 lg:flex">
        <Sidebar pathname={pathname} userRoles={userRoles} onOpenAllApps={openAllApps} />
      </div>

      <NavDrawer
        open={mobileOpen}
        onClose={closeDrawer}
        pathname={pathname}
        userRoles={userRoles}
        onOpenAllApps={openAllApps}
        drawerId={DRAWER_ID}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar
          userName={userName}
          userEmail={userEmail}
          onLogout={onLogout}
          onOpenNav={() => setMobileOpen(true)}
          menuButtonRef={menuButtonRef}
          drawerOpen={mobileOpen}
          drawerId={DRAWER_ID}
        />
        <main className="w-full flex-1 px-4 py-6 sm:px-5 md:px-6 lg:px-7 lg:py-7">{children}</main>
      </div>

      {allAppsOpen ? (
        <Suspense fallback={null}>
          <AllAppsLauncher pathname={pathname} onClose={closeAllApps} />
        </Suspense>
      ) : null}
    </div>
  );
}
