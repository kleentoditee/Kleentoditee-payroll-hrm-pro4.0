/**
 * Shared server-side pagination / search / sort parsing for finance list
 * endpoints (Finance Navigation and Responsive Rebuild, 2026-09-23).
 *
 * Contract:
 * - Callers that pass NO `page`/`pageSize` query params get the legacy
 *   unpaginated response (`paginated: false`) so existing UIs keep working.
 * - When either param is present, endpoints return
 *   `{ items, pagination: { page, pageSize, total, totalPages } }`.
 * - `page` is 1-based; `pageSize` is restricted to 25/50/100 (default 25).
 * - `sort` is a whitelisted field name, optionally prefixed with `-` for
 *   descending (or a companion `sortDir=asc|desc`). Unknown fields are
 *   rejected so raw client input can never reach Prisma orderBy keys.
 * - Every orderBy gets an `id` tiebreaker appended so pagination is
 *   deterministic: pages never duplicate or skip records.
 *
 * This module is pure (no Prisma, no Hono) so it is fully unit-testable.
 */

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 25;

export type SortDirection = "asc" | "desc";
/** Flat scalar orderBy clause, e.g. `{ issueDate: "desc" }`. */
export type OrderByClause = Record<string, SortDirection>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Reads one query-string value; matches Hono's `c.req.query(key)` shape. */
export type QueryGetter = (key: string) => string | undefined;

export type ParsedListQuery =
  | {
      ok: true;
      paginated: false;
      /** Trimmed search text with the user's casing preserved ("" when absent). */
      q: string;
      orderBy: OrderByClause[];
    }
  | {
      ok: true;
      paginated: true;
      q: string;
      orderBy: OrderByClause[];
      page: number;
      pageSize: PageSize;
      skip: number;
      take: number;
    }
  | { ok: false; error: string };

export interface ListQueryOptions {
  /** Scalar model fields the endpoint allows as `sort` keys. */
  sortable?: readonly string[];
  /** Endpoint's existing default ordering (used when no `sort` param). */
  defaultSort: OrderByClause[];
}

/** Prisma string filter used by finance search predicates. */
export function caseInsensitiveContains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

function parsePage(raw: string | undefined): { ok: true; page: number } | { ok: false; error: string } {
  if (raw === undefined || raw.trim() === "") return { ok: true, page: 1 };
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) {
    return { ok: false, error: "page must be a positive integer (1-based)." };
  }
  return { ok: true, page };
}

function parsePageSize(raw: string | undefined): { ok: true; pageSize: PageSize } | { ok: false; error: string } {
  if (raw === undefined || raw.trim() === "") return { ok: true, pageSize: DEFAULT_PAGE_SIZE };
  const size = Number(raw);
  if (!Number.isInteger(size) || !(PAGE_SIZE_OPTIONS as readonly number[]).includes(size)) {
    return { ok: false, error: `pageSize must be one of ${PAGE_SIZE_OPTIONS.join(", ")}.` };
  }
  return { ok: true, pageSize: size as PageSize };
}

/**
 * Appends an `id` tiebreaker unless already present, guaranteeing a total
 * order even when the sortable column contains duplicate values.
 */
export function withIdTiebreaker(orderBy: OrderByClause[]): OrderByClause[] {
  if (orderBy.some((clause) => Object.keys(clause).includes("id"))) {
    return orderBy;
  }
  return [...orderBy, { id: "asc" }];
}

function parseSort(
  sortRaw: string | undefined,
  sortDirRaw: string | undefined,
  sortable: readonly string[] | undefined,
  defaultSort: OrderByClause[]
): { ok: true; orderBy: OrderByClause[] } | { ok: false; error: string } {
  const sort = (sortRaw ?? "").trim();
  if (!sort) {
    return { ok: true, orderBy: withIdTiebreaker(defaultSort.map((c) => ({ ...c }))) };
  }
  let field = sort;
  let dir: SortDirection = "asc";
  if (sort.startsWith("-")) {
    field = sort.slice(1);
    dir = "desc";
  } else if (sortDirRaw !== undefined && sortDirRaw.trim() !== "") {
    const d = sortDirRaw.trim().toLowerCase();
    if (d !== "asc" && d !== "desc") {
      return { ok: false, error: "sortDir must be \"asc\" or \"desc\"." };
    }
    dir = d;
  }
  if (!sortable || !sortable.includes(field)) {
    return {
      ok: false,
      error: `Unsupported sort field "${field}". Allowed: ${(sortable ?? []).join(", ") || "(none)"}.`
    };
  }
  return { ok: true, orderBy: withIdTiebreaker([{ [field]: dir }]) };
}

/**
 * Parses `page`, `pageSize`, `q`, `sort`, and `sortDir` from the query
 * string. Pagination is only engaged when `page` or `pageSize` is present.
 */
export function parseListQuery(get: QueryGetter, opts: ListQueryOptions): ParsedListQuery {
  const paginated = get("page") !== undefined || get("pageSize") !== undefined;
  const pageResult = parsePage(get("page"));
  if (!pageResult.ok) return { ok: false, error: pageResult.error };
  const sizeResult = parsePageSize(get("pageSize"));
  if (!sizeResult.ok) return { ok: false, error: sizeResult.error };
  const sortResult = parseSort(get("sort"), get("sortDir"), opts.sortable, opts.defaultSort);
  if (!sortResult.ok) return { ok: false, error: sortResult.error };

  const q = (get("q") ?? "").trim();
  const { page } = pageResult;
  const { pageSize } = sizeResult;

  if (!paginated) {
    return { ok: true, paginated: false, q, orderBy: sortResult.orderBy };
  }
  return {
    ok: true,
    paginated: true,
    q,
    orderBy: sortResult.orderBy,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

/** Builds the `pagination` response block. */
export function paginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize)
  };
}

/**
 * Deterministic comparator for an orderBy clause list. Used by tests to
 * prove that page slicing over a totally-ordered dataset never duplicates
 * or skips records.
 */
export function compareByOrderBy(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  orderBy: OrderByClause[]
): number {
  for (const clause of orderBy) {
    for (const [field, dir] of Object.entries(clause)) {
      const av = a[field];
      const bv = b[field];
      let cmp = 0;
      if (av === bv) {
        cmp = 0;
      } else if (av === null || av === undefined) {
        cmp = -1;
      } else if (bv === null || bv === undefined) {
        cmp = 1;
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av) < String(bv) ? -1 : 1;
      }
      if (cmp !== 0) return dir === "desc" ? -cmp : cmp;
    }
  }
  return 0;
}
