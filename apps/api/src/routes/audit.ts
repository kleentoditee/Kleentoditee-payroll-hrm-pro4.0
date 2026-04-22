import { prisma, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

export const auditRoutes = new Hono<{ Variables: AuthVariables }>().get(
  "/recent",
  authRequired,
  requireRole(Role.platform_owner, Role.payroll_admin, Role.hr_admin, Role.finance_admin),
  async (c) => {
    const take = Math.min(Number(c.req.query("take")) || 50, 200);
    const rows = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take,
      include: {
        actor: { select: { id: true, email: true, name: true } }
      }
    });
    return c.json({ items: rows });
  }
);
