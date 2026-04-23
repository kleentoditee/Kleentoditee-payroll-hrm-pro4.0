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
        className="flex w-[4.25rem] shrink-0 flex-col items-center gap-1 bg-brand py-4 text-[0.65rem] text-white/90"
        aria-label="Primary navigation"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold tracking-tight">
          KT
        </div>
        {RAIL.map((item) =>
          "href" in item && item.href ? (
            <Link
              key={item.id}
              href={item.href}
              className="flex w-full flex-col items-center px-1 py-2 text-center leading-tight hover:bg-white/10"
            >
              <span className="font-medium">{item.label}</span>
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              className="flex w-full flex-col items-center px-1 py-2 text-center leading-tight hover:bg-white/10"
            >
              <span className="font-medium">{item.label}</span>
            </button>
          )
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white px-6 py-3 shadow-sm">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Admin console
              </p>
              <h1 className="font-serif text-xl font-semibold text-slate-900">KleenToDiTee Platform</h1>
              {userName ? (
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium text-slate-800">{userName}</span>
                  {userEmail ? <span className="text-slate-500"> · {userEmail}</span> : null}
                  {userRoles?.length ? (
                    <span className="mt-0.5 block text-[0.7rem] text-slate-500">
                      Roles: {userRoles.join(", ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-2 md:max-w-xl">
              <label className="sr-only" htmlFor="global-search">
                Search
              </label>
              <input
                id="global-search"
                type="search"
                placeholder="Search employees, payroll, transactions…"
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none ring-brand focus:ring-2"
                disabled
                title="Global search — wired in a later phase"
              />
              <div className="flex flex-wrap items-center gap-2">
                {PINNED.map((app) =>
                  app.href ? (
                    <Link
                      key={app.label}
                      href={app.href}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
                    >
                      {app.label}
                    </Link>
                  ) : (
                    <span
                      key={app.label}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                    >
                      {app.label}
                    </span>
                  )
                )}
                {onLogout ? (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
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
