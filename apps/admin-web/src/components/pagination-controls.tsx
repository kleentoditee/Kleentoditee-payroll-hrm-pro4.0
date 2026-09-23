"use client";

import { PAGE_SIZE_OPTIONS, type PageSize } from "@/lib/use-list-query";

/**
 * Shared pagination bar for finance list pages
 * (Finance Navigation and Responsive Rebuild, 2026-09-23).
 *
 * Renders Previous/Next, the total result count, the current range
 * ("26–50 of 137"), a page-size selector (25/50/100), plus loading and
 * recoverable error states. Empty states stay with the page so each list can
 * keep its contextual guidance; hide this bar with `total === 0 && !loading`.
 * All controls are keyboard accessible with >=44px touch targets.
 */

export type PaginationControlsProps = {
  page: number;
  pageSize: PageSize;
  /** Total matching records across all pages. */
  total: number;
  loading?: boolean;
  /** Recoverable load error; shows the message plus a Retry button. */
  error?: string | null;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  /** Record noun for accessible labels, e.g. "customers". */
  noun?: string;
};

const CONTROL_CLASS =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-[#063E4A] outline-none ring-[#006D77] hover:bg-[#EAF6F7] focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white";

export function PaginationControls({
  page,
  pageSize,
  total,
  loading = false,
  error = null,
  onRetry,
  onPageChange,
  onPageSizeChange,
  noun = "records"
}: PaginationControlsProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
      >
        <p className="text-sm text-red-800">{error}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-800 outline-none ring-[#006D77] hover:bg-red-100 focus-visible:ring-2"
          >
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      aria-label={`${noun} pagination`}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <p aria-live="polite" className="text-sm text-slate-600">
        {loading ? (
          `Loading ${noun}…`
        ) : total === 0 ? (
          `No ${noun} found`
        ) : (
          <>
            <span className="font-semibold text-slate-900">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{total}</span> {noun}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label={`Previous page of ${noun}`}
          disabled={loading || !canPrev}
          onClick={() => onPageChange(page - 1)}
          className={CONTROL_CLASS}
        >
          Previous
        </button>
        <span className="px-1 text-sm text-slate-600" aria-hidden="true">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          aria-label={`Next page of ${noun}`}
          disabled={loading || !canNext}
          onClick={() => onPageChange(page + 1)}
          className={CONTROL_CLASS}
        >
          Next
        </button>
        <label className="ml-0 flex items-center gap-2 text-sm text-slate-600 sm:ml-2">
          Rows per page
          <select
            value={pageSize}
            disabled={loading}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none ring-[#006D77] focus-visible:ring-2 disabled:opacity-50"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </nav>
  );
}

/**
 * Compact labelled sort control for finance list pages. Options use the
 * endpoint's sort spec format: "field" ascending, "-field" descending.
 */
export function SortSelect({
  id,
  value,
  options,
  onChange
}: {
  id: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-slate-600">
      Sort by
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800 outline-none ring-[#006D77] focus-visible:ring-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
