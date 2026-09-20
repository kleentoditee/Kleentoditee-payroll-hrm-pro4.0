import { prisma, Role, UserStatus } from "@kleentoditee/db";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { writeAudit } from "../lib/audit.js";
import { sendPasswordResetEmail } from "../lib/email.js";
import { emailCanonical } from "../lib/email-normalize.js";
import { isEnvTruthy } from "../lib/env-flags.js";
import {
  type PasswordResetTokenRow,
  buildPasswordResetUrl,
  createPasswordResetToken,
  hashPasswordResetToken,
  isValidResetPassword,
  passwordResetExpiresAt,
  PASSWORD_RESET_SAFE_MESSAGE,
  type PasswordResetApp,
  resetPasswordRuleMessage
} from "../lib/password-reset.js";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  csrfCookieValue,
  expiredCookieValue,
  newCsrfToken,
  sessionCookieValue
} from "../lib/auth-cookies.js";
import { clearAttempts, isAttemptBlocked, isIntervalThrottled, recordAttempt } from "../lib/rate-limit.js";
import { signSessionToken } from "../lib/token.js";
import { authOnly, authRequired, type AuthVariables } from "../middleware/auth.js";

function isValidEmail(s: string): boolean {
  return s.length > 0 && s.length < 256 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const RESET_THROTTLE_MS = 60_000;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_ATTEMPTS = 10;

function cookiesSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

type CookieHeaderSetter = {
  header(name: string, value: string, options?: { append?: boolean }): void;
};

/** Sets the HttpOnly session cookie + readable CSRF cookie; returns the CSRF token. */
function issueSessionCookies(c: CookieHeaderSetter, token: string): string {
  const csrf = newCsrfToken();
  const secure = cookiesSecure();
  c.header("Set-Cookie", sessionCookieValue(token, secure), { append: true });
  c.header("Set-Cookie", csrfCookieValue(csrf, secure), { append: true });
  return csrf;
}

async function deliverPasswordResetLink(email: string, link: string): Promise<void> {
  try {
    if (await sendPasswordResetEmail(email, link)) {
      return;
    }
  } catch (error) {
    console.error("[auth] Password reset email delivery failed.", error);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[auth] Development password reset link for ${email}: ${link}`);
  } else {
    console.error("[auth] Password reset email requested, but SMTP is not configured.");
  }
}

function loginAttemptKey(ip: string, email: string): string {
  return `${ip.trim().toLowerCase()}:${email}`;
}


async function findPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRow | null> {
  const rows = await prisma.$queryRaw<PasswordResetTokenRow[]>`
    SELECT
      prt."id",
      prt."userId",
      prt."tokenHash",
      prt."expiresAt",
      prt."usedAt",
      u."email" AS "userEmail",
      u."status" AS "userStatus"
    FROM "PasswordResetToken" prt
    JOIN "User" u ON u."id" = prt."userId"
    WHERE prt."tokenHash" = ${tokenHash}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "PasswordResetToken"
    SET "usedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}
  `;
}

export const authRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/setup-status", async (c) => {
    const userCount = await prisma.user.count();
    return c.json({ needsSetup: userCount === 0 });
  })
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
    if (!isValidResetPassword(password)) {
      return c.json({ error: resetPasswordRuleMessage() }, 400);
    }

    const existing = await prisma.user.count();
    if (existing > 0) {
      return c.json({ error: "Registration is disabled after the first user exists" }, 403);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // First-user bootstrap also creates the tenant organization (Batch 12).
    const baseSlug = (email.split("@")[1] || "org").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "org";
    const user = await prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      for (let i = 2; await tx.organization.findUnique({ where: { slug } }); i += 1) {
        slug = `${baseSlug}-${i}`;
      }
      const org = await tx.organization.create({
        data: { name: `${name}'s Organization`, slug }
      });
      const created = await tx.user.create({
        data: {
          email,
          emailCanonical: email,
          passwordHash,
          name,
          status: UserStatus.active,
          roles: { create: [{ role: Role.platform_owner }, { role: Role.payroll_admin }] },
          memberships: { create: [{ orgId: org.id }] }
        },
        include: { roles: true }
      });
      return created;
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
    const csrf = issueSessionCookies(c, token);

    return c.json({
      token,
      csrfToken: csrf,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        status: user.status,
        employeeId: user.employeeId
      }
    });
  })
  .post("/login", async (c) => {
    const body = await c.req.json<{ email?: string; password?: string }>();
    const email = emailCanonical(body.email ?? "");
    const password = body.password ?? "";

    if (!email || !password) {
      return c.json({ error: "email and password are required" }, 400);
    }

    const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const attemptKey = loginAttemptKey(forwardedFor, email);
    if (await isAttemptBlocked(attemptKey, LOGIN_MAX_ATTEMPTS)) {
      c.header("Retry-After", String(Math.ceil(LOGIN_WINDOW_MS / 1000)));
      return c.json({ error: "Too many sign-in attempts. Try again later.", code: "rate_limited" }, 429);
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ emailCanonical: email }, { email, emailCanonical: null }]
      },
      include: { roles: true }
    });

    if (!user) {
      await recordAttempt(attemptKey, LOGIN_WINDOW_MS);
      return c.json({ error: "Invalid email or password", code: "invalid_credentials" }, 401);
    }

    // Invited accounts use a random placeholder hash until invite accept — check status before bcrypt
    // so users see a clear next step instead of a misleading password error.
    if (user.status === UserStatus.invited) {
      await recordAttempt(attemptKey, LOGIN_WINDOW_MS);
      return c.json(
        {
          error: "Complete your invitation before signing in.",
          code: "invitation_pending"
        },
        401
      );
    }
    if (user.status !== UserStatus.active) {
      await recordAttempt(attemptKey, LOGIN_WINDOW_MS);
      return c.json(
        { error: "This account is disabled", code: "account_inactive" },
        401
      );
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await recordAttempt(attemptKey, LOGIN_WINDOW_MS);
      return c.json({ error: "Invalid email or password", code: "invalid_credentials" }, 401);
    }

    await clearAttempts(attemptKey);

    const roles = user.roles.map((r) => r.role);
    const token = await signSessionToken(user.id, roles, user.tokenVersion);
    const csrf = issueSessionCookies(c, token);

    await writeAudit({
      actorUserId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      metadata: { email: user.email }
    });

    return c.json({
      token,
      csrfToken: csrf,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
        status: user.status,
        employeeId: user.employeeId
      }
    });
  })
  .post("/password/forgot", async (c) => {
    const body = await c.req.json<{ email?: string; app?: PasswordResetApp }>();
    const email = emailCanonical(body.email ?? "");
    const resetApp: PasswordResetApp = body.app === "admin" ? "admin" : "tracker";

    if (!email || !isValidEmail(email)) {
      return c.json({ ok: true, message: PASSWORD_RESET_SAFE_MESSAGE });
    }

    if (await isIntervalThrottled(`reset:${email}`, RESET_THROTTLE_MS)) {
      return c.json({ ok: true, message: PASSWORD_RESET_SAFE_MESSAGE });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ emailCanonical: email }, { email, emailCanonical: null }],
        status: UserStatus.active
      },
      select: { id: true, email: true }
    });

    if (user) {
      const rawToken = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(rawToken);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "PasswordResetToken"
          SET "usedAt" = CURRENT_TIMESTAMP
          WHERE "userId" = ${user.id} AND "usedAt" IS NULL
        `;
        await tx.$executeRaw`
          INSERT INTO "PasswordResetToken" ("id", "userId", "tokenHash", "expiresAt")
          VALUES (${randomUUID()}, ${user.id}, ${tokenHash}, ${passwordResetExpiresAt()})
        `;
      });
      await deliverPasswordResetLink(user.email, buildPasswordResetUrl(rawToken, resetApp));
      await writeAudit({
        actorUserId: user.id,
        action: "auth.password_reset.request",
        entityType: "User",
        entityId: user.id,
        metadata: { email: user.email }
      });
    }

    return c.json({ ok: true, message: PASSWORD_RESET_SAFE_MESSAGE });
  })
  .post("/password/reset", async (c) => {
    const body = await c.req.json<{ token?: string; password?: string }>();
    const rawToken = String(body.token ?? "").trim();
    const password = String(body.password ?? "");

    if (!rawToken) {
      return c.json({ error: "Reset link is invalid or expired." }, 400);
    }
    if (!isValidResetPassword(password)) {
      return c.json({ error: resetPasswordRuleMessage() }, 400);
    }

    const tokenHash = hashPasswordResetToken(rawToken);
    const reset = await findPasswordResetToken(tokenHash);
    if (!reset || reset.usedAt || reset.expiresAt <= new Date() || reset.userStatus !== UserStatus.active) {
      return c.json({ error: "Reset link is invalid or expired." }, 400);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
          where: { id: reset.userId },
          data: { passwordHash, tokenVersion: { increment: 1 } }
        });
      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "id" = ${reset.id}
      `;
      await tx.$executeRaw`
        UPDATE "PasswordResetToken"
        SET "usedAt" = CURRENT_TIMESTAMP
        WHERE "userId" = ${reset.userId} AND "usedAt" IS NULL
      `;
    });

    await writeAudit({
      actorUserId: reset.userId,
      action: "auth.password_reset.complete",
      entityType: "User",
      entityId: reset.userId,
      metadata: { email: reset.userEmail }
    });

    return c.json({ ok: true, message: "Password reset. You can sign in with your new password." });
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
    const csrf = issueSessionCookies(c, token);
    await writeAudit({
      actorUserId: first.id,
      action: "auth.dev_emergency",
      entityType: "User",
      entityId: first.id,
      metadata: { email: first.email }
    });
    return c.json({
      token,
      csrfToken: csrf,
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
    if (!isValidResetPassword(password)) {
      return c.json({ error: resetPasswordRuleMessage() }, 400);
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
      await tx.organizationMembership.upsert({
        where: { orgId_userId: { orgId: inv.orgId, userId: inv.userId } },
        create: { orgId: inv.orgId, userId: inv.userId },
        update: {}
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

    await writeAudit({
      actorUserId: updated.id,
      action: "auth.invite.accept",
      entityType: "User",
      entityId: updated.id,
      after: { email: updated.email, name: updated.name }
    });

    // No JWT here — user signs in on /login (separate step). Response never includes raw invite token.
    return c.json({
      ok: true,
      email: updated.email
    });
  })
    .post("/logout", authOnly, async (c) => {
    const userId = c.get("userId");
    await prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
    await writeAudit({
      actorUserId: userId,
      action: "auth.logout",
      entityType: "User",
      entityId: userId
    });
    c.header("Set-Cookie", expiredCookieValue(SESSION_COOKIE, true), { append: true });
    c.header("Set-Cookie", expiredCookieValue(CSRF_COOKIE, false), { append: true });
    return c.json({ ok: true });
  })
  .get("/me", authOnly, async (c) => {
    const userId = c.get("userId");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        employeeId: true,
        roles: { select: { role: true } },
        memberships: {
          select: { orgId: true, organization: { select: { name: true, slug: true, status: true } } }
        }
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
        employeeId: user.employeeId,
        roles: user.roles.map((r) => r.role),
        organizations: user.memberships.map((m) => ({
          id: m.orgId,
          name: m.organization.name,
          slug: m.organization.slug,
          status: m.organization.status
        }))
      }
    });
  });
