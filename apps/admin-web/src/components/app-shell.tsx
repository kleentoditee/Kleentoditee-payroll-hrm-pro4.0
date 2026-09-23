"use client";

import {
  CREATE_ACTIONS,
  isNavItemActive,
  NAV_GROUPS,
  PINNED_SHORTCUTS,
  PRIMARY_NAV,
  type NavGroup,
  type NavItem
} from "@/lib/dashboard-nav";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const stroke = 2.5;

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Icon glyphs — inline SVG only (no icon dependency package). */
function IcoHome({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

function IcoActivity({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
  );
}

function IcoChart({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </Svg>
  );
}

function IcoGrid({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Svg>
  );
}

function IcoCalculator({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="8" x2="8" y1="10" y2="10.01" />
      <line x1="12" x2="12" y1="10" y2="10.01" />
      <line x1="16" x2="16" y1="10" y2="10.01" />
      <line x1="8" x2="8" y1="14" y2="14.01" />
      <line x1="12" x2="12" y1="14" y2="14.01" />
      <line x1="16" x2="16" y1="14" y2="14.01" />
      <line x1="8" x2="8" y1="18" y2="18.01" />
      <line x1="12" x2="12" y1="18" y2="18.01" />
      <line x1="16" x2="16" y1="18" y2="18.01" />
    </Svg>
  );
}

function IcoReceipt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6" />
      <path d="M16 12h-6" />
      <path d="M10 16h6" />
    </Svg>
  );
}

function IcoInvoice({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </Svg>
  );
}

function IcoDollar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function IcoClock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

function IcoUsers({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

function IcoLayoutDashboard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </Svg>
  );
}

function IcoWallet({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4Z" />
    </Svg>
  );
}

function IcoShield({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

function IcoSettings({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

function IcoPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </Svg>
  );
}

function IcoInbox({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  );
}

function IcoFile({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </Svg>
  );
}

function IcoUserCheck({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </Svg>
  );
}

function IcoCalendar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </Svg>
  );
}

function IcoMegaphone({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </Svg>
  );
}

function IcoPackage({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </Svg>
  );
}

function IcoCreditCard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </Svg>
  );
}

function IcoArrowDownLeft({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="17" x2="7" y1="7" y2="17" />
      <polyline points="17 17 7 17 7 7" />
    </Svg>
  );
}

function IcoBuilding({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M12 6h.01" />
      <path d="M12 10h.01" />
      <path d="M12 14h.01" />
      <path d="M16 10h.01" />
      <path d="M16 14h.01" />
      <path d="M8 10h.01" />
      <path d="M8 14h.01" />
    </Svg>
  );
}

function IcoScroll({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h18" />
    </Svg>
  );
}

function IcoCloudUpload({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.5 7.243" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </Svg>
  );
}

const iconSm = "h-[18px] w-[18px]";
const iconXs = "h-3.5 w-3.5";

type SidebarPreview =
  | { type: "primary"; key: string; item: NavItem; top: number }
  | { type: "pinned"; key: string; item: NavItem; top: number }
  | { type: "workspace"; key: string; group: NavGroup; top: number };

type SidebarPreviewInput =
  | { type: "primary"; key: string; item: NavItem }
  | { type: "pinned"; key: string; item: NavItem }
  | { type: "workspace"; key: string; group: NavGroup };

function SidebarIconSlot({
  active,
  small,
  children
}: {
  active?: boolean;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-lg text-current transition-all duration-[180ms] ease-out motion-reduce:transition-none",
        small ? "h-7 w-7" : "h-8 w-8",
        active
          ? "bg-[#E6F5F3] text-[#006D77] shadow-sm ring-1 ring-[#BDEBE7]"
          : "bg-slate-100 text-[#0f172a] group-hover:bg-[#F1F8F8] group-hover:text-[#007C89]"
      ].join(" ")}
      aria-hidden
    >
      <span className={[small ? iconXs : iconSm, "flex items-center justify-center"].join(" ")}>{children}</span>
    </span>
  );
}

function PrimaryNavGlyph({ item, active }: { item: NavItem; active?: boolean }) {
  let inner: React.ReactNode;
  switch (item.label) {
    case "Home":
      inner = <IcoHome className={iconSm} />;
      break;
    case "Activity":
      inner = <IcoActivity className={iconSm} />;
      break;
    case "Reports":
      inner = <IcoChart className={iconSm} />;
      break;
    case "All apps":
      inner = <IcoGrid className={iconSm} />;
      break;
    default:
      inner = <IcoHome className={iconSm} />;
  }
  return <SidebarIconSlot active={active}>{inner}</SidebarIconSlot>;
}

