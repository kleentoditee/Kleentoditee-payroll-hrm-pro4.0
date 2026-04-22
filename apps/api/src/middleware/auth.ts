import type { Role } from "@kleentoditee/db";
import { createMiddleware } from "hono/factory";
import { verifySessionToken } from "../lib/token.js";

export type AuthVariables = {
  userId: string;
  roles: Role[];
};

export const authRequired = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return c.json({ error: "Missing Authorization bearer token" }, 401);
  }
  try {
    const payload = await verifySessionToken(token);
    c.set("userId", payload.sub);
    c.set("roles", payload.roles);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
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
