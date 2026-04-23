import { prisma, Role } from "@kleentoditee/db";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { isEnvTruthy } from "../lib/env-flags.js";
import { signSessionToken } from "../lib/token.js";
import { authRequired, type AuthVariables } from "../middleware/auth.js";

export const authRoutes = new Hono<{ Variables: AuthVariables }>()
  .post("/register", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; name?: string }>();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";

    if (!email || !password || !name) {
      return c.json({ error: "email, password, and name are required" }, 400);
    }

    const existing = await prisma.user.count();
    if (existing > 0) {
      return c.json({ error: "Registration is disabled after the first user exists" }, 403);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        roles: { create: [{ role: Role.platform_owner }, { role: Role.payroll_admin }] }
      },
      include: { roles: true }
    });

    await writeAudit({
      actorUserId: user.id,
      action: "auth.register",
      entityType: "User",
      entityId: user.id,
      after: { email: user.email, name: user.name }
    });

    const roles = user.roles.map((r) => r.role);
    const token = await signSessionToken(user.id, roles);

    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, roles }
    });
  })
  .post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return c.json({ error: "email and password are required" }, 400);
    }

    // Stored emails are normalized to lowercase at registration and seed time.
    const user = await prisma.user.findFirst({
      where: { email },
      include: { roles: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const roles = user.roles.map((r) => r.role);
    const token = await signSessionToken(user.id, roles);

    await writeAudit({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, roles }
    });
  })
  // Last-resort local dev: no password, only if .env opt-in. Remove before any public deploy.
  .post("/dev-emergency", async (c) => {
    if (process.env.NODE_ENV === "production") {
      return c.json(
        {
          error:
            "Emergency login is off when NODE_ENV=production. For local only: set NODE_ENV=development or remove NODE_ENV, then restart the API."
        },
        403
      );
    }
    if (!isEnvTruthy("ALLOW_DEV_EMERGENCY_LOGIN")) {
      return c.json(
        {
          error:
            "Emergency login is off. In the repo root .env (same folder as start-platform.bat) add: ALLOW_DEV_EMERGENCY_LOGIN=1 — save, fully restart the API, and watch the API terminal for: [api] Emergency passwordless login is ON"
        },
        403
      );
    }
    const first = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      include: { roles: true }
    });
    if (!first) {
      return c.json({ error: "No users in database — run db:seed with API stopped" }, 400);
    }
    const roles = first.roles.map((r) => r.role);
    const token = await signSessionToken(first.id, roles);
    await writeAudit({
      actorUserId: first.id,
      action: "auth.dev_emergency",
      entityType: "User",
      entityId: first.id,
      metadata: { email: first.email }
    });
    return c.json({
      token,
      user: { id: first.id, email: first.email, name: first.name, roles }
    });
  })
  .get("/me", authRequired, async (c) => {
    const userId = c.get("userId");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        roles: { select: { role: true } }
      }
    });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles.map((r) => r.role)
      }
    });
  });
