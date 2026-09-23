"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * URL-synced list state for finance list pages
 * (Finance Navigation and Responsive Rebuild, 2026-09-23).
 *
 * `page`, `pageSize`, `q`, `sort`, and page-specific filters all live in the
 * query string so Back/Forward, refresh, and bookmarks work. Search input is
 * debounced (~300ms); changing search, sort, filters, or page size resets the
 * list to page 1.
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Matches the API's `pagination` response block (apps/api/src/lib/pagination.ts). */
export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const SEARCH_DEBOUNCE_MS = 300;

function parsePage(raw: string | null): number {
  const n = Number(raw ?? "");
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function parsePageSize(raw: string | null): PageSize {
  const n = Number(raw ?? "");
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as PageSize) : DEFAULT_PAGE_SIZE;
}

export type UseListQueryResult = {
  /** 1-based page from the URL. */
  page: number;
  pageSize: PageSize;
  /** Debounced search text from the URL ("" when absent). */
  q: string;
  /** Sort spec from the URL, e.g. "name" or "-createdAt" ("" = endpoint default). */
  sort: string;
  /** Current value of a page-specific filter param ("" when absent). */
  filter: (key: string) => string;
  /** Raw search box value (updates immediately, before debounce). */
  searchInput: string;
  setSearchInput: (value: string) => void;
  setPage: (page: number) => void;
  setPageSize: (size: PageSize) => void;
  /** Pass a sort spec such as "name" or "-createdAt"; resets to page 1. */
  setSort: (sort: string) => void;
  /** Set (or clear with "") a page-specific filter param; resets to page 1. */
  setFilter: (key: string, value: string) => void;
  /** Query string (leading "?") with page/pageSize/q/sort + filters applied. */
  queryString: string;
};

/**
 * @param filterKeys page-specific query params that should round-trip through
 * `filter()` / `setFilter()` and be included in `queryString` (e.g. ["status"]).
 */
export function useListQuery(filterKeys: readonly string[] = []): UseListQueryResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = parsePage(searchParams.get("page"));
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const q = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "";

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of filterKeys) {
      out[key] = searchParams.get(key) ?? "";
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, filterKeys.join("|")]);

  const update = useCallback(
    (patch: Record<string, string>, resetPage: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      if (resetPage) {
        params.delete("page");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Debounced search: the text box updates `searchInput` immediately, then
  // pushes the debounced value into `q` in the URL (resetting to page 1).
  const [searchInput, setSearchInput] = useState(q);
  const lastPushed = useRef(q);

  // Keep the box in sync when the URL changes externally (Back/Forward).
  useEffect(() => {
    if (q !== lastPushed.current) {
      lastPushed.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => {
      lastPushed.current = searchInput;
      update({ q: searchInput.trim() }, true);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput, q, update]);

  const filter = useCallback((key: string) => filters[key] ?? "", [filters]);

  const setPage = useCallback(
    (next: number) => {
      update({ page: next > 1 ? String(next) : "" }, false);
    },
    [update]
  );

  const setPageSize = useCallback(
    (size: PageSize) => {
      update({ pageSize: size === DEFAULT_PAGE_SIZE ? "" : String(size) }, true);
    },
    [update]
  );

  const setSort = useCallback(
    (value: string) => {
      update({ sort: value }, true);
    },
    [update]
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      update({ [key]: value }, true);
    },
    [update]
  );

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (q) params.set("q", q);
    if (sort) params.set("sort", sort);
    for (const key of filterKeys) {
      const value = filters[key] ?? "";
      if (value) params.set(key, value);
    }
    return `?${params.toString()}`;
  }, [page, pageSize, q, sort, filters, filterKeys]);

  return {
    page,
    pageSize,
    q,
    sort,
    filter,
    searchInput,
    setSearchInput,
    setPage,
    setPageSize,
    setSort,
    setFilter,
    queryString
  };
}

/** Builds a sort select value ("field" / "-field") from field + direction. */
export function sortSpec(field: string, dir: "asc" | "desc"): string {
  return dir === "desc" ? `-${field}` : field;
}

export type SortOption = { value: string; label: string };

/**
 * Compact, accessible sort control bound to useListQuery. Rendered as a
 * labelled native select so it works on touch and keyboard alike.
 */
export function sortSelectId(pageId: string): string {
  return `${pageId}-sort`;
}
