import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveOrgSelection, type OrgMembershipInfo } from "./org-resolution.js";

const orgA: OrgMembershipInfo = { orgId: "org_a", orgName: "A", orgSlug: "a", orgStatus: "active" };
const orgB: OrgMembershipInfo = { orgId: "org_b", orgName: "B", orgSlug: "b", orgStatus: "active" };
const orgS: OrgMembershipInfo = { orgId: "org_s", orgName: "S", orgSlug: "s", orgStatus: "suspended" };

test("single active membership is selected by default", () => {
  const r = resolveOrgSelection({ requestedOrgId: null, memberships: [orgA], isPlatformSupport: false });
  assert.deepEqual(r, { kind: "ok", orgId: "org_a", supportAccess: false });
});

test("no memberships yields none", () => {
  const r = resolveOrgSelection({ requestedOrgId: null, memberships: [], isPlatformSupport: false });
  assert.equal(r.kind, "none");
});

test("multiple active memberships without a request is ambiguous", () => {
  const r = resolveOrgSelection({ requestedOrgId: null, memberships: [orgA, orgB], isPlatformSupport: false });
  assert.equal(r.kind, "ambiguous");
  if (r.kind === "ambiguous") assert.deepEqual(r.orgs.map((o) => o.orgId), ["org_a", "org_b"]);
});

test("requested membership org is honored", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_b", memberships: [orgA, orgB], isPlatformSupport: false });
  assert.deepEqual(r, { kind: "ok", orgId: "org_b", supportAccess: false });
});

test("client-supplied org id without membership is forbidden (never trusted)", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_b", memberships: [orgA], isPlatformSupport: false });
  assert.equal(r.kind, "forbidden");
});

test("guessed unknown org id is forbidden identically (no enumeration)", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_does_not_exist", memberships: [orgA], isPlatformSupport: false });
  assert.equal(r.kind, "forbidden");
});

test("suspended membership org is forbidden", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_s", memberships: [orgA, orgS], isPlatformSupport: false });
  assert.equal(r.kind, "forbidden");
});

test("all-suspended memberships with no request is forbidden", () => {
  const r = resolveOrgSelection({ requestedOrgId: null, memberships: [orgS], isPlatformSupport: false });
  assert.equal(r.kind, "forbidden");
});

test("suspended memberships are excluded from the ambiguous list", () => {
  const r = resolveOrgSelection({ requestedOrgId: null, memberships: [orgA, orgB, orgS], isPlatformSupport: false });
  assert.equal(r.kind, "ambiguous");
  if (r.kind === "ambiguous") assert.equal(r.orgs.length, 2);
});

test("platform support may enter a non-membership org, flagged for audit", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_x", memberships: [orgA], isPlatformSupport: true, supportOrgExists: true });
  assert.deepEqual(r, { kind: "ok", orgId: "org_x", supportAccess: true });
});

test("platform support requesting a nonexistent org gets unknown_org", () => {
  const r = resolveOrgSelection({ requestedOrgId: "org_nope", memberships: [orgA], isPlatformSupport: true, supportOrgExists: false });
  assert.equal(r.kind, "unknown_org");
});

test("blank requested org id falls back to default resolution", () => {
  const r = resolveOrgSelection({ requestedOrgId: "   ", memberships: [orgA], isPlatformSupport: false });
  assert.deepEqual(r, { kind: "ok", orgId: "org_a", supportAccess: false });
});
