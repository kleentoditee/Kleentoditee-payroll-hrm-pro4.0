import { prisma, Role } from "@kleentoditee/db";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
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

const userSelect = {
  id: true,
  email: true,
  name: true,
  active: true,
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
  active: boolean;
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
    active: u.active,
    employeeId: u.employeeId,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    roles: u.roles.map((r) => r.role),
    employee: u.employee
  };
}

async function countOtherActivePlatformOwners(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: {
      id: { not: excludeUserId },
      active: true,
      roles: { some: { role: Role.platform_owner } }
    }
  });
}

/** Ensures the operation would leave at least one active platform_owner. */
async function assertKeepsActivePlatformOwner(params: {
  userId: string;
  willBeActive: boolean;
  willHaveOwnerRole: boolean;
}): Promise<void> {
  const { userId, willBeActive, willHaveOwnerRole } = params;
  const willContribute = willBeActive && willHaveOwnerRole;
  if (willContribute) {
    return;
  }
  const others = await countOtherActivePlatformOwners(userId);
  if (others < 1) {
    throw new Error("The last active platform owner cannot be deactivated or stripped of the platform_owner role.");
  }
}

export const adminUserRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/users", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const qActive = c.req.query("active");
    const where =
      qActive === "true" ? { active: true } : qActive === "false" ? { active: false } : undefined;
    const items = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: userSelect
    });
    return c.json({ items: items.map((u) => mapUser(u as UserRow)) });
  })
  .post("/users", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
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
          name,
          passwordHash,
          active: true,
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
    return c.json({ user: mapUser(user as UserRow) });
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

    const willActive = body.active !== undefined ? Boolean(body.active) : before.active;
    const rolesInBody = body.roles !== undefined;
    const newRoles: Role[] | null = rolesInBody ? parseRoleArray(body.roles) : null;
    if (rolesInBody && !newRoles) {
      return c.json({ error: "roles must be a non-empty array of valid role values" }, 400);
    }
    const willHaveOwner = newRoles
      ? newRoles.includes(Role.platform_owner)
      : before.roles.some((r) => r.role === Role.platform_owner);

    try {
      await assertKeepsActivePlatformOwner({
        userId: id,
        willBeActive: willActive,
        willHaveOwnerRole: willHaveOwner
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid change" }, 400);
    }

    const data: {
      email?: string;
      name?: string;
      passwordHash?: string;
      active?: boolean;
      employeeId?: string | null;
    } = {};

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase();
      if (!isValidEmail(email)) {
        return c.json({ error: "Invalid email" }, 400);
      }
      data.email = email;
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
        data.passwordHash = await bcrypt.hash(password, 12);
      }
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
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

    try {
      await prisma.$transaction(async (tx) => {
        if (hasScalar) {
          await tx.user.update({ where: { id }, data });
        }
        if (newRoles) {
          await tx.userRole.deleteMany({ where: { userId: id } });
          if (newRoles.length > 0) {
            await tx.userRole.createMany({ data: newRoles.map((role) => ({ userId: id, role })) });
          }
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
    const beforeForAudit = {
      id: before.id,
      email: before.email,
      name: before.name,
      active: before.active,
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
          active: afterMapped.active,
          employeeId: afterMapped.employeeId
        },
        metadata: Object.keys(meta).length ? meta : undefined
      });
    }
    return c.json({ user: afterMapped });
  })
  .post("/users/:id/deactivate", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!before.active) {
      return c.json({ error: "User is already inactive" }, 400);
    }
    try {
      await assertKeepsActivePlatformOwner({
        userId: id,
        willBeActive: false,
        willHaveOwnerRole: before.roles.some((r) => r.role === Role.platform_owner)
      });
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "Invalid change" }, 400);
    }
    const after = await prisma.user.update({
      where: { id },
      data: { active: false },
      select: userSelect
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "user.admin.deactivate",
      entityType: "User",
      entityId: id,
      before: { active: true },
      after: { active: false }
    });
    return c.json({ user: mapUser(after as UserRow) });
  })
  .post("/users/:id/reactivate", authRequired, requireRole(...CAN_MANAGE), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    if (before.active) {
      return c.json({ error: "User is already active" }, 400);
    }
    const after = await prisma.user.update({ where: { id }, data: { active: true }, select: userSelect });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "user.admin.reactivate",
      entityType: "User",
      entityId: id,
      before: { active: false },
      after: { active: true }
    });
    return c.json({ user: mapUser(after as UserRow) });
  });
