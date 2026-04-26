import { prisma, type Prisma, Role, UserStatus } from "@kleentoditee/db";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { emailCanonical } from "../lib/email-normalize.js";
import { isUniqueConstraintError } from "../lib/prisma-errors.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_MANAGE = [Role.platform_owner] as const;

const ALL_ROLES: Role[] = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor,
  Role.employee_tracker_user
];

const INVITE_TTL_DAYS = 7;

function isRoleString(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as string[]).includes(v);
}

function parseRoleArray(v: unknown): Role[] | null {
  if (!Array.isArray(v) || v.length === 0) {
    return null;
  }
  const out: Role[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    if (!isRoleString(x)) {
      return null;
    }
    if (seen.has(x)) {
      continue;
    }
    seen.add(x);
    out.push(x);
  }
  return out.length > 0 ? out : null;
}

function isValidEmail(s: string): boolean {
  return s.length > 0 && s.length < 256 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function devInviteBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

const userSelect = {
  id: true,
  email: true,
  name: true,
  status: true,
  employeeId: true,
  createdAt: true,
  updatedAt: true,
  roles: { select: { id: true, role: true } },
  employee: { select: { id: true, fullName: true } }
} as const;

type UserRow = {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  employeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { id: string; role: Role }[];
  employee: { id: string; fullName: string } | null;
};

function mapUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    employeeId: u.employeeId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: u.roles.map((r) => r.role),
    employee: u.employee
  };
}

function parseUserStatusList(q: string | undefined): UserStatus[] | null {
  if (!q) {
    return null;
  }
  const valid = new Set<string>(Object.values(UserStatus) as string[]);
  const parts = q
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out: UserStatus[] = [];
  for (const p of parts) {
    if (!valid.has(p)) {
      return null;
    }
    out.push(p as UserStatus);
  }
  return out.length ? out : null;
}

async function countOtherActivePlatformOwners(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: {
      id: { not: excludeUserId },
      status: UserStatus.active,
      roles: { some: { role: Role.platform_owner } }
    }
  });
}

function isActivePlatformOwner(user: { status: UserStatus; roles: { role: Role }[] }): boolean {
  return user.status === UserStatus.active && user.roles.some((r) => r.role === Role.platform_owner);
}

/** Ensures we do not remove the last *active* platform_owner from the pool. */
async function assertKeepsActivePlatformOwner(params: {
  userId: string;
  willContributeAfter: boolean;
  wasActivePlatformOwner: boolean;
}): Promise<void> {
  const { userId, willContributeAfter, wasActivePlatformOwner } = params;
  if (willContributeAfter) {
    return;
  }
  if (!wasActivePlatformOwner) {
    return;
  }
  const others = await countOtherActivePlatformOwners(userId);
  if (others < 1) {
    throw new Error("The last active platform owner cannot be deactivated or stripped of the platform_owner role.");
  }
}

function buildListWhere(
  c: { req: { query: (k: string) => string | undefined } }
): Prisma.UserWhereInput | undefined {
  const qStatus = parseUserStatusList(c.req.query("status"));
  const qActive = c.req.query("active");
  if (qStatus) {
    return { status: { in: qStatus } };
  }
  if (qActive === "true") {
    return { status: UserStatus.active };
  }
  if (qActive === "false") {
    return { status: { not: UserStatus.active } };
  }
  return undefined;
}