function PinnedNavGlyph({ label, active }: { label: string; active?: boolean }) {
  let inner: React.ReactNode;
  switch (label) {
    case "Accounting":
      inner = <IcoCalculator className={iconSm} />;
      break;
    case "Expenses":
      inner = <IcoReceipt className={iconSm} />;
      break;
    case "Sales":
      inner = <IcoInvoice className={iconSm} />;
      break;
    case "Payroll":
      inner = <IcoDollar className={iconSm} />;
      break;
    case "Time":
      inner = <IcoClock className={iconSm} />;
      break;
    case "Employees":
      inner = <IcoUsers className={iconSm} />;
      break;
    default:
      inner = <IcoLayoutDashboard className={iconSm} />;
  }
  return <SidebarIconSlot active={active} small>{inner}</SidebarIconSlot>;
}

function WorkspaceParentGlyph({ groupId, active }: { groupId: string; active?: boolean }) {
  let inner: React.ReactNode;
  switch (groupId) {
    case "dashboard":
      inner = <IcoLayoutDashboard className={iconSm} />;
      break;
    case "people":
      inner = <IcoUsers className={iconSm} />;
      break;
    case "time":
      inner = <IcoClock className={iconSm} />;
      break;
    case "payroll":
      inner = <IcoDollar className={iconSm} />;
      break;
    case "finance":
      inner = <IcoWallet className={iconSm} />;
      break;
    case "reports":
      inner = <IcoChart className={iconSm} />;
      break;
    case "admin":
      inner = <IcoShield className={iconSm} />;
      break;
    default:
      inner = <IcoLayoutDashboard className={iconSm} />;
  }
  return <SidebarIconSlot active={active} small>{inner}</SidebarIconSlot>;
}

