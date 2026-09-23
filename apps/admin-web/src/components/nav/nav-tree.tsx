"use client";

import { isNavItemActive, NAV_GROUPS, type NavGroup } from "@/lib/dashboard-nav";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GroupGlyph, IcoChevron, ItemGlyph } from "./nav-icons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#008C95]";

function normalize(path: string): string {
  return path.replace(/\/$/, "") || "/";
}

/** Exact-match check (trailing-slash tolerant) for aria-current on landing links. */
function isExactRoute(pathname: string, href: string): boolean {
  return normalize(pathname) === normalize(href);
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return (
    isNavItemActive(pathname, group.landingHref) ||
    group.items.some((item) => isNavItemActive(pathname, item.href))
  );
}

/**
 * The single top-level navigation hierarchy: Home, People, Time, Payroll,
 * Finance, Reports, Admin. Shared verbatim by the desktop sidebar and the
 * mobile drawer. Clicking a workspace name navigates to its landing page;
 * a separate disclosure toggle reveals that workspace's section links.
 * The workspace containing the active route expands automatically.
 */
export function NavTree({
  pathname,
  idPrefix,
  onNavigate
}: {
  pathname: string;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const activeGroupId =
    NAV_GROUPS.find((group) => isGroupActive(group, pathname))?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(activeGroupId);

  // Auto-expand the workspace that owns the active route when it changes.
  // Manual collapse persists while navigating within the same workspace.
  useEffect(() => {
    setExpandedId(activeGroupId);
  }, [activeGroupId]);

  return (
    <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 pt-1">
      <ul className="space-y-0.5">
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group, pathname);

          if (group.id === "dashboard") {
            return (
              <li key={group.id}>
                <Link
                  href={group.landingHref}
                  onClick={onNavigate}
                  aria-current={isExactRoute(pathname, group.landingHref) ? "page" : undefined}
                  className={[
                    "group flex min-h-[44px] w-full items-center gap-2 rounded-lg border px-2 py-1 text-left text-[13px] leading-snug transition-colors duration-[180ms] ease-out motion-reduce:transition-none",
                    active
                      ? "border-[#BDEBE7] bg-[#F1F8F8] font-bold text-[#073B4C] shadow-sm"
                      : "border-transparent font-semibold text-slate-700 hover:bg-[#F1F8F8] hover:text-slate-950",
                    focusRing
                  ].join(" ")}
                >
                  <GroupGlyph groupId={group.id} active={active} />
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                </Link>
              </li>
            );
          }

          const expanded = expandedId === group.id;
          const panelId = `${idPrefix}-nav-panel-${group.id}`;

          return (
            <li key={group.id}>
              <div
                className={[
                  "flex items-stretch rounded-lg border transition-colors duration-[180ms] ease-out motion-reduce:transition-none",
                  active
                    ? "border-[#BDEBE7] bg-[#F1F8F8] shadow-sm"
                    : "border-transparent hover:bg-[#F1F8F8]"
                ].join(" ")}
              >
                <Link
                  href={group.landingHref}
                  onClick={onNavigate}
                  aria-current={isExactRoute(pathname, group.landingHref) ? "page" : undefined}
                  title={group.title}
                  className={[
                    "group flex min-h-[44px] min-w-0 flex-1 items-center gap-2 rounded-l-lg px-2 py-1 text-left text-[13px] leading-snug",
                    active ? "font-bold text-[#073B4C]" : "font-semibold text-slate-700 hover:text-slate-950",
                    focusRing
                  ].join(" ")}
                >
                  <GroupGlyph groupId={group.id} active={active} />
                  <span className="min-w-0 flex-1 truncate">{group.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : group.id)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`${expanded ? "Hide" : "Show"} ${group.title} sections`}
                  className={[
                    "flex min-h-[44px] w-11 shrink-0 items-center justify-center rounded-r-lg text-slate-500 transition-colors hover:text-[#073B4C]",
                    focusRing
                  ].join(" ")}
                >
                  <IcoChevron
                    className={["h-4 w-4 transition-transform duration-[180ms] motion-reduce:transition-none", expanded ? "rotate-180" : ""].join(" ")}
                  />
                </button>
              </div>
              {expanded ? (
                <ul id={panelId} aria-label={`${group.title} sections`} className="mt-0.5 space-y-0.5 pl-2">
                  {group.items.map((item) => {
                    const itemActive = isNavItemActive(pathname, item.href);
                    return (
                      <li key={`${group.id}-${item.href}`}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          aria-current={itemActive ? "page" : undefined}
                          title={item.label}
                          className={[
                            "flex min-h-[44px] items-center gap-2 rounded-lg border px-2 py-1 text-[13px] leading-snug transition-colors duration-[180ms] ease-out motion-reduce:transition-none",
                            itemActive
                              ? "border-[#BDEBE7] bg-[#E6F5F3] font-bold text-[#073B4C]"
                              : "border-transparent font-medium text-slate-600 hover:bg-[#F1F8F8] hover:text-slate-950",
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
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
