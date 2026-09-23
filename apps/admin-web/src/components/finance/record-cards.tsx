import type { ReactNode } from "react";

/**
 * Shared responsive record-card pattern for finance detail and creation pages.
 * On phones (< md) wide tables become stacked record cards; from md up the
 * table renders inside a bounded horizontal scroll region so the page itself
 * never scrolls sideways.
 */

/** Phone-only list of record cards. Hidden from md up, where the table takes over. */
export function RecordCardList({ children }: { children: ReactNode }) {
  return <div className="space-y-3 p-3 md:hidden">{children}</div>;
}

/** A single record card with deliberate wrapping for long labels and values. */
export function RecordCard({ children }: { children: ReactNode }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 p-4">{children}</article>
  );
}

/** Label/value rows inside a record card. */
export function RecordCardFields({ children }: { children: ReactNode }) {
  return <dl className="mt-3 grid gap-2 text-sm">{children}</dl>;
}

export function RecordCardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-slate-900">{children}</dd>
    </div>
  );
}

/** Phone-only totals summary paired with the desktop table's tfoot. */
export function RecordCardTotals({
  items
}: {
  items: Array<{ label: string; value: ReactNode; strong?: boolean }>;
}) {
  return (
    <dl className="space-y-2 border-t border-slate-200 p-4 text-sm md:hidden">
      {items.map((item) => (
        <div key={item.label} className="flex justify-between gap-3">
          <dt className={item.strong ? "font-semibold text-slate-700" : "text-slate-600"}>
            {item.label}
          </dt>
          <dd
            className={
              item.strong ? "font-bold text-slate-950" : "font-semibold text-slate-900"
            }
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Desktop/tablet table region: bounded horizontal scroll inside the card,
 * hidden on phones where record cards take over.
 */
export function BoundedTable({ children }: { children: ReactNode }) {
  return <div className="hidden overflow-x-auto md:block">{children}</div>;
}
