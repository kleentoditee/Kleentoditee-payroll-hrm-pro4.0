"use client";

import { NavPanel } from "./nav-panel";

/**
 * Permanent desktop sidebar (≥1024px). Renders the single shared NavPanel —
 * no Primary/Pinned/Workspace duplication, no hover previews.
 */
export function Sidebar({
  pathname,
  userRoles,
  onOpenAllApps
}: {
  pathname: string;
  userRoles?: string[];
  onOpenAllApps: () => void;
}) {
  return (
    <aside
      className="h-full w-[232px] shrink-0 border-r border-slate-200 bg-white shadow-[6px_0_24px_rgba(15,23,42,0.05)]"
      aria-label="Main navigation"
    >
      <NavPanel
        pathname={pathname}
        userRoles={userRoles}
        idPrefix="desktop"
        onOpenAllApps={onOpenAllApps}
      />
    </aside>
  );
}
