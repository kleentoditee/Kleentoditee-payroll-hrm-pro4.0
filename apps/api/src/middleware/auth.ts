import { prisma, runWithOrgScope, UserStatus, type Role } from "@kleentoditee/db";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  csrfTokensMatch,
  isMutatingMethod,
  parseCookies
} from "../lib/auth-cookies.js";
import { writeAudit } from "../lib/audit.js";
import { ORG_COOKIE, ORG_HEADER, resolveOrgSelection, type OrgMembershipInfo } from "../lib/org-resolution.js";
import { verifySessionToken } from "../lib/token.js";

export type AuthVariables = {
  userId: string;
  roles: Role[];
  /** Active tenant for this request (Batch 12). Set by authRequired. */
  orgId: string;
  /** True when the org scope came from audited platform-support access. */
  supportAccess: boolean;
};

type AuthenticatedUser = {
  id: string;
  roles: Role[];
  isPlatformSupport: boolean;
};

/**
 * Shared credential check: bearer (transitional) or HttpOnly session cookie,
 * plus double-submit CSRF on cookie-authenticated mutations. Returns the
 * authenticated user or a ready-to-send error Response.
 */
async function authenticate(c: Context): Promise<AuthenticatedUser | Response> {
  const header = c.req.header("Authorization");
  const bearerToken = header?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const cookies = parseCookies(c.req.header("Cookie"));
  const token = bearerToken || cookies[SESSION_COOKIE] || "";
  const viaCookie = !bearerToken && Boolean(cookies[SESSION_COOKIE]);

  if (!token) {
    return c.json({ error: "Authentication required" }, 401);
  }

  if (viaCookie && isMutatingMethod(c.req.method)) {
    const headerCsrf = c.req.header(CSRF_HEADER) ?? "";
    const cookieCsrf = cookies[CSRF_COOKIE] ?? "";
    if (!csrfTokensMatch(headerCsrf, cookieCsrf)) {
      return c.json({ error: "CSRF validation failed. Refresh the page and try again." }, 403);
    }
  }

  try {
    const payload = await verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        status: true,
        tokenVersion: true,
        isPlatformSupport: true,
        roles: { select: { role: true } }
      }
    });
    if (!user || user.status !== UserStatus.active || user.tokenVersion !== payload.tv) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }
    return {
      id: user.id,
      roles: user.roles.map((r) => r.role),
      isPlatformSupport: user.isPlatformSupport
    };
  } catch {
    return c.json({ error: "Invalid or expired session" }, 401);
  }
}

/**
 * Identity only — for endpoints that must work without an organization
 * context (session introspection, logout). Business routes use authRequired.
 */
export const authOnly = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const result = await authenticate(c);
  if (result instanceof Response) {
    return result;
  }
  c.set("userId", result.id);
  c.set("roles", result.roles);
  c.set("supportAccess", false);
  await next();
});

/**
 * Authenticates AND resolves the tenant. The request runs inside an
 * AsyncLocalStorage org scope, so every prisma query in the handler (and any
 * service it calls) is automatically constrained to the resolved org.
 *
 * Selection: explicit `x-kt-org` header / `kt_org` cookie, validated against
 * OrganizationMembership — a client-supplied org id is never trusted without
 * membership. With no explicit selection, a single active membership is used;
 * several memberships require an explicit choice (409 with the org list).
 * Platform-support staff may enter any org; every such request is audited.
 */
export const authRequired = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const result = await authenticate(c);
  if (result instanceof Response) {
    return result;
  }

  const cookies = parseCookies(c.req.header("Cookie"));
  const requestedOrgId = c.req.header(ORG_HEADER) ?? cookies[ORG_COOKIE] ?? null;

  // Runs outside the org scope on purpose: membership lookup is platform-level.
  const membershipRows = await prisma.organizationMembership.findMany({
    where: { userId: result.id },
    include: { organization: { select: { id: true, name: true, slug: true, status: true } } }
  });
  const memberships: OrgMembershipInfo[] = membershipRows.map((m) => ({
    orgId: m.orgId,
    orgName: m.organization.name,
    orgSlug: m.organization.slug,
    orgStatus: m.organization.status
  }));

  let supportOrgExists: boolean | undefined;
  if (
    result.isPlatformSupport &&
    requestedOrgId &&
    !memberships.some((m) => m.orgId === requestedOrgId)
  ) {
    const org = await prisma.organization.findUnique({
      where: { id: requestedOrgId },
      select: { id: true }
    });
    supportOrgExists = Boolean(org);
  }

  const resolution = resolveOrgSelection({
    requestedOrgId,
    memberships,
    isPlatformSupport: result.isPlatformSupport,
    supportOrgExists
  });

  switch (resolution.kind) {
    case "none":
      return c.json({ error: "Your account is not a member of any organization." }, 403);
    case "forbidden":
      return c.json({ error: resolution.reason }, 403);
    case "unknown_org":
      return c.json({ error: "Organization not found." }, 404);
    case "ambiguous":
      return c.json(
        {
          error: "Select an organization.",
          organizations: resolution.orgs.map((o) => ({ id: o.orgId, name: o.orgName, slug: o.orgSlug }))
        },
        409
      );
  }

  c.set("userId", result.id);
  c.set("roles", result.roles);
  c.set("orgId", resolution.orgId);
  c.set("supportAccess", resolution.supportAccess);

  if (resolution.supportAccess) {
    await writeAudit({
      actorUserId: result.id,
      action: "platform_support.org_access",
      entityType: "Organization",
      entityId: resolution.orgId,
      orgId: resolution.orgId,
      metadata: { path: c.req.path, method: c.req.method }
    });
  }

  return runWithOrgScope({ orgId: resolution.orgId, supportAccess: resolution.supportAccess }, () => next());
});

export function requireRole(...allowed: Role[]) {
  return createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const roles = c.get("roles");
    if (!roles.some((r) => allowed.includes(r))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
