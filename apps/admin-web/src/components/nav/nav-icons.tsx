/** Inline SVG icon set for navigation — no icon dependency package. */

import type { ReactNode } from "react";

const stroke = 2.5;

export function Svg({ className, children }: { className?: string; children: ReactNode }) {
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

export function IcoHome({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </Svg>
  );
}

export function IcoActivity({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </Svg>
  );
}

export function IcoChart({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </Svg>
  );
}

export function IcoGrid({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </Svg>
  );
}

export function IcoReceipt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M16 8h-6" />
      <path d="M16 12h-6" />
      <path d="M10 16h6" />
    </Svg>
  );
}

export function IcoInvoice({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
    </Svg>
  );
}

export function IcoDollar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

export function IcoClock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

export function IcoUsers({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function IcoWallet({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4Z" />
    </Svg>
  );
}

export function IcoShield({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

export function IcoSettings({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0-2.73.73l-.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1 2 0l.43-.25a2 2 0 0 1 1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IcoPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </Svg>
  );
}

export function IcoInbox({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  );
}

export function IcoFile({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </Svg>
  );
}

export function IcoUserCheck({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <polyline points="16 11 18 13 22 9" />
    </Svg>
  );
}

export function IcoCalendar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </Svg>
  );
}

export function IcoMegaphone({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m3 11 18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </Svg>
  );
}

export function IcoPackage({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </Svg>
  );
}

export function IcoCreditCard({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </Svg>
  );
}

export function IcoArrowDownLeft({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="17" x2="7" y1="7" y2="17" />
      <polyline points="17 17 7 17 7 7" />
    </Svg>
  );
}

export function IcoBuilding({ className }: { className?: string }) {
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

export function IcoScroll({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h18" />
    </Svg>
  );
}

export function IcoCloudUpload({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 3.5 7.243" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </Svg>
  );
}

export function IcoChevron({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <polyline points="6 9 12 15 18 9" />
    </Svg>
  );
}

export function IcoMenu({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </Svg>
  );
}

export function IcoClose({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </Svg>
  );
}

export function IcoSearch({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" x2="16.65" y1="21" y2="16.65" />
    </Svg>
  );
}

export const iconSm = "h-[18px] w-[18px]";
export const iconXs = "h-3.5 w-3.5";

/** Framed icon slot used by sidebar rows. */
export function SidebarIconSlot({
  active,
  small,
  children
}: {
  active?: boolean;
  small?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-lg text-current transition-colors duration-[180ms] ease-out motion-reduce:transition-none",
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

/** Icon for a top-level workspace group. */
export function GroupGlyph({ groupId, active }: { groupId: string; active?: boolean }) {
  let inner: ReactNode;
  switch (groupId) {
    case "dashboard":
      inner = <IcoHome className={iconSm} />;
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
      inner = <IcoGrid className={iconSm} />;
  }
  return <SidebarIconSlot active={active} small>{inner}</SidebarIconSlot>;
}

/** Small icon for a workspace child link, keyed by href. */
export function ItemGlyph({ href }: { href: string }) {
  let inner: ReactNode;
  switch (href) {
    case "/dashboard":
      inner = <IcoHome className={iconXs} />;
      break;
    case "/dashboard/people/employees":
      inner = <IcoUsers className={iconXs} />;
      break;
    case "/dashboard/people/structure":
      inner = <IcoBuilding className={iconXs} />;
      break;
    case "/dashboard/people/requests":
      inner = <IcoInbox className={iconXs} />;
      break;
    case "/dashboard/people/templates":
      inner = <IcoFile className={iconXs} />;
      break;
    case "/dashboard/people/leave":
      inner = <IcoCalendar className={iconXs} />;
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
    case "/dashboard/payroll/paystubs/preview":
      inner = <IcoReceipt className={iconXs} />;
      break;
    case "/dashboard/payroll/forms":
      inner = <IcoFile className={iconXs} />;
      break;
    case "/dashboard/payroll/ytd-import":
      inner = <IcoCloudUpload className={iconXs} />;
      break;
    case "/dashboard/payroll/reports":
      inner = <IcoChart className={iconXs} />;
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
    case "/dashboard/imports/accounting":
    case "/dashboard/imports/migration":
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

/** Brand color for a workspace id — used by the All Apps launcher. */
export function launcherColor(groupId: string): string {
  switch (groupId) {
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
    default:
      return "#008C95";
  }
}

/** Colored group icon box used by the All Apps launcher. */
export function LauncherGroupIcon({ groupId, className }: { groupId: string; className: string }) {
  switch (groupId) {
    case "dashboard":
      return <IcoHome className={className} />;
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
