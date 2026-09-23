import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  compareByOrderBy,
  paginationMeta,
  parseListQuery,
  withIdTiebreaker,
  type OrderByClause
} from "./pagination.js";

/** Builds a QueryGetter from a plain params object. */
function query(params: Record<string, string>): (key: string) => string | undefined {
  return (key) => params[key];
}

const SORTABLE = ["name", "createdAt", "total"] as const;
const DEFAULT_SORT: OrderByClause[] = [{ createdAt: "desc" }];

test("no pagination params -> legacy unpaginated mode with defaults", () => {
  const list = parseListQuery(query({}), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(list.ok);
  assert.equal(list.paginated, false);
  assert.equal(list.q, "");
  assert.deepEqual(list.orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
});

test("page alone engages pagination with the default page size of 25", () => {
  const list = parseListQuery(query({ page: "2" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(list.ok);
  assert.equal(list.paginated, true);
  if (!list.paginated) return;
  assert.equal(list.page, 2);
  assert.equal(list.pageSize, DEFAULT_PAGE_SIZE);
  assert.equal(list.skip, 25);
  assert.equal(list.take, 25);
});

test("pageSize alone engages pagination on page 1", () => {
  const list = parseListQuery(query({ pageSize: "50" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(list.ok);
  assert.equal(list.paginated, true);
  if (!list.paginated) return;
  assert.equal(list.page, 1);
  assert.equal(list.pageSize, 50);
  assert.equal(list.skip, 0);
});

test("pageSize whitelist accepts exactly 25, 50, 100", () => {
  for (const size of PAGE_SIZE_OPTIONS) {
    const list = parseListQuery(query({ pageSize: String(size) }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
    assert.ok(list.ok, `pageSize=${size} should be accepted`);
    if (list.paginated) assert.equal(list.pageSize, size);
  }
});

test("pageSize whitelist rejects other values", () => {
  for (const bad of ["10", "200", "0", "-25", "abc", "25.5"]) {
    const list = parseListQuery(query({ pageSize: bad }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
    assert.equal(list.ok, false, `pageSize=${bad} should be rejected`);
    if (!list.ok) assert.match(list.error, /pageSize/);
  }
});

test("page must be a positive 1-based integer", () => {
  for (const bad of ["0", "-1", "1.5", "abc"]) {
    const list = parseListQuery(query({ page: bad }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
    assert.equal(list.ok, false, `page=${bad} should be rejected`);
  }
  const list = parseListQuery(query({ page: "3", pageSize: "100" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(list.ok);
  if (list.paginated) {
    assert.equal(list.skip, 200);
    assert.equal(list.take, 100);
  }
});

test("sort whitelist accepts known fields, asc/desc via prefix or sortDir", () => {
  const asc = parseListQuery(query({ sort: "name" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(asc.ok);
  assert.deepEqual(asc.orderBy, [{ name: "asc" }, { id: "asc" }]);

  const desc = parseListQuery(query({ sort: "-name" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(desc.ok);
  assert.deepEqual(desc.orderBy, [{ name: "desc" }, { id: "asc" }]);

  const viaDir = parseListQuery(query({ sort: "total", sortDir: "desc" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(viaDir.ok);
  assert.deepEqual(viaDir.orderBy, [{ total: "desc" }, { id: "asc" }]);
});

test("sort whitelist rejects unknown fields and bad sortDir", () => {
  const evil = parseListQuery(query({ sort: "password; DROP TABLE" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.equal(evil.ok, false);
  if (!evil.ok) assert.match(evil.error, /Unsupported sort field/);

  const unknown = parseListQuery(query({ sort: "email" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.equal(unknown.ok, false);

  const badDir = parseListQuery(query({ sort: "name", sortDir: "sideways" }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.equal(badDir.ok, false);
});

test("q is trimmed and lowercased", () => {
  const list = parseListQuery(query({ q: "  AcMe Corp  " }), { sortable: SORTABLE, defaultSort: DEFAULT_SORT });
  assert.ok(list.ok);
  assert.equal(list.q, "acme corp");
});

test("id tiebreaker is appended once and never duplicated", () => {
  assert.deepEqual(withIdTiebreaker([{ name: "asc" }]), [{ name: "asc" }, { id: "asc" }]);
  assert.deepEqual(withIdTiebreaker([{ id: "desc" }]), [{ id: "desc" }]);
});

test("paginationMeta computes total and totalPages", () => {
  assert.deepEqual(paginationMeta(1, 25, 0), { page: 1, pageSize: 25, total: 0, totalPages: 0 });
  assert.deepEqual(paginationMeta(1, 25, 25), { page: 1, pageSize: 25, total: 25, totalPages: 1 });
  assert.deepEqual(paginationMeta(2, 25, 26), { page: 2, pageSize: 25, total: 26, totalPages: 2 });
  assert.deepEqual(paginationMeta(4, 25, 100), { page: 4, pageSize: 25, total: 100, totalPages: 4 });
  assert.deepEqual(paginationMeta(1, 50, 101), { page: 1, pageSize: 50, total: 101, totalPages: 3 });
});

test("deterministic ordering: pages over duplicate sort keys never duplicate or skip records", () => {
  // Synthetic dataset with heavy duplication in the sort column.
  const rows = Array.from({ length: 103 }, (_, i) => ({
    id: `row-${String(i).padStart(3, "0")}`,
    createdAt: `2026-01-${String((i % 7) + 1).padStart(2, "0")}` // only 7 distinct values
  }));

  const list = parseListQuery(query({ page: "1", pageSize: "25", sort: "-createdAt" }), {
    sortable: SORTABLE,
    defaultSort: DEFAULT_SORT
  });
  assert.ok(list.ok);
  if (!list.paginated) throw new Error("expected paginated");
  const orderBy = list.orderBy;

  const sorted = [...rows].sort((a, b) => compareByOrderBy(a, b, orderBy));
  const seen = new Set<string>();
  let collected: string[] = [];
  const totalPages = Math.ceil(rows.length / list.pageSize);
  assert.equal(totalPages, 5);
  for (let page = 1; page <= totalPages; page++) {
    const skip = (page - 1) * list.pageSize;
    const slice = sorted.slice(skip, skip + list.pageSize);
    for (const row of slice) {
      assert.ok(!seen.has(row.id), `duplicate across pages: ${row.id}`);
      seen.add(row.id);
    }
    collected = collected.concat(slice.map((r) => r.id));
  }
  assert.equal(collected.length, rows.length, "every record appears exactly once");
  assert.deepEqual(new Set(collected), new Set(rows.map((r) => r.id)));
});
