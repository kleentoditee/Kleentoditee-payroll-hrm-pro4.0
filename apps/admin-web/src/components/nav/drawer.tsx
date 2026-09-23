"use client";

import { useEffect, useRef } from "react";
import { NavPanel } from "./nav-panel";
import { IcoClose } from "./nav-icons";

/**
 * Mobile/tablet navigation drawer (<1024px). Contains the same NavPanel
 * hierarchy as the desktop sidebar. ESC closes it, Tab focus is kept inside
 * the panel, and `onClose` (handled by AppShell) returns focus to the menu
 * button that opened it.
 */
export function NavDrawer({
  open,
  onClose,
  pathname,
  userRoles,
  onOpenAllApps,
  drawerId
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  userRoles?: string[];
  onOpenAllApps: () => void;
  drawerId: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Move focus into the drawer on open; ESC closes; Tab loops within the panel.
  useEffect(() => {
    if (!open) {
      return;
    }
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) {
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div id={drawerId} className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35"
        aria-label="Close navigation"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="absolute inset-y-0 left-0 flex h-full w-[min(85vw,320px)] flex-col overflow-hidden bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 py-1 pl-4 pr-2">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Menu</p>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]"
          >
            <IcoClose className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <NavPanel
            pathname={pathname}
            userRoles={userRoles}
            idPrefix="mobile"
            onNavigate={onClose}
            onOpenAllApps={onOpenAllApps}
          />
        </div>
      </div>
    </div>
  );
}