export const adminUserRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/users/invitations/pending", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const now = new Date();
    const rows = await prisma.userInvitation.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, email: true, name: true, status: true } } }
    });
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        userStatus: r.user.status,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt
      }))
    });
  })
  .post("/users/invite", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const email = emailCanonical(String(body.email ?? ""));
    const name = String(body.name ?? "").trim() || email.split("@")[0] || "User";
    if (!isValidEmail(email)) {
      return c.json({ error: "A valid email is required" }, 400);
    }
    const roles = parseRoleArray(body.roles);
    if (!roles) {
      return c.json({ error: "roles must be a non-empty array of valid role values" }, 400);
    }
    let employeeId: string | null = null;
    if (body.employeeId !== undefined && body.employeeId !== null) {
      const eid = String(body.employeeId);
      if (eid) {
        const emp = await prisma.employee.findUnique({ where: { id: eid } });
        if (!emp) {
          return c.json({ error: "employeeId not found" }, 400);
        }
        employeeId = eid;
      }
    }
    const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
    const invSecret = randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { OR: [{ emailCanonical: email }, { email, emailCanonical: null }] }
        });
        if (existing) {
          throw new Error("EMAIL_TAKEN");
        }
        const user = await tx.user.create({
          data: {
            email,
            emailCanonical: email,
            name,
            passwordHash: placeholderHash,
            status: UserStatus.invited,
            employeeId,
            roles: { create: roles.map((role) => ({ role })) }
          },
          select: { id: true, email: true, name: true, status: true, employeeId: true }
        });
        const invRow = await tx.userInvitation.create({
          data: {
            userId: user.id,
            tokenHash: await bcrypt.hash(`placeholder:${user.id}:${invSecret}`, 8),
            expiresAt
          }
        });
        const rawToken = `${invRow.id}:${invSecret}`;
        const tokenHash = await bcrypt.hash(rawToken, 12);
        await tx.userInvitation.update({
          where: { id: invRow.id },
          data: { tokenHash }
        });
        return { user, rawToken };
      });

      const userFull = await prisma.user.findUniqueOrThrow({
        where: { id: result.user.id },
        select: userSelect
      });
      const mapped = mapUser(userFull as UserRow);
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "user.admin.invite",
        entityType: "User",
        entityId: result.user.id,
        after: { email: result.user.email, name: result.user.name, status: result.user.status, roles }
      });
      // Production: JSON must never include raw tokens or full accept URLs. Only non-prod may attach devInvitePath or log a URL.
      const resBody: {
        user: ReturnType<typeof mapUser>;
        devInvitePath?: string;
        devMessage?: string;
      } = { user: mapped };
      if (!isProduction()) {
        const path = `/accept-invite?token=${encodeURIComponent(result.rawToken)}`;
        resBody.devInvitePath = path;
        resBody.devMessage = `Invitation created. Dev accept URL path (append to admin app base): ${path}`;
        console.log(`[user admin] dev invite (no email): ${devInviteBaseUrl()}${path}`);
      }
      return c.json(resBody, 201);
    } catch (e) {
      if (e instanceof Error && e.message === "EMAIL_TAKEN") {
        return c.json({ error: "That email is already in use" }, 409);
      }
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "That email or employee is already linked to a user" }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not create invitation" }, 400);
    }
  })
  .get("/users", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const where = buildListWhere(c);
    const items = await prisma.user.findMany({
      where: where ?? undefined,
      orderBy: { createdAt: "asc" },
      select: userSelect
    });
    return c.json({ items: items.map((u) => mapUser(u as UserRow)) });
  })
  .post("/users", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const email = emailCanonical(String(body.email ?? ""));
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    if (!isValidEmail(email)) {
      return c.json({ error: "A valid email is required" }, 400);
    }
    if (!name) {
      return c.json({ error: "name is required" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "password must be at least 8 characters" }, 400);
    }
    const roles = parseRoleArray(body.roles);
    if (!roles) {
      return c.json({ error: "roles must be a non-empty array of valid role values" }, 400);
    }
    let employeeId: string | null = null;
    if (body.employeeId !== undefined && body.employeeId !== null) {
      const eid = String(body.employeeId);
      if (eid) {
        const emp = await prisma.employee.findUnique({ where: { id: eid } });
        if (!emp) {
          return c.json({ error: "employeeId not found" }, 400);
        }
        employeeId = eid;
      }
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const user = await prisma.user.create({
        data: {
          email,
          emailCanonical: email,
          name,
          passwordHash,
          status: UserStatus.active,
          employeeId,
          roles: { create: roles.map((role) => ({ role })) }
        },
        select: userSelect
      });
      const mapped = mapUser(user as UserRow);
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "user.admin.create",
        entityType: "User",
        entityId: user.id,
        after: mapped
      });
      return c.json({ user: mapped }, 201);
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "That email or employee is already linked to a user" }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Could not create user" }, 400);
    }
  })
  .get("/users/:id", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) {
      return c.json({ error: "Not found" }, 404);
    }
    const now = new Date();
    const pending = await prisma.userInvitation.findFirst({
      where: {
        userId: id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, createdAt: true }
    });
    return c.json({
      user: mapUser(user as UserRow),
      pendingInvitation: pending
    });
  })
  .patch("/users/:id", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({
      where: { id },
      include: { roles: true }
    });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();

    const rolesInBody = body.roles !== undefined;
    const newRoles: Role[] | null = rolesInBody ? parseRoleArray(body.roles) : null;
    if (rolesInBody && !newRoles) {
      return c.json({ error: "roles must be a non-empty array of valid role values" }, 400);
    }
    if (newRoles) {
      try {
        const ownerAfter = newRoles.includes(Role.platform_owner);
        const willContributeAfter = before.status === UserStatus.active && ownerAfter;
        await assertKeepsActivePlatformOwner({
          userId: id,
          willContributeAfter,
          wasActivePlatformOwner: isActivePlatformOwner(before)
        });
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : "Invalid change" }, 400);
      }
    }

    const data: {
      email?: string;
      emailCanonical?: string;
      name?: string;
      passwordHash?: string;
      employeeId?: string | null;
    } = {};
    let bumpTokenForPassword = false;

    if (body.email !== undefined) {
      const em = emailCanonical(String(body.email));
      if (!isValidEmail(em)) {
        return c.json({ error: "Invalid email" }, 400);
      }
      data.email = em;
      data.emailCanonical = em;
    }
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return c.json({ error: "name cannot be empty" }, 400);
      }
      data.name = name;
    }
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length > 0) {
        if (password.length < 8) {
          return c.json({ error: "password must be at least 8 characters" }, 400);
        }
        if (before.status === UserStatus.invited) {
          return c.json({ error: "Set password through invitation acceptance, not admin PATCH" }, 400);
        }
        data.passwordHash = await bcrypt.hash(password, 12);
        bumpTokenForPassword = true;
      }
    }
    if (body.employeeId !== undefined) {
      if (body.employeeId === null || body.employeeId === "") {
        data.employeeId = null;
      } else {
        const eid = String(body.employeeId);
        const emp = await prisma.employee.findUnique({ where: { id: eid } });
        if (!emp) {
          return c.json({ error: "employeeId not found" }, 400);
        }
        data.employeeId = eid;
      }
    }

    const hasScalar = Object.keys(data).length > 0;
    if (!hasScalar && !newRoles) {
      return c.json({ error: "No fields to update" }, 400);
    }
    const needTokenBump = bumpTokenForPassword || Boolean(newRoles);
    const scalarPatch: Prisma.UserUpdateInput = { ...data };
    if (needTokenBump) {
      scalarPatch.tokenVersion = { increment: 1 };
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (newRoles) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          if (newRoles.length > 0) {
            await tx.userRole.createMany({ data: newRoles.map((role) => ({ userId: id, role })) });
          }
        }
        if (hasScalar) {
          await tx.user.update({ where: { id }, data: scalarPatch });
        } else if (newRoles) {
          await tx.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
        }
      });
    } catch (e) {
      if (isUniqueConstraintError(e)) {
        return c.json({ error: "That email or employee is already linked to a user" }, 409);
      }
      return c.json({ error: e instanceof Error ? e.message : "Update failed" }, 400);
    }

    const after = await prisma.user.findUniqueOrThrow({ where: { id }, select: userSelect });
    const afterMapped = mapUser(after as UserRow);
    const now = new Date();
    const pending = await prisma.userInvitation.findFirst({
      where: {
        userId: id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now }
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, expiresAt: true, createdAt: true }
    });
    const beforeForAudit = {
      id: before.id,
      email: before.email,
      name: before.name,
      status: before.status,
      employeeId: before.employeeId,
      roles: before.roles.map((r) => r.role)
    };
    if (newRoles) {
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "user.admin.roles_set",
        entityType: "User",
        entityId: id,
        before: { roles: before.roles.map((r) => r.role) },
        after: { roles: newRoles }
      });
    }
    if (Object.keys(data).length > 0) {
      const meta: Record<string, boolean> = {};
      if (data.passwordHash) {
        meta.passwordChanged = true;
      }
      await writeAudit({
        actorUserId: c.get("userId"),
        action: "user.admin.update",
        entityType: "User",
        entityId: id,
        before: beforeForAudit,
        after: {
          email: afterMapped.email,
          name: afterMapped.name,
          status: afterMapped.status,
          employeeId: afterMapped.employeeId
        },
        metadata: Object.keys(meta).length ? meta : undefined
      });
    }
    return c.json({ user: afterMapped, pendingInvitation: pending });
  })
  .post("/users/:id/suspend", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status !== UserStatus.active) {
      return c.json({ error: "User must be active to suspend" }, 400);
    }
    try {
      await assertKeepsActivePlatformOwner({
        userId: id,
        willContributeAfter: false,
        wasActivePlatformOwner: isActivePlatformOwner(before)
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid change" }, 400);
    }
    const after = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.suspended, tokenVersion: { increment: 1 } },
      select: userSelect
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "user.admin.suspend",
      entityType: "User",
      entityId: id,
      before: { status: before.status },
      after: { status: after.status }
    });
    return c.json({ user: mapUser(after as UserRow) });
  })
  .post("/users/:id/deactivate", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === UserStatus.deactivated) {
      return c.json({ error: "User is already deactivated" }, 400);
    }
    try {
      await assertKeepsActivePlatformOwner({
        userId: id,
        willContributeAfter: false,
        wasActivePlatformOwner: isActivePlatformOwner(before)
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid change" }, 400);
    }
    const after = await prisma.$transaction(async (tx) => {
      await tx.userInvitation.updateMany({
        where: { userId: id, acceptedAt: null },
        data: { revokedAt: new Date() }
      });
      return tx.user.update({
        where: { id },
        data: { status: UserStatus.deactivated, tokenVersion: { increment: 1 } },
        select: userSelect
      });
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "user.admin.deactivate",
      entityType: "User",
      entityId: id,
      before: { status: before.status },
      after: { status: after.status }
    });
    return c.json({ user: mapUser(after as UserRow) });
  })
  .post("/users/:id/reactivate", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.status === UserStatus.active) {
      return c.json({ error: "User is already active" }, 400);
    }
    if (before.status === UserStatus.invited) {
      return c.json({ error: "Invited users must complete the invitation link, not reactivate" }, 400);
    }
    const after = await prisma.user.update({
      where: { id },
      data: { status: UserStatus.active, tokenVersion: { increment: 1 } },
      select: userSelect
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "user.admin.reactivate",
      entityType: "User",
      entityId: id,
      before: { status: before.status },
      after: { status: after.status }
    });
    return c.json({ user: mapUser(after as UserRow) });
  });