function WorkspaceChildGlyph({ href }: { href: string }) {
  let inner: React.ReactNode;
  switch (href) {
    case "/dashboard":
      inner = <IcoHome className={iconXs} />;
      break;
    case "/dashboard/people/employees":
      inner = <IcoUsers className={iconXs} />;
      break;
    case "/dashboard/people/requests":
      inner = <IcoInbox className={iconXs} />;
      break;
    case "/dashboard/people/templates":
      inner = <IcoFile className={iconXs} />;
      break;
    case "/dashboard/users":
      inner = <IcoUserCheck className={iconXs} />;
      break;
    case "/dashboard/email-queue":
      inner = <IcoInbox className={iconXs} />;
      break;
    case "/dashboard/time/entries":
      inner = <IcoClock className={iconXs} />;
      break;
    case "/dashboard/time/approvals":
      inner = <IcoActivity className={iconXs} />;
      break;
    case "/dashboard/schedule":
      inner = <IcoCalendar className={iconXs} />;
      break;
    case "/dashboard/announcements":
      inner = <IcoMegaphone className={iconXs} />;
      break;
    case "/dashboard/payroll/periods":
      inner = <IcoCalendar className={iconXs} />;
      break;
    case "/dashboard/payroll/runs":
      inner = <IcoDollar className={iconXs} />;
      break;
    case "/dashboard/finance/accounts":
      inner = <IcoBuilding className={iconXs} />;
      break;
    case "/dashboard/finance/customers":
      inner = <IcoUsers className={iconXs} />;
      break;
    case "/dashboard/finance/suppliers":
      inner = <IcoBuilding className={iconXs} />;
      break;
    case "/dashboard/finance/products":
      inner = <IcoPackage className={iconXs} />;
      break;
    case "/dashboard/finance/invoices":
      inner = <IcoInvoice className={iconXs} />;
      break;
    case "/dashboard/finance/bills":
      inner = <IcoReceipt className={iconXs} />;
      break;
    case "/dashboard/finance/payments":
      inner = <IcoCreditCard className={iconXs} />;
      break;
    case "/dashboard/finance/bill-payments":
      inner = <IcoArrowDownLeft className={iconXs} />;
      break;
    case "/dashboard/finance/expenses":
      inner = <IcoReceipt className={iconXs} />;
      break;
    case "/dashboard/finance/deposits":
      inner = <IcoWallet className={iconXs} />;
      break;
    case "/dashboard/reports":
      inner = <IcoChart className={iconXs} />;
      break;
    case "/dashboard/audit":
      inner = <IcoScroll className={iconXs} />;
      break;
    case "/dashboard/imports/quickbooks":
      inner = <IcoCloudUpload className={iconXs} />;
      break;
    case "/dashboard/settings":
      inner = <IcoSettings className={iconXs} />;
      break;
    default:
      inner = <IcoFile className={iconXs} />;
  }
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-current" aria-hidden>
      {inner}
    </span>
  );
}

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
  const [allAppsOpen, setAllAppsOpen] = useState(false);
  const [allAppsCategory, setAllAppsCategory] = useState("all");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarPreview, setSidebarPreview] = useState<SidebarPreview | null>(null);
  const createRef = useRef<HTMLDivElement>(null);
  const previewShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createItems = CREATE_ACTIONS.filter(
    (a) => !a.roles || a.roles.some((r) => userRoles?.includes(r))
  );

  useEffect(() => {
    setMobileOpen(false);
    setAllAppsOpen(false);
    setSidebarPreview(null);
  }, [pathname]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarPreview(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (previewShowTimer.current) {
        clearTimeout(previewShowTimer.current);
      }
      if (previewHideTimer.current) {
        clearTimeout(previewHideTimer.current);
      }
    };
  }, []);

  function openAllApps(category = "all") {
    const activeGroup = NAV_GROUPS.find((group) => group.items.some((item) => isNavItemActive(pathname, item.href)));
    setAllAppsCategory(category === "all" ? activeGroup?.id ?? "payroll" : category);
    setAllAppsOpen(true);
    setSidebarPreview(null);
    setMobileOpen(false);
  }

  function clearPreviewTimers() {
    if (previewShowTimer.current) {
      clearTimeout(previewShowTimer.current);
      previewShowTimer.current = null;
    }
    if (previewHideTimer.current) {
      clearTimeout(previewHideTimer.current);
      previewHideTimer.current = null;
    }
  }

  function previewTopFromElement(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return Math.max(72, Math.min(rect.top - 6, window.innerHeight - 300));
  }

  function showPreview(next: SidebarPreviewInput, element: HTMLElement) {
    clearPreviewTimers();
    const top = previewTopFromElement(element);
    previewShowTimer.current = setTimeout(() => {
      setSidebarPreview({ ...next, top } as SidebarPreview);
    }, 120);
  }

  function schedulePreviewHide() {
    if (previewShowTimer.current) {
      clearTimeout(previewShowTimer.current);
      previewShowTimer.current = null;
    }
    if (previewHideTimer.current) {
      clearTimeout(previewHideTimer.current);
    }
    previewHideTimer.current = setTimeout(() => {
      setSidebarPreview(null);
    }, 160);
  }

  function SidebarContent() {
    return (
      <aside
        className="flex h-full min-h-0 w-[212px] shrink-0 flex-col border-r border-slate-200 bg-white text-slate-900 shadow-[6px_0_24px_rgba(15,23,42,0.05)]"
        aria-label="Main navigation"
      >
        <div className="shrink-0 border-b border-slate-100 px-3 py-2">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#063E4A] text-xs font-black text-white shadow-sm">
              KT
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-950">KleenToDiTee</p>
              <span className="mt-0.5 inline-flex rounded-full border border-[#006D77]/20 bg-[#EAF6F7] px-1.5 py-0 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[#006D77]">
                Admin
              </span>
            </div>
          </Link>
        </div>

        <div className="relative shrink-0 px-3 py-2" ref={createRef}>
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            className="flex h-10 w-full min-h-[40px] max-h-[40px] items-center justify-between rounded-xl border border-[#BDEBE7] bg-[#E6F5F3] px-3 text-xs font-bold text-[#063E4A] shadow-sm transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
            aria-expanded={createOpen}
            aria-haspopup="true"
          >
            <span className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white text-[#008C95] ring-1 ring-[#BDEBE7]" aria-hidden>
                <IcoPlus className="h-[18px] w-[18px]" />
              </span>
              Create
            </span>
            <span className="text-[0.65rem] opacity-80" aria-hidden>
              {createOpen ? "-" : "v"}
            </span>
          </button>
          {createOpen ? (
            <div
              className="absolute left-3 right-3 z-30 mt-2 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
              role="menu"
            >
              {createItems.map((a) => (
                <Link
                  key={a.href + a.label}
                  href={a.href}
                  role="menuitem"
                  className="block px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-[180ms] hover:bg-[#F1F8F8] hover:text-[#073B4C] motion-reduce:transition-none"
                  onClick={() => setCreateOpen(false)}
                >
                  {a.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
          <SidebarSection label="Primary">
            <div className="space-y-0.5">
              {PRIMARY_NAV.map((item) => (
                <PanelLink
                  key={`${item.label}-${item.href}`}
                  item={item}
                  active={item.action === "all-apps" ? allAppsOpen : isNavItemActive(pathname, item.href)}
                  onAllAppsClick={() => openAllApps()}
                  onPreview={(element) =>
                    showPreview({ type: "primary", key: `${item.label}-${item.href}`, item }, element)
                  }
                  onPreviewHide={schedulePreviewHide}
                />
              ))}
            </div>
          </SidebarSection>

          <SidebarSection label="Pinned" compact>
            <div className="grid grid-cols-2 gap-1">
              {PINNED_SHORTCUTS.map((item) => (
                <PinnedLink
                  key={`${item.label}-${item.href}`}
                  item={item}
                  active={isNavItemActive(pathname, item.href)}
                  onPreview={(element) =>
                    showPreview({ type: "pinned", key: `${item.label}-${item.href}`, item }, element)
                  }
                  onPreviewHide={schedulePreviewHide}
                />
              ))}
            </div>
          </SidebarSection>

          <SidebarSection label="Workspace" compact>
            <div className="space-y-0.5">
              {NAV_GROUPS.map((group) => (
                <ModuleGroup
                  key={group.id}
                  group={group}
                  pathname={pathname}
                  onOpenAllApps={() => openAllApps(group.id)}
                  onPreview={(element) =>
                    showPreview({ type: "workspace", key: group.id, group }, element)
                  }
                  onPreviewHide={schedulePreviewHide}
                />
              ))}
            </div>
          </SidebarSection>
        </nav>
      </aside>
    );
  }

  return (
    <div className="flex min-h-screen h-screen bg-[#F4F7FA]">
      <div className="hidden h-screen shrink-0 lg:flex">
        <SidebarContent />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex h-full max-w-[min(100vw,212px)] overflow-hidden shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 lg:px-7">
          <div className="mx-auto flex w-full max-w-[1920px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
                aria-label="Open navigation"
              >
                <span className="text-xs font-bold" aria-hidden>
                  Menu
                </span>
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
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            ) : null}
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-6 sm:px-5 md:px-6 lg:px-7 lg:py-7">{children}</main>
      </div>
      <AllAppsPanel
        open={allAppsOpen}
        category={allAppsCategory}
        onCategoryChange={setAllAppsCategory}
        onClose={() => setAllAppsOpen(false)}
      />
      <SidebarHoverPreview
        preview={sidebarPreview}
        onMouseEnter={clearPreviewTimers}
        onMouseLeave={schedulePreviewHide}
        onClose={() => setSidebarPreview(null)}
        onOpenAllApps={openAllApps}
      />
    </div>
  );
}

function SidebarSection({
  label,
  children,
  compact
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={[
        "border-t border-slate-100 first:border-t-0",
        compact ? "py-1.5" : "py-2"
      ].join(" ")}
    >
      <p
        className={[
          "px-1.5 font-black uppercase tracking-[0.16em] text-[#94A3B8]",
          compact ? "mb-1 text-[0.52rem]" : "mb-1.5 text-[0.58rem]"
        ].join(" ")}
      >
        {label}
      </p>
      {children}
    </section>
  );
}

function PanelLink({
  item,
  active,
  onAllAppsClick,
  onPreview,
  onPreviewHide
}: {
  item: NavItem;
  active?: boolean;
  onAllAppsClick?: () => void;
  onPreview: (element: HTMLElement) => void;
  onPreviewHide: () => void;
}) {
  const className = [
    "group flex min-h-[34px] w-full items-center gap-2 rounded-lg border px-1.5 py-1 text-left text-[13px] leading-snug transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:shadow-sm active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none",
    active
      ? "border-[#BDEBE7] bg-[#F1F8F8] font-bold text-[#073B4C] shadow-sm"
      : "border-transparent font-semibold text-slate-700 hover:bg-[#F1F8F8] hover:text-slate-950"
  ].join(" ");
  const content = (
    <>
      <PrimaryNavGlyph item={item} active={active} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </>
  );
  if (item.action === "all-apps") {
    return (
      <button
        type="button"
        className={className}
        onClick={onAllAppsClick}
        onMouseEnter={(event) => onPreview(event.currentTarget)}
        onMouseLeave={onPreviewHide}
        onFocus={(event) => onPreview(event.currentTarget)}
        onBlur={onPreviewHide}
      >
        {content}
      </button>
    );
  }
  return (
    <Link
      href={item.href}
      className={className}
      onMouseEnter={(event) => onPreview(event.currentTarget)}
      onMouseLeave={onPreviewHide}
      onFocus={(event) => onPreview(event.currentTarget)}
      onBlur={onPreviewHide}
    >
      {content}
    </Link>
  );
}

function PinnedLink({
  item,
  active,
  onPreview,
  onPreviewHide
}: {
  item: NavItem;
  active?: boolean;
  onPreview: (element: HTMLElement) => void;
  onPreviewHide: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={[
        "group flex min-h-[36px] max-h-[38px] items-center gap-1.5 rounded-md border px-1.5 py-1 text-[12px] font-semibold leading-tight transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:shadow-sm active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none",
        active
          ? "border-[#BDEBE7] bg-[#F1F8F8] text-[#073B4C] shadow-sm"
          : "border-slate-200 bg-white text-slate-800 hover:border-[#D6EEF0] hover:bg-[#F1F8F8]"
      ].join(" ")}
      onMouseEnter={(event) => onPreview(event.currentTarget)}
      onMouseLeave={onPreviewHide}
      onFocus={(event) => onPreview(event.currentTarget)}
      onBlur={onPreviewHide}
    >
      <PinnedNavGlyph label={item.label} active={active} />
      <span className="min-w-0 flex-1 truncate leading-snug">{item.label}</span>
    </Link>
  );
}

function ModuleGroup({
  group,
  pathname,
  onOpenAllApps,
  onPreview,
  onPreviewHide
}: {
  group: NavGroup;
  pathname: string;
  onOpenAllApps: () => void;
  onPreview: (element: HTMLElement) => void;
  onPreviewHide: () => void;
}) {
  const active = group.items.some((item) => isNavItemActive(pathname, item.href));
  return (
    <div>
      <button
        type="button"
        onClick={onOpenAllApps}
        onMouseEnter={(event) => onPreview(event.currentTarget)}
        onMouseLeave={onPreviewHide}
        onFocus={(event) => onPreview(event.currentTarget)}
        onBlur={onPreviewHide}
        className={[
          "group flex min-h-[36px] w-full items-center gap-2 rounded-lg border px-1.5 py-1 text-[12px] transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:shadow-sm active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none",
          active
            ? "border-[#BDEBE7] bg-[#F1F8F8] font-bold text-[#073B4C] shadow-sm"
            : "border-transparent font-semibold text-slate-800 hover:bg-[#F1F8F8]"
        ].join(" ")}
      >
        <WorkspaceParentGlyph groupId={group.id} active={active} />
        <span className="min-w-0 flex-1 truncate text-left">{group.title}</span>
        <span className="text-[0.65rem] text-slate-400" aria-hidden>
          Apps
        </span>
      </button>
    </div>
  );
}

function previewIconForPrimary(label: string, className: string) {
  switch (label) {
    case "Home":
      return <IcoHome className={className} />;
    case "Activity":
      return <IcoActivity className={className} />;
    case "Reports":
      return <IcoChart className={className} />;
    case "All apps":
      return <IcoGrid className={className} />;
    default:
      return <IcoHome className={className} />;
  }
}

function previewIconForPinned(label: string, className: string) {
  switch (label) {
    case "Accounting":
      return <IcoCalculator className={className} />;
    case "Expenses":
      return <IcoReceipt className={className} />;
    case "Sales":
      return <IcoInvoice className={className} />;
    case "Payroll":
      return <IcoDollar className={className} />;
    case "Time":
      return <IcoClock className={className} />;
    case "Employees":
      return <IcoUsers className={className} />;
    default:
      return <IcoGrid className={className} />;
  }
}

function workspaceDescription(groupId: string): string {
  switch (groupId) {
    case "dashboard":
      return "Return to the command center.";
    case "people":
      return "Manage employees, requests, deductions, and access.";
    case "time":
      return "Manage time entries, approvals, schedules, and announcements.";
    case "payroll":
      return "Manage pay periods, runs, paystubs, and government forms.";
    case "finance":
      return "Manage accounts, customers, invoices, bills, expenses, and deposits.";
    case "reports":
      return "View reports and audit history.";
    case "admin":
      return "Manage users, roles, settings, and system tools.";
    default:
      return "Open workspace tools.";
  }
}

function primaryPreviewDetails(item: NavItem): { description: string; links: NavItem[] } {
  switch (item.label) {
    case "Home":
      return { description: "View your business dashboard.", links: [{ label: "Open dashboard", href: "/dashboard" }] };
    case "Activity":
      return { description: "Review recent platform activity.", links: [{ label: "View activity", href: "/dashboard/audit" }] };
    case "Reports": {
      const reports = NAV_GROUPS.find((group) => group.id === "reports");
      return { description: "View payroll, finance, and audit reports.", links: reports?.items ?? [] };
    }
    case "All apps":
      return { description: "Open the full app launcher.", links: [] };
    default:
      return { description: item.description ?? `Open ${item.label}.`, links: [item] };
  }
}

function pinnedPreviewDetails(item: NavItem): { description: string; links: NavItem[] } {
  const itemByHref = (href: string, label?: string): NavItem => {
    const found = NAV_GROUPS.flatMap((group) => group.items).find((navItem) => navItem.href === href);
    return found ? { ...found, label: label ?? found.label } : { label: label ?? href, href };
  };
  switch (item.label) {
    case "Accounting":
      return {
        description: "Open accounting tools.",
        links: [itemByHref("/dashboard/finance/accounts"), itemByHref("/dashboard/reports", "Reports home"), { label: "Finance", href: "/dashboard/finance" }]
      };
    case "Expenses":
      return {
        description: "Track business expenses and bills.",
        links: [itemByHref("/dashboard/finance/expenses"), itemByHref("/dashboard/finance/bills"), itemByHref("/dashboard/finance/bill-payments")]
      };
    case "Sales":
      return {
        description: "Manage customer sales and invoices.",
        links: [itemByHref("/dashboard/finance/customers"), itemByHref("/dashboard/finance/products"), itemByHref("/dashboard/finance/invoices"), itemByHref("/dashboard/finance/payments")]
      };
    case "Payroll": {
      const payroll = NAV_GROUPS.find((group) => group.id === "payroll");
      return { description: "Run payroll and manage pay records.", links: payroll?.items ?? [item] };
    }
    case "Time":
      return {
        description: "Review time and approvals.",
        links: [itemByHref("/dashboard/time/entries"), itemByHref("/dashboard/time/approvals"), itemByHref("/dashboard/schedule")]
      };
    case "Employees":
      return {
        description: "Manage employee records.",
        links: [itemByHref("/dashboard/people/employees"), itemByHref("/dashboard/people/requests"), itemByHref("/dashboard/users")]
      };
    default:
      return { description: item.description ?? `Open ${item.label}.`, links: [item] };
  }
}

function previewAllAppsCategory(preview: SidebarPreview): string {
  if (preview.type === "workspace") {
    return preview.group.id;
  }
  if (preview.type === "primary") {
    switch (preview.item.label) {
      case "Reports":
        return "reports";
      case "Activity":
        return "admin";
      default:
        return "all";
    }
  }
  switch (preview.item.label) {
    case "Accounting":
    case "Expenses":
    case "Sales":
      return "finance";
    case "Payroll":
      return "payroll";
    case "Time":
      return "time";
    case "Employees":
      return "people";
    default:
      return "all";
  }
}

function SidebarHoverPreview({
  preview,
  onMouseEnter,
  onMouseLeave,
  onClose,
  onOpenAllApps
}: {
  preview: SidebarPreview | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
  onOpenAllApps: (category?: string) => void;
}) {
  if (!preview) {
    return null;
  }

  const isWorkspace = preview.type === "workspace";
  const title = isWorkspace ? preview.group.title : preview.item.label;
  const description = isWorkspace
    ? workspaceDescription(preview.group.id)
    : preview.type === "pinned"
      ? pinnedPreviewDetails(preview.item).description
      : primaryPreviewDetails(preview.item).description;
  const links = isWorkspace
    ? preview.group.items
    : preview.type === "pinned"
      ? pinnedPreviewDetails(preview.item).links
      : primaryPreviewDetails(preview.item).links;
  const colorKey = isWorkspace ? preview.group.id : preview.item.label;
  const color = preview.type === "primary" ? "#008C95" : launcherColor(colorKey);
  const visibleLinks = links.slice(0, 5);
  const hasMoreLinks = links.length > visibleLinks.length;
  const allAppsCategory = previewAllAppsCategory(preview);

  return (
    <aside
      className="fixed left-[220px] z-[60] hidden w-[min(248px,calc(100vw-236px))] rounded-xl border border-slate-200 bg-white p-2.5 shadow-xl ring-1 ring-slate-950/5 transition-all duration-[180ms] ease-out motion-reduce:transform-none motion-reduce:transition-none lg:block"
      style={{ top: preview.top, transform: "translateX(0) scale(1)" }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <span className="absolute -left-1.5 top-5 h-3 w-3 rotate-45 border-b border-l border-slate-200 bg-white" aria-hidden />
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: color }} aria-hidden>
          {preview.type === "workspace" ? (
            <LauncherGroupIcon groupId={preview.group.id} className="h-[18px] w-[18px]" />
          ) : preview.type === "pinned" ? (
            previewIconForPinned(preview.item.label, "h-[18px] w-[18px]")
          ) : (
            previewIconForPrimary(preview.item.label, "h-[18px] w-[18px]")
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-slate-950">{title}</h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">{description}</p>
        </div>
      </div>

      {preview.type === "primary" && preview.item.action === "all-apps" ? (
        <button
          type="button"
          onClick={() => {
            onOpenAllApps();
            onClose();
          }}
          className="mt-2 flex min-h-[30px] w-full items-center gap-2 rounded-lg border border-[#BDEBE7] bg-[#F8FCFC] px-2 py-1.5 text-xs font-bold text-[#073B4C] transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <IcoGrid className="h-3.5 w-3.5" />
          Open All Apps
        </button>
      ) : null}

      {visibleLinks.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-0.5">
          {visibleLinks.map((link) => (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              onClick={onClose}
              className="flex min-h-[30px] items-center gap-2 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-700 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] hover:text-[#073B4C] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#E6F5F3] text-[#008C95] ring-1 ring-[#BDEBE7]" aria-hidden>
                <WorkspaceChildGlyph href={link.href} />
              </span>
              <span className="min-w-0 flex-1 truncate">{link.label}</span>
            </Link>
          ))}
          {hasMoreLinks ? (
            <button
              type="button"
              onClick={() => {
                onOpenAllApps(allAppsCategory);
                onClose();
              }}
              className="mt-1 flex min-h-[30px] items-center gap-2 rounded-lg border border-[#D6EEF0] bg-[#F8FCFC] px-2 py-1 text-[11px] font-bold text-[#073B4C] transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <IcoGrid className="h-3.5 w-3.5" />
              More in All Apps
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function AllAppsPanel({
  open,
  category,
  onCategoryChange,
  onClose
}: {
  open: boolean;
  category: string;
  onCategoryChange: (value: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const groups = NAV_GROUPS;
  const selectedGroup = groups.find((group) => group.id === category) ?? groups.find((group) => group.id === "payroll") ?? groups[0];
  const pinnedItems = PINNED_SHORTCUTS;

  return (
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="All Apps launcher">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/5"
        aria-label="Close All Apps"
        onClick={onClose}
      />
      <div className="absolute inset-x-3 bottom-3 flex max-h-[calc(100vh-1.5rem)] flex-col gap-2 sm:bottom-auto sm:left-[224px] sm:right-auto sm:top-20 sm:max-h-[calc(100vh-6rem)] sm:w-[min(720px,calc(100vw-244px))] sm:flex-row sm:items-stretch">
        <section className="flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-6rem)] sm:w-[390px]">
          <div className="shrink-0 border-b border-slate-100 bg-[#F8FCFC] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-950">All Apps</h2>
                <p className="mt-0.5 text-xs text-slate-600">Open a workspace tool.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:bg-[#F1F8F8] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
              >
                Close
              </button>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-3">
            <p className="mb-2 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Workspaces</p>
            <div className="grid grid-cols-3 gap-1.5">
              {groups.map((group) => (
                <LauncherModuleButton
                  key={group.id}
                  group={group}
                  selected={selectedGroup?.id === group.id}
                  onSelect={() => onCategoryChange(group.id)}
                />
              ))}
            </div>

            <p className="mb-2 mt-4 text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Pinned</p>
            <div className="grid grid-cols-3 gap-1.5">
              {pinnedItems.map((item) => (
                <LauncherPinnedLink key={`${item.label}-${item.href}`} item={item} onClose={onClose} />
              ))}
            </div>

            {selectedGroup ? (
              <div className="mt-4 rounded-xl border border-[#D6EEF0] bg-[#F8FCFC] p-3 sm:hidden">
                <LauncherChildList group={selectedGroup} onClose={onClose} />
              </div>
            ) : null}
          </div>
        </section>

        {selectedGroup ? (
          <section className="hidden max-h-[calc(100vh-6rem)] w-[300px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:flex">
            <div className="min-h-0 p-3">
              <LauncherChildList group={selectedGroup} onClose={onClose} />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function launcherColor(idOrLabel: string): string {
  switch (idOrLabel) {
    case "dashboard":
      return "#0EA5E9";
    case "people":
      return "#009A78";
    case "time":
      return "#2563EB";
    case "payroll":
      return "#4F46E5";
    case "finance":
      return "#16A34A";
    case "reports":
      return "#334155";
    case "admin":
      return "#F97316";
    case "Accounting":
      return "#0F766E";
    case "Expenses":
      return "#DC2626";
    case "Sales":
      return "#0891B2";
    case "Employees":
      return "#7C3AED";
    default:
      return "#008C95";
  }
}

function LauncherGroupIcon({ groupId, className }: { groupId: string; className: string }) {
  switch (groupId) {
    case "dashboard":
      return <IcoLayoutDashboard className={className} />;
    case "people":
      return <IcoUsers className={className} />;
    case "time":
      return <IcoClock className={className} />;
    case "payroll":
      return <IcoDollar className={className} />;
    case "finance":
      return <IcoWallet className={className} />;
    case "reports":
      return <IcoChart className={className} />;
    case "admin":
      return <IcoShield className={className} />;
    default:
      return <IcoGrid className={className} />;
  }
}

function LauncherModuleButton({
  group,
  selected,
  onSelect
}: {
  group: NavGroup;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Open ${group.title} apps`}
      onClick={onSelect}
      className={[
        "group flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none",
        selected
          ? "border-[#BDEBE7] bg-[#F1F8F8] text-[#073B4C] shadow-sm"
          : "border-slate-200 bg-white text-slate-800 hover:border-[#D6EEF0] hover:bg-[#F1F8F8]"
      ].join(" ")}
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ backgroundColor: launcherColor(group.id) }}
        aria-hidden
      >
        <LauncherGroupIcon groupId={group.id} className="h-[18px] w-[18px]" />
      </span>
      <span className="text-[11px] font-bold leading-tight">{group.title}</span>
    </button>
  );
}

function LauncherPinnedLink({ item, onClose }: { item: NavItem; onClose: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className="group flex min-h-[68px] flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white p-2 text-center text-slate-800 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:border-[#D6EEF0] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-sm"
        style={{ backgroundColor: launcherColor(item.label) }}
        aria-hidden
      >
        {item.label === "Accounting" ? <IcoCalculator className="h-[18px] w-[18px]" /> : null}
        {item.label === "Expenses" ? <IcoReceipt className="h-[18px] w-[18px]" /> : null}
        {item.label === "Sales" ? <IcoInvoice className="h-[18px] w-[18px]" /> : null}
        {item.label === "Payroll" ? <IcoDollar className="h-[18px] w-[18px]" /> : null}
        {item.label === "Time" ? <IcoClock className="h-[18px] w-[18px]" /> : null}
        {item.label === "Employees" ? <IcoUsers className="h-[18px] w-[18px]" /> : null}
      </span>
      <span className="text-[11px] font-bold leading-tight">{item.label}</span>
    </Link>
  );
}

function LauncherChildList({ group, onClose }: { group: NavGroup; onClose: () => void }) {
  return (
    <div className="min-h-0">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: launcherColor(group.id) }}
          aria-hidden
        >
          <LauncherGroupIcon groupId={group.id} className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-950">{group.title}</h3>
          <p className="text-xs text-slate-500">Choose a tool</p>
        </div>
      </div>
      <div className="max-h-[48vh] space-y-1 overflow-y-auto pr-1 sm:max-h-[calc(80vh-86px)]">
        {group.items.map((item) => (
          <Link
            key={`${group.id}-${item.label}-${item.href}`}
            href={item.href}
            onClick={onClose}
            className="group flex min-h-[36px] items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-700 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] hover:text-[#073B4C] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F5F3] text-[#008C95] ring-1 ring-[#BDEBE7]" aria-hidden>
              <WorkspaceChildGlyph href={item.href} />
            </span>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
