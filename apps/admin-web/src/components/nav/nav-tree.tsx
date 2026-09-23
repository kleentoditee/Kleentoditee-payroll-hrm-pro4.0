"use client";

import { isNavEntryActive, isNavItemActive, NAV_GROUPS, type NavGroup } from "@/lib/dashboard-nav";
import Link from "next/link";
import { GroupGlyph } from "./nav-icons";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#008C95]";

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return (
    isNavItemActive(pathname, group.landingHref) ||
    group.items.some((item) => isNavEntryActive(pathname, item))
  );
}

/**
 * The single top-level navigation hierarchy: Home, People, Time, Payroll,
 * Finance, Reports, Admin. Shared verbatim by the desktop sidebar and the
 * mobile drawer. Detailed destinations stay in each workspace's local
 * navigation and the searchable All Apps launcher, avoiding a second copy in
 * the permanent sidebar.
 */
export function NavTree({
  pathname,
  onNavigate
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Workspaces" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 pt-1">
      <ul className="space-y-0.5">
        {NAV_GROUPS.map((group) => {
          const active = isGroupActive(group, pathname);

          return (
            <li key={group.id}>
              <Link
                href={group.landingHref}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                title={group.title}
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
        })}
      </ul>
    </nav>
  );
}
