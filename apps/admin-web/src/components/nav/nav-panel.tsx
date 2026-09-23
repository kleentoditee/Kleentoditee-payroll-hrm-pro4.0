"use client";

import Link from "next/link";
import { CreateMenu } from "./create-menu";
import { NavTree } from "./nav-tree";
import { IcoGrid } from "./nav-icons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008C95]";

/**
 * Full navigation panel shared by the desktop sidebar and the mobile drawer:
 * brand header, the single Create control, the workspace hierarchy, and the
 * optional compact All Apps launcher trigger. All destinations come from
 * `@/lib/dashboard-nav` via NavTree/CreateMenu — one centralized source.
 */
export function NavPanel({
  pathname,
  userRoles,
  idPrefix,
  onNavigate,
  onOpenAllApps
}: {
  pathname: string;
  userRoles?: string[];
  idPrefix: string;
  onNavigate?: () => void;
  onOpenAllApps: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white text-slate-900">
      <div className="shrink-0 border-b border-slate-100 px-3 py-2">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={["flex min-h-[44px] items-center gap-2 rounded-lg", focusRing].join(" ")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#063E4A] text-xs font-black text-white shadow-sm">
            KT
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-950">KleenToDiTee</span>
            <span className="mt-0.5 inline-flex rounded-full border border-[#006D77]/20 bg-[#EAF6F7] px-1.5 py-0 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[#006D77]">
              Admin
            </span>
          </span>
        </Link>
      </div>

      <div className="shrink-0 px-3 py-2">
        <CreateMenu userRoles={userRoles} idPrefix={idPrefix} onNavigate={onNavigate} />
      </div>

      <NavTree pathname={pathname} idPrefix={idPrefix} onNavigate={onNavigate} />

      <div className="shrink-0 border-t border-slate-100 p-2">
        <button
          type="button"
          onClick={onOpenAllApps}
          aria-haspopup="dialog"
          className={[
            "flex min-h-[44px] w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-left text-[13px] font-semibold text-slate-700 transition-colors duration-[180ms] ease-out hover:bg-[#F1F8F8] hover:text-slate-950 motion-reduce:transition-none",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#008C95]"
          ].join(" ")}
        >
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#0f172a]"
            aria-hidden
          >
            <IcoGrid className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1 truncate">All apps</span>
        </button>
      </div>
    </div>
  );
}
