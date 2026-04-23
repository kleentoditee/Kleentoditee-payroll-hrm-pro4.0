import Link from "next/link";

const RAIL = [
  { id: "create", label: "Create" },
  { id: "bookmarks", label: "Bookmarks" },
  { id: "home", label: "Home", href: "/dashboard" },
  { id: "feed", label: "Feed" },
  { id: "reports", label: "Reports" },
  { id: "apps", label: "All apps" },
  { id: "customize", label: "Customize" }
] as const;

const PINNED: { label: string; href?: string }[] = [
  { label: "People", href: "/dashboard/people/employees" },
  { label: "Payroll" },
  { label: "Time", href: "/dashboard/time/entries" },
  { label: "Finance" },
  { label: "Hiring" },
  { label: "Reports" }
];

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
  return (
    <div className="flex min-h-screen">
      <aside
        className="flex w-[6rem] shrink-0 flex-col items-center gap-2 bg-brand px-2 py-5 text-[0.82rem] text-white/95 md:w-[6.75rem]"
        aria-label="Primary navigation"
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-base font-bold tracking-tight md:h-14 md:w-14 md:text-lg">
          KT
        </div>
        {RAIL.map((item) =>
          "href" in item && item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className="flex w-full flex-col items-center rounded-xl px-2 py-3 text-center leading-snug hover:bg-white/10"
            >
              <span className="font-semibold">{item.label}</span>
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col items-center rounded-xl px-2 py-3 text-center leading-snug hover:bg-white/10"
            >
              <span className="font-semibold">{item.label}</span>
            </button>
          )
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white px-6 py-4 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Admin console
              </p>
              <h1 className="font-serif text-2xl font-semibold text-slate-900">KleenToDiTee Platform</h1>
              {userName ? (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{userName}</span>
                  {userEmail ? <span className="text-slate-500"> · {userEmail}</span> : null}
                  {userRoles?.length ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Roles: {userRoles.join(", ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-3 md:max-w-2xl">
              <label className="sr-only" htmlFor="global-search">
                Search
              </label>
              <input
                id="global-search"
                type="search"
                placeholder="Search employees, payroll, transactions…"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-base outline-none ring-brand focus:ring-2"
                disabled
                title="Global search — wired in a later phase"
              />
              <div className="flex flex-wrap items-center gap-3">
                {PINNED.map((app) =>
                  app.href ? (
                    <Link
                      key={app.label}
                      href={app.href}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand"
                    >
                      {app.label}
                    </Link>
                  ) : (
                    <span
                      key={app.label}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600"
                    >
                      {app.label}
                    </span>
                  )
                )}
                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="ml-auto rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
