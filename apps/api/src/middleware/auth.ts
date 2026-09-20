import { prisma, UserStatus, type Role } from "@kleentoditee/db";
import { createMiddleware } from "hono/factory";
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
  csrfTokensMatch,
  isMutatingMethod,
  parseCookies
} from "../lib/auth-cookies.js";
import { verifySessionToken } from "../lib/token.js";

export type AuthVariables = {
  userId: string;
  roles: Role[];
};

/**
 * Authenticates via Authorization bearer (transitional) or the HttpOnly
 * session cookie. Cookie-authenticated mutating requests must also pass the
 * double-submit CSRF check (x-kt-csrf header matches the kt_csrf cookie).
 */
export const authRequired = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
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
        roles: { select: { role: true } }
      }
    });
    if (!user || user.status !== UserStatus.active || user.tokenVersion !== payload.tv) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }
    c.set("userId", user.id);
    c.set("roles", user.roles.map((r) => r.role));
    await next();
  } catch {
    return c.json({ error: "Invalid or expired session" }, 401);
  }
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
