import assert from "node:assert/strict";
import { test } from "node:test";
import { applyOrgScope } from "@kleentoditee/db";

const ORG = "org_test";

test("reads get an orgId where filter merged with existing filters", () => {
  for (const op of ["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]) {
    const out = applyOrgScope(op, { where: { active: true } }, ORG) as { where: Record<string, unknown> };
    assert.deepEqual(out.where, { active: true, orgId: ORG }, op);
  }
});

test("findUnique/update/delete where gains orgId (mismatch = not found)", () => {
  for (const op of ["findUnique", "findUniqueOrThrow", "update", "delete"]) {
    const out = applyOrgScope(op, { where: { id: "x" } }, ORG) as { where: Record<string, unknown> };
    assert.deepEqual(out.where, { id: "x", orgId: ORG }, op);
  }
});

test("undefined args still get a where clause", () => {
  const out = applyOrgScope("findMany", undefined, ORG) as { where: Record<string, unknown> };
  assert.deepEqual(out.where, { orgId: ORG });
});

test("create data gets orgId", () => {
  const out = applyOrgScope("create", { data: { name: "A" } }, ORG) as { data: Record<string, unknown> };
  assert.equal(out.data.orgId, ORG);
  assert.equal(out.data.name, "A");
});

test("nested relation creates get orgId recursively", () => {
  const out = applyOrgScope(
    "create",
    {
      data: {
        number: "INV-1",
        lines: { create: [{ description: "a" }, { description: "b" }] },
        tax: { createMany: { data: [{ amount: 1 }] } },
        ref: { connectOrCreate: { where: { id: "r1" }, create: { name: "r" } } },
        customer: { connect: { id: "cust1" } }
      }
    },
    ORG
  ) as never as {
    data: {
      orgId: string;
      lines: { create: Array<{ orgId: string }> };
      tax: { createMany: { data: Array<{ orgId: string }> } };
      ref: { connectOrCreate: { create: { orgId: string } } };
      customer: { connect: { id: string; orgId?: string } };
    };
  };
  assert.equal(out.data.orgId, ORG);
  assert.deepEqual(out.data.lines.create.map((l) => l.orgId), [ORG, ORG]);
  assert.equal(out.data.tax.createMany.data[0].orgId, ORG);
  assert.equal(out.data.ref.connectOrCreate.create.orgId, ORG);
  // connect targets existing rows — never rewritten
  assert.deepEqual(out.data.customer.connect, { id: "cust1" });
});

test("upsert scopes where and injects create but leaves update untouched", () => {
  const out = applyOrgScope(
    "upsert",
    { where: { code: "1000" }, create: { code: "1000" }, update: { name: "Cash" } },
    ORG
  ) as { where: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> };
  assert.deepEqual(out.where, { code: "1000", orgId: ORG });
  assert.equal(out.create.orgId, ORG);
  assert.deepEqual(out.update, { name: "Cash" });
});

test("createMany injects orgId into every row", () => {
  const out = applyOrgScope("createMany", { data: [{ a: 1 }, { a: 2 }] }, ORG) as { data: Array<{ orgId: string }> };
  assert.deepEqual(out.data.map((r) => r.orgId), [ORG, ORG]);
});

test("scalar arrays in create data are not treated as relations", () => {
  const out = applyOrgScope("create", { data: { tags: ["a", "b"], name: "x" } }, ORG) as {
    data: { tags: string[]; orgId: string };
  };
  assert.deepEqual(out.data.tags, ["a", "b"]);
  assert.equal(out.data.orgId, ORG);
});
