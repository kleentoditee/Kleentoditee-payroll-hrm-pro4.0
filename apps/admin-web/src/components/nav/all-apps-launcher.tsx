"use client";

import { isNavItemActive, NAV_GROUPS } from "@/lib/dashboard-nav";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IcoClose, IcoSearch, ItemGlyph, LauncherGroupIcon, launcherColor } from "./nav-icons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]";

/**
 * Optional compact All Apps launcher. Lazy-loaded by AppShell so it costs
 * nothing until opened. A single filtered list grouped by workspace — not a
 * second full navigation system. ESC closes it and focus returns to
 * whichever control opened it.
 *
 * Default-exported so AppShell can lazy-load it with React.lazy.
 */
export default function AllAppsLauncher({
  pathname,
  onClose
}: {
  pathname: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  // Focus the filter on open; restore focus to the opener on close; ESC closes.
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    searchRef.current?.focus();

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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
      const el = previousFocusRef.current as HTMLElement | null;
      if (el && document.contains(el)) {
        el.focus();
      }
    };
  }, [onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return NAV_GROUPS;
    }
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.label.toLowerCase().includes(q))
    })).filter(
      (group) => group.items.length > 0 || group.title.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="All apps"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35"
        aria-label="Close All apps"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        className="relative flex max-h-[min(34rem,calc(100vh-1.5rem))] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-[#F8FCFC] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-slate-950">All apps</h2>
            <p className="mt-0.5 text-xs text-slate-600">Jump to any workspace tool.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close All apps"
            className={[
              "flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-[#F1F8F8]",
              focusRing
            ].join(" ")}
          >
            <IcoClose className="h-4 w-4" />
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-100 px-3 py-2">
          <label className="relative block">
            <span className="sr-only">Filter apps</span>
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400"
              aria-hidden
            >
              <IcoSearch className="h-4 w-4" />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter apps"
              className={[
                "min-h-[44px] w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400",
                focusRing
              ].join(" ")}
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          {groups.map((group) => (
            <section key={group.id} className="pt-3" aria-label={group.title}>
              <Link
                href={group.landingHref}
                onClick={onClose}
                className={[
                  "group flex min-h-[44px] items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-[#F1F8F8]",
                  focusRing
                ].join(" ")}
              >
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                  style={{ backgroundColor: launcherColor(group.id) }}
                  aria-hidden
                >
                  <LauncherGroupIcon groupId={group.id} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-slate-900">
                  {group.title}
                </span>
              </Link>
              <ul className="mt-0.5 space-y-0.5 pl-2">
                {group.items.map((item) => {
                  const itemActive = isNavItemActive(pathname, item.href);
                  return (
                    <li key={`${group.id}-${item.href}`}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        aria-current={itemActive ? "page" : undefined}
                        title={item.label}
                        className={[
                          "flex min-h-[44px] items-center gap-2 rounded-lg px-2 py-1 text-[13px] leading-snug transition-colors",
                          itemActive
                            ? "bg-[#E6F5F3] font-bold text-[#073B4C]"
                            : "font-medium text-slate-600 hover:bg-[#F1F8F8] hover:text-slate-950",
                          focusRing
                        ].join(" ")}
                      >
                        <ItemGlyph href={item.href} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No apps match this filter.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
