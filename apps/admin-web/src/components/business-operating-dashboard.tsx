"use client";

import { CREATE_ACTIONS } from "@/lib/dashboard-nav";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const sw = 2.5;

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {children}
    </svg>
  );
}

function DIcoUsers({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

function DIcoClock({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

function DIcoDollar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  );
}

function DIcoReceipt({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
      <path d="M14 8H8" />
      <path d="M16 12H8" />
      <path d="M13 16H8" />
    </Svg>
  );
}

function DIcoWallet({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h3v-4Z" />
    </Svg>
  );
}

function DIcoChart({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </Svg>
  );
}

function DIcoShield({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

function DIcoCalendar({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </Svg>
  );
}

function DIcoAlertTriangle({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

function DIcoCheckCircle({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </Svg>
  );
}

function DIcoHistory({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Svg>
  );
}

function DIcoUserPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </Svg>
  );
}

function DIcoClockPlus({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
      <line x1="18" x2="18" y1="2" y2="8" />
      <line x1="21" x2="15" y1="5" y2="5" />
    </Svg>
  );
}

function DIcoPlayCircle({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </Svg>
  );
}

function DIcoFileText({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" x2="8" y1="13" y2="13" />
      <line x1="16" x2="8" y1="17" y2="17" />
      <line x1="10" x2="8" y1="9" y2="9" />
    </Svg>
  );
}

function PillGlyph({ label }: { label: string }) {
  const g = "h-[17px] w-[17px] text-white";
  switch (label) {
    case "People":
      return <DIcoUsers className={g} />;
    case "Time":
      return <DIcoClock className={g} />;
    case "Payroll":
      return <DIcoDollar className={g} />;
    case "Paystubs":
      return <DIcoReceipt className={g} />;
    case "Finance":
      return <DIcoWallet className={g} />;
    case "Reports":
      return <DIcoChart className={g} />;
    case "Admin":
      return <DIcoShield className={g} />;
    default:
      return <DIcoChart className={g} />;
  }
}

function SummaryGlyph({ variant }: { variant: "next-payroll" | "employees" | "timesheets" | "draft-runs" }) {
  const g = "h-[22px] w-[22px] text-white";
  switch (variant) {
    case "next-payroll":
      return (
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#0EA5E9] shadow-sm">
          <DIcoCalendar className={g} />
        </span>
      );
    case "employees":
      return (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#059669] to-[#34D399] shadow-sm">
          <DIcoUsers className={g} />
        </span>
      );
    case "timesheets":
      return (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F97316] to-[#FB923C] shadow-sm">
          <DIcoClock className={g} />
        </span>
      );
    case "draft-runs":
      return (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] shadow-sm">
          <DIcoReceipt className={g} />
        </span>
      );
    default:
      return null;
  }
}

function quickCreateGlyph(href: string) {
  const ic = "h-4 w-4 shrink-0 text-[#063E4A]";
  switch (href) {
    case "/dashboard/people/employees/new":
      return <DIcoUserPlus className={ic} />;
    case "/dashboard/time/entries/new":
      return <DIcoClockPlus className={ic} />;
    case "/dashboard/time/approvals":
      return <DIcoCheckCircle className={ic} />;
    case "/dashboard/payroll/periods":
      return <DIcoCalendar className={ic} />;
    case "/dashboard/payroll/runs":
      return <DIcoPlayCircle className={ic} />;
    case "/dashboard/finance/invoices/new":
      return <DIcoFileText className={ic} />;
    case "/dashboard/finance/expenses/new":
      return <DIcoReceipt className={ic} />;
    default:
      return <DIcoFileText className={ic} />;
  }
}

function moreActionGlyph(href: string) {
  const ic = "h-4 w-4 shrink-0 text-[#063E4A]";
  if (href.includes("/users/new")) {
    return <DIcoUserPlus className={ic} />;
  }
  return quickCreateGlyph(href);
}

export type AuditDay = { dayKey: string; count: number };

type RecentRun = {
  id: string;
  status: string;
  itemCount: number;
  summary: { gross: number; totalDeductions: number; net: number; employerCost: number };
  period: { label: string; schedule: string; payDate: string | null };
};

export type BusinessOverviewData = {
  activeEmployees: number | null;
  employeesError: string | null;
  submittedTime: number | null;
  timeError: string | null;
  draftRuns: number | null;
  payrollError: string | null;
  payrollSummary: {
    gross: number;
    deductions: number;
    net: number;
    employerCost: number | null;
    sourceLabel: string;
  } | null;
  recentRuns: RecentRun[];
  invoiceCount: number | null;
  financeError: string | null;
  billsCount: number | null;
  billsError: string | null;
  pendingInvites: number | null;
  invitedUsers: number | null;
  usersAccess: "ok" | "forbidden" | "error";
  auditPreview: { action: string; createdAt: string; actorLabel: string } | null;
  auditError: string | null;
  auditByDay: AuditDay[];
  periodCount: number | null;
  latestPeriod: { label: string; payDate: string | null; endDate: string } | null;
  nextPayroll: { label: string; payDate: string } | null;
  periodsError: string | null;
  statutoryReady: boolean | null;
  statutoryError: string | null;
};

const modulePills = [
  { label: "People", href: "/dashboard/people/employees", badgeClass: "bg-[#009A78]" },
  { label: "Time", href: "/dashboard/time/entries", badgeClass: "bg-[#2563EB]" },
  { label: "Payroll", href: "/dashboard/payroll/runs", badgeClass: "bg-[#4F46E5]" },
  { label: "Paystubs", href: "/dashboard/payroll/runs", badgeClass: "bg-[#0891B2]" },
  { label: "Finance", href: "/dashboard/finance", badgeClass: "bg-[#16A34A]" },
  { label: "Reports", href: "/dashboard/reports", badgeClass: "bg-[#334155]" },
  { label: "Admin", href: "/dashboard/users", badgeClass: "bg-[#F97316]" }
];

const quickActions = [
  { label: "Add employee", href: "/dashboard/people/employees/new" },
  { label: "Add time entry", href: "/dashboard/time/entries/new" },
  { label: "Approve time", href: "/dashboard/time/approvals" },
  { label: "Create pay period", href: "/dashboard/payroll/periods" },
  { label: "Run payroll", href: "/dashboard/payroll/runs" },
  { label: "Create invoice", href: "/dashboard/finance/invoices/new" },
  { label: "Record expense", href: "/dashboard/finance/expenses/new" }
];

const cardClass = "rounded-[1.25rem] border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/70";
const primaryActionClass =
  "inline-flex items-center rounded-xl border border-[#BDEBE7] bg-[#E6F5F3] px-4 py-3 text-sm font-semibold text-[#063E4A] shadow-sm transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none";
const secondaryActionClass =
  "inline-flex items-center rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:border-[#D6EEF0] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function friendlyAdminName(name: string, email: string): string {
  const trimmedName = name.trim();
  const lowerName = trimmedName.toLowerCase();
  const genericAdminNames = new Set(["platform", "platform admin", "platform owner"]);

  if (trimmedName && !genericAdminNames.has(lowerName)) {
    return trimmedName.split(/\s+/)[0] ?? trimmedName;
  }

  const emailName = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  if (emailName && !genericAdminNames.has(emailName.toLowerCase()) && emailName.toLowerCase() !== "admin") {
    return emailName
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return "Admin";
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "Needs date";
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "Needs date";
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatMoney(value: number | null | undefined): string {
  return `$${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status: string): string {
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown";
}

function StatusBadge({ tone, children }: { tone: "green" | "blue" | "amber" | "red" | "slate"; children: ReactNode }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
    amber: "bg-amber-50 text-amber-900 ring-amber-200",
    red: "bg-rose-50 text-rose-800 ring-rose-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[tone]}`}>
      {children}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  href,
  cta,
  summaryVariant,
  badgeTone,
  badge
}: {
  label: string;
  value: string | number;
  helper: string;
  href: string;
  cta: string;
  summaryVariant: "next-payroll" | "employees" | "timesheets" | "draft-runs";
  badgeTone: "green" | "blue" | "amber" | "red" | "slate";
  badge: string;
}) {
  return (
    <Link
      href={href}
      className={`${cardClass} group block transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:border-[#BDEBE7] hover:shadow-lg active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none`}
    >
      <div className="flex items-start justify-between gap-3">
        <SummaryGlyph variant={summaryVariant} />
        <StatusBadge tone={badgeTone}>{badge}</StatusBadge>
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-600">{helper}</p>
      <span className="mt-4 inline-flex text-sm font-semibold text-brand group-hover:underline">{cta}</span>
    </Link>
  );
}

function readinessGlyph(label: string) {
  const ic = "h-5 w-5 shrink-0 text-[#063E4A]";
  switch (label) {
    case "People ready":
      return <DIcoUsers className={ic} />;
    case "Timesheets approved":
      return <DIcoClock className={ic} />;
    case "Pay period created":
      return <DIcoCalendar className={ic} />;
    case "Pay date set":
      return <DIcoDollar className={ic} />;
    case "Payroll settings verified":
      return <DIcoShield className={ic} />;
    default:
      return <DIcoCheckCircle className={ic} />;
  }
}

function ProgressLine({ label, ok, href }: { label: string; ok: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white p-3 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:border-[#BDEBE7] hover:bg-[#F1F8F8] hover:shadow-sm active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">{readinessGlyph(label)}</span>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
        </span>
        <StatusBadge tone={ok ? "green" : "amber"}>{ok ? "Ready" : "Review"}</StatusBadge>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${ok ? "w-full bg-emerald-500" : "w-1/3 bg-amber-500"}`} />
      </div>
    </Link>
  );
}

function EmptyState({
  title,
  body,
  href,
  action,
  iconPositive
}: {
  title: string;
  body: string;
  href: string;
  action: string;
  iconPositive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      {iconPositive ? (
        <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <DIcoCheckCircle className="h-6 w-6" />
        </span>
      ) : null}
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
      <Link href={href} className="mt-3 inline-flex text-sm font-semibold text-brand transition-transform duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:underline active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
        {action}
      </Link>
    </div>
  );
}

export function BusinessOperatingDashboard({
  data,
  userRoles,
  userName,
  userEmail
}: {
  data: BusinessOverviewData;
  userRoles: string[];
  userName: string;
  userEmail: string;
}) {
  const createItems = CREATE_ACTIONS.filter((a) => !a.roles || a.roles.some((r) => userRoles.includes(r)));
  // Greeting depends on the viewer's local hour — compute after mount to avoid a hydration mismatch.
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);
  const pendingTimesheets = data.submittedTime ?? 0;
  const activeEmployees = data.activeEmployees ?? 0;
  const draftRuns = data.draftRuns ?? 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasCurrentPayPeriod = Boolean(
    data.latestPeriod && new Date(data.latestPeriod.endDate).getTime() >= today.getTime()
  );
  const hasPayDate = hasCurrentPayPeriod && Boolean(data.latestPeriod?.payDate);
  const peopleReady = !data.employeesError && activeEmployees > 0;
  const timeReady = !data.timeError && pendingTimesheets === 0;
  const periodReady = !data.periodsError && hasCurrentPayPeriod;
  const payDateReady = !data.periodsError && hasPayDate;
  const settingsReady = !data.statutoryError && data.statutoryReady === true;
  const readiness = [peopleReady, timeReady, periodReady, payDateReady, settingsReady];
  const readinessPercent = Math.round((readiness.filter(Boolean).length / readiness.length) * 100);
  const summary = data.payrollSummary;
  const nextPayrollText = data.nextPayroll
    ? `${data.nextPayroll.label} - ${formatDate(data.nextPayroll.payDate)}`
    : data.latestPeriod?.payDate
      ? `${data.latestPeriod.label} - ${formatDate(data.latestPeriod.payDate)} (past period)`
      : data.latestPeriod
        ? `${data.latestPeriod.label} - pay date not set`
      : "No payroll period has been created yet.";

  const alerts = [
    !payDateReady
      ? { title: "Pay date not set", body: "Set a pay date before finalizing the next payroll run.", href: "/dashboard/payroll/periods", tone: "red" as const }
      : null,
    !peopleReady
      ? { title: "Employee setup needs review", body: data.employeesError ?? "Add or activate employees before running payroll.", href: "/dashboard/people/employees", tone: "amber" as const }
      : null,
    !timeReady
      ? {
          title: "Pending approvals",
          body: data.timeError ?? `${pendingTimesheets} submitted time ${pendingTimesheets === 1 ? "entry needs" : "entries need"} review.`,
          href: "/dashboard/time/approvals",
          tone: "amber" as const
        }
      : null,
    !periodReady
      ? { title: "Current pay period missing", body: data.periodsError ?? "Create the next pay period to anchor payroll dates.", href: "/dashboard/payroll/periods", tone: "amber" as const }
      : null,
    !settingsReady
      ? { title: "Payroll settings need review", body: data.statutoryError ?? "Complete company and statutory settings before finalizing payroll.", href: "/dashboard/settings", tone: "red" as const }
      : null
  ].filter(Boolean) as { title: string; body: string; href: string; tone: "amber" | "red" }[];

  return (
    <div className="w-full max-w-none space-y-7 rounded-[1.75rem] bg-[#F8FAFC] pb-8 lg:pb-10">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-sm">
        <div className="relative p-6 sm:p-8">
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 w-full flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Payroll Plus HRM</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {greeting}, {friendlyAdminName(userName, userEmail)}!
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Your payroll, HR, time, and finance workspace is ready.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <Link href="/dashboard/payroll/runs" className={primaryActionClass}>
                Run payroll
              </Link>
              <Link href="/dashboard/time/approvals" className={secondaryActionClass}>
                Review time
              </Link>
              <Link href="/dashboard/settings" className={secondaryActionClass}>
                Customize
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Module navigation" className="flex flex-wrap gap-3">
        {modulePills.map((module) => (
          <Link
            key={module.label}
            href={module.href}
            className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:border-[#D6EEF0] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
          >
            <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-black/5 ${module.badgeClass}`}>
              <PillGlyph label={module.label} />
            </span>
            {module.label}
          </Link>
        ))}
      </section>

      <section aria-label="Create actions" className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-500">Quick create</span>
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:bg-[#F1F8F8] hover:text-[#073B4C] hover:shadow-sm hover:ring-[#D6EEF0] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
            >
              {quickCreateGlyph(action.href)}
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Business at a glance</h2>
            <p className="mt-1 text-sm text-slate-600">Live operational signals from payroll, people, time, and finance.</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-5">
          <SummaryCard
            label="Next Payroll"
            value={data.nextPayroll ? formatDate(data.nextPayroll.payDate) : data.latestPeriod ? "Needs date" : "-"}
            helper={nextPayrollText}
            href="/dashboard/payroll/periods"
            cta="Open pay periods"
            summaryVariant="next-payroll"
            badgeTone={payDateReady ? "blue" : "amber"}
            badge={payDateReady ? "Scheduled" : "Needs date"}
          />
          <SummaryCard
            label="Active Employees"
            value={data.activeEmployees ?? "-"}
            helper={data.employeesError ?? "Employees active and available for payroll."}
            href="/dashboard/people/employees"
            cta="Manage employees"
            summaryVariant="employees"
            badgeTone={peopleReady ? "green" : "amber"}
            badge={peopleReady ? "Ready" : "Review"}
          />
          <SummaryCard
            label="Pending Timesheets"
            value={data.submittedTime ?? "-"}
            helper={data.timeError ?? "Submitted time entries waiting for approval."}
            href="/dashboard/time/approvals"
            cta="Review approvals"
            summaryVariant="timesheets"
            badgeTone={timeReady ? "green" : "amber"}
            badge={timeReady ? "Clear" : "Pending"}
          />
          <SummaryCard
            label="Draft Pay Runs"
            value={data.draftRuns ?? "-"}
            helper={data.payrollError ?? "Payroll runs still in draft status."}
            href="/dashboard/payroll/runs"
            cta="View pay runs"
            summaryVariant="draft-runs"
            badgeTone={draftRuns > 0 ? "amber" : "blue"}
            badge={draftRuns > 0 ? "Draft" : "Current"}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <article className={`${cardClass} xl:col-span-2`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Payroll Readiness</h2>
              <p className="mt-1 text-sm text-slate-600">Checklist for a clean payroll run.</p>
            </div>
            <div className="min-w-40">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>{readinessPercent}% ready</span>
                <span>{readiness.filter(Boolean).length}/5</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" style={{ width: `${readinessPercent}%` }} />
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ProgressLine label="People ready" ok={peopleReady} href="/dashboard/people/employees" />
            <ProgressLine label="Timesheets approved" ok={timeReady} href="/dashboard/time/approvals" />
            <ProgressLine label="Pay period created" ok={periodReady} href="/dashboard/payroll/periods" />
            <ProgressLine label="Pay date set" ok={payDateReady} href="/dashboard/payroll/periods" />
            <ProgressLine label="Payroll settings verified" ok={settingsReady} href="/dashboard/settings" />
          </div>
        </article>

        <article className={cardClass}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#008C95] to-[#007C89] shadow-sm">
                <DIcoDollar className="h-6 w-6 text-white" />
              </span>
              <span>
                <h2 className="text-xl font-semibold text-slate-950">Payroll Summary</h2>
                <p className="mt-1 text-sm text-slate-600">{summary?.sourceLabel ?? "Latest run values"}</p>
              </span>
            </span>
            <StatusBadge tone="blue">Estimate</StatusBadge>
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Gross pay", formatMoney(summary?.gross)],
              ["Deductions", formatMoney(summary?.deductions)],
              ["Net pay", formatMoney(summary?.net)],
              ["Employer cost", formatMoney(summary?.employerCost)]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>
          <Link href="/dashboard/payroll/runs" className="mt-5 inline-flex rounded-xl border border-[#BDEBE7] bg-[#E6F5F3] px-4 py-2.5 text-sm font-semibold text-[#063E4A] transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.01] hover:bg-[#F1F8F8] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
            Run payroll
          </Link>
        </article>

        <article className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-950">Needs Attention</h2>
          <div className="mt-4 space-y-3">
            {alerts.length > 0 ? (
              alerts.slice(0, 4).map((alert) => (
                <Link
                  key={alert.title}
                  href={alert.href}
                  className={`block rounded-2xl border px-4 py-3 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:shadow-md active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none ${
                    alert.tone === "red"
                      ? "border-rose-200 bg-rose-50 text-rose-950 hover:bg-rose-100"
                      : "border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${
                        alert.tone === "red"
                          ? "bg-gradient-to-br from-rose-500 to-red-600 text-white"
                          : "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                      }`}
                      aria-hidden
                    >
                      <DIcoAlertTriangle className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{alert.title}</p>
                      <p className="mt-1 text-xs leading-relaxed opacity-85">{alert.body}</p>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No urgent alerts"
                body="Payroll, employee records, and timesheet queue are not reporting urgent issues."
                href="/dashboard/time/approvals"
                action="Check approvals"
                iconPositive
              />
            )}
          </div>
        </article>

        <article className={cardClass}>
          <h2 className="text-xl font-semibold text-slate-950">Recent Activity</h2>
          {data.auditError ? (
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.auditError}</p>
          ) : data.auditPreview ? (
            <div className="mt-4 flex gap-3 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-sm">
                <DIcoHistory className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{data.auditPreview.action}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {data.auditPreview.actorLabel} - {new Date(data.auditPreview.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No recent activity"
              body="Activity appears here after users sign in or make changes."
              href="/dashboard/audit"
              action="Open activity log"
            />
          )}
          <Link href="/dashboard/audit" className="mt-5 inline-flex text-sm font-semibold text-brand transition-transform duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:underline active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
            View activity log
          </Link>
        </article>

        <article className={cardClass}>
          <div className="flex flex-wrap items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm">
              <DIcoWallet className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold text-slate-950">Finance Snapshot</h2>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
              <p className="text-3xl font-semibold text-emerald-950">{data.invoiceCount ?? "-"}</p>
              <p className="mt-1 text-sm text-emerald-800">Invoices</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4 ring-1 ring-sky-100">
              <p className="text-3xl font-semibold text-sky-950">{data.billsCount ?? "-"}</p>
              <p className="mt-1 text-sm text-sky-800">Bills</p>
            </div>
          </div>
          {(data.financeError || data.billsError) ? (
            <p className="mt-3 text-sm text-amber-800">{data.financeError ?? data.billsError}</p>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Use finance screens for invoices, bills, expenses, deposits, and reports.</p>
          )}
          <Link href="/dashboard/finance" className="mt-5 inline-flex text-sm font-semibold text-brand transition-transform duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:underline active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
            Open finance
          </Link>
        </article>

        <article className={`${cardClass} xl:col-span-3`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">Recent Payroll Runs</h2>
              <p className="mt-1 text-sm text-slate-600">Latest runs with status, employees, and net pay.</p>
            </div>
            <Link href="/dashboard/payroll/runs" className="text-sm font-semibold text-brand transition-transform duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:underline active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
              View all runs
            </Link>
          </div>
          {data.recentRuns.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="No payroll runs yet"
                body="No payroll runs yet. Start your first payroll when timesheets are ready."
                href="/dashboard/payroll/runs"
                action="Open pay runs"
              />
            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
              <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr_0.5fr] bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>Period</span>
                <span>Status</span>
                <span>Employees</span>
                <span>Net pay</span>
                <span>Action</span>
              </div>
              <div className="divide-y divide-slate-200">
                {data.recentRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr_0.5fr] md:items-center">
                    <div>
                      <p className="font-semibold text-slate-950">{run.period.label}</p>
                      <p className="text-xs capitalize text-slate-500">{run.period.schedule} - {formatDate(run.period.payDate)}</p>
                    </div>
                    <StatusBadge tone={run.status === "paid" ? "green" : run.status === "draft" ? "amber" : "blue"}>
                      {statusLabel(run.status)}
                    </StatusBadge>
                    <p className="font-medium text-slate-800">{run.itemCount}</p>
                    <p className="font-semibold text-slate-950">{formatMoney(run.summary.net)}</p>
                    <Link href={`/dashboard/payroll/runs/${run.id}`} className="font-semibold text-brand transition-transform duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:underline active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none">
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-500">More actions</span>
          {createItems.slice(0, 8).map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition-all duration-[180ms] ease-out hover:-translate-y-px hover:scale-[1.015] hover:bg-[#F1F8F8] hover:text-[#073B4C] hover:shadow-sm hover:ring-[#D6EEF0] active:scale-[0.985] motion-reduce:transform-none motion-reduce:transition-none"
            >
              {moreActionGlyph(a.href)}
              {a.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
