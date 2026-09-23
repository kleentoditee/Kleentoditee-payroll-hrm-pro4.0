"use client";

import { FinanceBreadcrumbs } from "@/components/finance/breadcrumbs";
import {
  FINANCE_SECTIONS,
  getActiveFinanceSection,
  getFinanceBreadcrumbs,
  isFinanceItemActive
} from "@/lib/finance-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const sectionPillClass = (active: boolean) =>
  `inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active ? "bg-brand text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
  }`;

const itemLinkClass = (active: boolean) =>
  `inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
    active ? "bg-brand text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
  }`;

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = getActiveFinanceSection(pathname);
  const crumbs = getFinanceBreadcrumbs(pathname);
  const isOverview = section.id === "overview";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  // Close the compact section menu after navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes the menu and returns focus to the toggle.
  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="space-y-4">
      {!isOverview ? <FinanceBreadcrumbs items={crumbs} /> : null}

      {/* Desktop: six compact section controls. */}
      <nav aria-label="Finance sections" className="hidden flex-wrap gap-2 lg:flex">
        {FINANCE_SECTIONS.map((entry) => (
          <Link key={entry.id} href={entry.href} className={sectionPillClass(entry.id === section.id)}>
            {entry.label}
          </Link>
        ))}
      </nav>

      {/* Tablet and phone: compact disclosure — never all destinations at once. */}
      <div className="lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls="finance-section-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="truncate">
            <span className="text-slate-500">Finance · </span>
            {section.label}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {menuOpen ? (
          <div
            id="finance-section-menu"
            ref={menuPanelRef}
            className="mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
          >
            <ul className="space-y-1">
              {FINANCE_SECTIONS.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={entry.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={entry.id === section.id ? "page" : undefined}
                    className={`flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      entry.id === section.id
                        ? "bg-brand text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {entry.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Secondary navigation: only the active section's destinations. */}
      {section.items.length > 0 ? (
        <nav
          aria-label={`${section.label} pages`}
          className="overflow-x-auto border-b border-slate-200 pb-3"
        >
          <div className="flex min-w-max gap-2">
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isFinanceItemActive(pathname, item.href) ? "page" : undefined}
                className={itemLinkClass(isFinanceItemActive(pathname, item.href))}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}

      {children}
    </div>
  );
}
