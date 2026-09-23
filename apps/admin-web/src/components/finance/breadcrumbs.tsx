import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

/**
 * Finance breadcrumb trail, e.g. Finance / Sales / Invoices.
 * The last item is the current context and renders as plain text.
 */
export function FinanceBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-x-1.5">
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 text-slate-300">
                  /
                </span>
              ) : null}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={`truncate ${isLast ? "font-medium text-slate-900" : "text-slate-600"}`}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="truncate rounded text-slate-500 underline-offset-2 hover:text-slate-900 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
