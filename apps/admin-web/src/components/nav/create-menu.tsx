"use client";

import { CREATE_ACTIONS } from "@/lib/dashboard-nav";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { IcoChevron, IcoPlus } from "./nav-icons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]";

/**
 * Single Create control for frequent actions.
 * Role-based filtering is preserved exactly from the original shell:
 * an action with `roles` is shown only when the user has one of those roles.
 */
export function CreateMenu({
  userRoles,
  idPrefix,
  onNavigate
}: {
  userRoles?: string[];
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = `${idPrefix}-create-menu`;

  const items = CREATE_ACTIONS.filter(
    (a) => !a.roles || a.roles.some((r) => userRoles?.includes(r))
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        className={[
          "flex min-h-[44px] w-full items-center justify-between rounded-xl border border-[#BDEBE7] bg-[#E6F5F3] px-3 text-xs font-bold text-[#063E4A] shadow-sm transition-colors duration-[180ms] ease-out hover:bg-[#F1F8F8] motion-reduce:transition-none",
          focusRing
        ].join(" ")}
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#008C95] ring-1 ring-[#BDEBE7]"
            aria-hidden
          >
            <IcoPlus className="h-[18px] w-[18px]" />
          </span>
          Create
        </span>
        <IcoChevron
          className={["h-3.5 w-3.5 opacity-80 transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Create"
          className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
        >
          {items.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              role="menuitem"
              className={[
                "flex min-h-[44px] items-center px-3 text-sm font-medium text-slate-700 transition-colors duration-[180ms] hover:bg-[#F1F8F8] hover:text-[#073B4C] motion-reduce:transition-none",
                focusRing
              ].join(" ")}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
            >
              {a.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
