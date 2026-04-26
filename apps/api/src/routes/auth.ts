import { prisma, Role, UserStatus } from "@kleentoditee/db";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { emailCanonical } from "../lib/email-normalize.js";
import { isEnvTruthy } from "../lib/env-flags.js";
import { signSessionToken } from "../lib/token.js";
import { authRequired, type AuthVariables } from "../middleware/auth.js";

function isValidEmail(s: string): boolean {
  return s.length > 0 && s.length < 256 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>()
  .post("/register", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string; name?: string }>();
    const emailRaw = body.email?.trim() ?? "";
    const email = emailCanonical(emailRaw);
    const password = body.password ?? "";
    const name = body.name?.trim() ?? "";

    if (!email || !password || !name) {
      return c.json({ error: "email, password, and name are required" }, 400);
    }
    if (!isValidEmail(email)) {
      return c.json({ error: "A valid email is required" }, 400);
    }

    const existing = await prisma.user.count();
    if (existing > 0) {
      return c.json({ error: "Registration is disabled after the first user exists" }, 403);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        emailCanonical: email,
        passwordHash,
        name,
        status: UserStatus.active,
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
    const token = await signSessionToken(user.id, roles, user.tokenVersion);

    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, roles, status: user.status }
    });
  })
  .post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const email = emailCanonical(body.email ?? "");
    const password = body.password ?? "";

    if (!email || !password) {
      return c.json({ error: "email and password are required" }, 400);
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ emailCanonical: email }, { email, emailCanonical: null }]
      },
      include: { roles: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return c.json({ error: "Invalid email or password" }, 401);
    }
    if (user.status === UserStatus.invited) {
      return c.json(
        {
          error: "Complete your invitation before signing in.",
          code: "invitation_pending"
        },
        401
      );
    }
    if (user.status !== UserStatus.active) {
      return c.json({ error: "This account is disabled" }, 401);
    }

    const roles = user.roles.map((r) => r.role);
    const token = await signSessionToken(user.id, roles, user.tokenVersion);

    await writeAudit({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, roles, status: user.status }
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
      where: { status: UserStatus.active },
      orderBy: { createdAt: "asc" },
      include: { roles: true }
    });
    if (!first) {
      return c.json(
        { error: "No active users in database — run db:seed with API stopped, or reactivate a user" },
        400
      );
    }
    const roles = first.roles.map((r) => r.role);
    const token = await signSessionToken(first.id, roles, first.tokenVersion);
    await writeAudit({
      actorUserId: first.id,
      action: "auth.dev_emergency",
      entityType: "User",
      entityId: first.id,
      metadata: { email: first.email }
    });
    return c.json({
      token,
      user: { id: first.id, email: first.email, name: first.name, roles, status: first.status }
    });
  })
  .post("/invite/accept", async (c) => {
    const body = await c.req.json<{ token?: string; password?: string; name?: string }>();
    const rawToken = String(body.token ?? "").trim();
    const password = String(body.password ?? "");
    const name = body.name !== undefined ? String(body.name).trim() : undefined;

    if (!rawToken || !password) {
      return c.json({ error: "token and password are required" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "password must be at least 8 characters" }, 400);
    }
    if (name !== undefined && !name) {
      return c.json({ error: "name cannot be empty" }, 400);
    }
    const colon = rawToken.indexOf(":");
    if (colon < 1) {
      return c.json({ error: "Invalid token" }, 400);
    }
    const invId = rawToken.slice(0, colon);
    const afterColon = rawToken.slice(colon + 1);
    if (!afterColon) {
      return c.json({ error: "Invalid token" }, 400);
    }
    const inv = await prisma.userInvitation.findFirst({
      where: {
        id: invId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      },
      include: { user: { include: { roles: true } } }
    });
    if (!inv) {
      return c.json({ error: "Invitation not found or no longer valid" }, 400);
    }
    if (!(await bcrypt.compare(rawToken, inv.tokenHash))) {
      return c.json({ error: "Invalid token" }, 400);
    }
    if (inv.user.status !== UserStatus.invited) {
      return c.json({ error: "This account is not awaiting invitation acceptance" }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.userInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date() }
      });
      const u = await tx.user.update({
        where: { id: inv.userId },
        data: {
          passwordHash,
          name: name ?? inv.user.name,
          status: UserStatus.active
        },
        include: { roles: true }
      });
      return u;
    });

    const roles = updated.roles.map((r) => r.role);
    const token = await signSessionToken(updated.id, roles, updated.tokenVersion);

    await writeAudit({
      actorUserId: updated.id,
      action: "auth.invite.accept",
      entityType: "User",
      entityId: updated.id,
      after: { email: updated.email, name: updated.name }
    });

    return c.json({
      token,
      user: { id: updated.id, email: updated.email, name: updated.name, roles, status: updated.status }
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
        status: true,
        roles: { select: { role: true } }
      }
    });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    if (user.status !== UserStatus.active) {
      return c.json({ error: "This account is disabled" }, 401);
    }
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
        roles: user.roles.map((r) => r.role)
      }
    });
  });
