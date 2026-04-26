"use client";

import { CREATE_ACTIONS, isNavItemActive, NAV_GROUPS } from "@/lib/dashboard-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const [createOpen, setCreateOpen] = useState(false);
  const createRef = useRef<HTMLDivElement>(null);

  const createItems = CREATE_ACTIONS.filter(
    (a) => !a.roles || a.roles.some((r) => userRoles?.includes(r))
  );

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside
        className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm"
        aria-label="Main navigation"
      >
        <div className="border-b border-slate-100 px-4 py-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              KT
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">KleenToDiTee</p>
              <p className="text-[0.65rem] font-medium uppercase tracking-wider text-slate-500">Admin</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="mb-5">
              <p className="px-2 pb-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-slate-400">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <li key={`${group.id}-${item.label}-${item.href}`}>
                      <Link
                        href={item.href}
                        className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                          active
                            ? "bg-brand/10 font-medium text-brand"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {item.label}
                          {item.comingSoon ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0 text-[0.6rem] font-semibold uppercase text-amber-800">
                              Soon
                            </span>
                          ) : null}
                        </span>
                        {item.hint ? (
                          <span className="mt-0.5 block text-[0.7rem] font-normal leading-snug text-slate-500">
                            {item.hint}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  {userEmail ? <span className="text-slate-500"> · {userEmail}</span> : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative" ref={createRef}>
                <button
                  type="button"
                  onClick={() => setCreateOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-soft"
                  aria-expanded={createOpen}
                  aria-haspopup="true"
                >
                  Create
                  <span className="text-xs opacity-90" aria-hidden>
                    ▾
                  </span>
                </button>
                {createOpen ? (
                  <div
                    className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                    role="menu"
                  >
                    {createItems.map((a) => (
                      <Link
                        key={a.href + a.label}
                        href={a.href}
                        role="menuitem"
                        className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setCreateOpen(false)}
                      >
                        {a.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
              {onLogout ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign out
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
