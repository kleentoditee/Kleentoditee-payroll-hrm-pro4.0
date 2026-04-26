import Link from "next/link";

export function ComingSoonPage({
  title,
  description,
  breadcrumbs
}: {
  title: string;
  description: string;
  breadcrumbs?: { label: string; href: string }[];
}) {
  return (
    <div className="space-y-6">
      {breadcrumbs?.length ? (
        <nav className="text-sm text-slate-600">
          {breadcrumbs.map((b, i) => (
            <span key={b.href}>
              {i > 0 ? <span className="mx-1.5 text-slate-400">/</span> : null}
              <Link href={b.href} className="font-medium text-brand hover:underline">
                {b.label}
              </Link>
            </span>
          ))}
        </nav>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">Coming soon</p>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">{description}</p>
        <p className="mt-6">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-brand hover:underline"
          >
            ← Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
