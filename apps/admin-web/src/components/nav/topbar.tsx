"use client";

import type { RefObject } from "react";
import { IcoMenu } from "./nav-icons";

/**
 * Sticky top bar: menu trigger (<1024px), product title, signed-in user
 * display, and logout. Behavior and props preserved from the original shell.
 */
export function Topbar({
  userName,
  userEmail,
  onLogout,
  onOpenNav,
  menuButtonRef,
  drawerOpen,
  drawerId
}: {
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
  onOpenNav: () => void;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  drawerOpen: boolean;
  drawerId: string;
}) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-7">
      <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={onOpenNav}
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls={drawerId}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95] lg:hidden"
          >
            <IcoMenu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Console
            </p>
            <h1 className="truncate font-serif text-lg font-semibold text-slate-900 sm:text-xl">
              KleenToDiTee platform
            </h1>
            {userName ? (
              <p className="mt-0.5 truncate text-xs text-slate-600">
                <span className="font-medium text-slate-800">{userName}</span>
                {userEmail ? <span className="text-slate-500"> / {userEmail}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
        {onLogout ? (
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]"
          >
            Sign out
          </button>
        ) : null}
      </div>
    </header>
  );
}
