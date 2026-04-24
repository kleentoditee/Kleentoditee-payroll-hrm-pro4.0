import { AccountType, ProductKind, Role, prisma } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [
  Role.platform_owner,
  Role.hr_admin,
  Role.payroll_admin,
  Role.finance_admin,
  Role.operations_manager,
  Role.site_supervisor
] as const;

const CAN_EDIT = [Role.platform_owner, Role.finance_admin] as const;

function parseAccountType(v: unknown): AccountType | null {
  if (v === "asset" || v === "liability" || v === "equity" || v === "revenue" || v === "expense") {
    return v;
  }
  return null;
}

function parseProductKind(v: unknown): ProductKind | null {
  if (v === "service" || v === "product" || v === "bundle") {
    return v;
  }
  return null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export const financeRoutes = new Hono<{ Variables: AuthVariables }>()
  // ---------- Chart of Accounts ----------
  .get("/accounts", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const type = parseAccountType(c.req.query("type"));
    const activeParam = c.req.query("active");
    const items = await prisma.account.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(activeParam === "true" || activeParam === "false"
          ? { active: activeParam === "true" }
          : {})
      },
      orderBy: [{ code: "asc" }]
    });
    return c.json({ items });
  })
  .get("/accounts/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const row = await prisma.account.findUnique({
      where: { id },
      include: { parent: true, children: { orderBy: { code: "asc" } } }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ account: row });
  })
  .post("/accounts", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const code = str(body.code);
    const name = str(body.name);
    const type = parseAccountType(body.type);
    if (!code || !name || !type) {
      return c.json({ error: "code, name, and type are required." }, 400);
    }
    let parentId: string | null = null;
    if (body.parentId !== undefined && body.parentId !== null && str(body.parentId) !== "") {
      parentId = str(body.parentId);
      const parent = await prisma.account.findUnique({ where: { id: parentId } });
      if (!parent) {
        return c.json({ error: "parentId not found." }, 400);
      }
      if (parent.type !== type) {
        return c.json({ error: "Parent account type must match child type." }, 400);
      }
    }
    const existing = await prisma.account.findUnique({ where: { code } });
    if (existing) {
      return c.json({ error: `Account code "${code}" already exists.` }, 409);
    }
    const row = await prisma.account.create({
      data: {
        code,
        name,
        type,
        subtype: str(body.subtype),
        description: str(body.description),
        active: body.active !== undefined ? Boolean(body.active) : true,
        parentId
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "account.create",
      entityType: "Account",
      entityId: row.id,
      after: row
    });
    return c.json({ account: row }, 201);
  })
  .patch("/accounts/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.account.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.code !== undefined) {
      const code = str(body.code);
      if (!code) {
        return c.json({ error: "code cannot be empty." }, 400);
      }
      if (code !== before.code) {
        const clash = await prisma.account.findUnique({ where: { code } });
        if (clash) {
          return c.json({ error: `Account code "${code}" already exists.` }, 409);
        }
      }
      data.code = code;
    }
    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) {
        return c.json({ error: "name cannot be empty." }, 400);
      }
      data.name = name;
    }

    let nextType: AccountType = before.type;
    if (body.type !== undefined) {
      const type = parseAccountType(body.type);
      if (!type) {
        return c.json({ error: "Invalid type." }, 400);
      }
      data.type = type;
      nextType = type;
    }

    if (body.parentId !== undefined) {
      const raw = body.parentId;
      if (raw === null || str(raw) === "") {
        data.parentId = null;
      } else {
        const parentId = str(raw);
        if (parentId === id) {
          return c.json({ error: "An account cannot be its own parent." }, 400);
        }
        const parent = await prisma.account.findUnique({ where: { id: parentId } });
        if (!parent) {
          return c.json({ error: "parentId not found." }, 400);
        }
        if (parent.type !== nextType) {
          return c.json({ error: "Parent account type must match child type." }, 400);
        }
        data.parentId = parentId;
      }
    }

    if (body.subtype !== undefined) {
      data.subtype = str(body.subtype);
    }
    if (body.description !== undefined) {
      data.description = str(body.description);
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.account.update({ where: { id }, data: data as never });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "account.update",
      entityType: "Account",
      entityId: id,
      before,
      after: row
    });
    return c.json({ account: row });
  })
  .delete("/accounts/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.account.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const childCount = await prisma.account.count({ where: { parentId: id } });
    if (childCount > 0) {
      return c.json({ error: "Reassign or remove sub-accounts before deleting this account." }, 409);
    }
    const productUse = await prisma.product.count({
      where: { OR: [{ incomeAccountId: id }, { expenseAccountId: id }] }
    });
    if (productUse > 0) {
      return c.json({ error: "Account is mapped to products/services; reassign them first." }, 409);
    }
    await prisma.account.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "account.delete",
      entityType: "Account",
      entityId: id,
      before
    });
    return c.body(null, 204);
  })

  // ---------- Customers ----------
  .get("/customers", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const items = await prisma.customer.findMany({
      where: q
        ? {
            OR: [
              { displayName: { contains: q } },
              { companyName: { contains: q } },
              { email: { contains: q } }
            ]
          }
        : undefined,
      orderBy: { displayName: "asc" }
    });
    return c.json({ items });
  })
  .get("/customers/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const row = await prisma.customer.findUnique({ where: { id: c.req.param("id") } });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ customer: row });
  })
  .post("/customers", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const displayName = str(body.displayName);
    if (!displayName) {
      return c.json({ error: "displayName is required." }, 400);
    }
    const existing = await prisma.customer.findUnique({ where: { displayName } });
    if (existing) {
      return c.json({ error: `Customer "${displayName}" already exists.` }, 409);
    }
    const row = await prisma.customer.create({
      data: {
        displayName,
        companyName: str(body.companyName),
        primaryContact: str(body.primaryContact),
        email: str(body.email),
        phone: str(body.phone),
        billingAddress: str(body.billingAddress),
        taxId: str(body.taxId),
        notes: str(body.notes),
        active: body.active !== undefined ? Boolean(body.active) : true
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "customer.create",
      entityType: "Customer",
      entityId: row.id,
      after: row
    });
    return c.json({ customer: row }, 201);
  })
  .patch("/customers/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.displayName !== undefined) {
      const displayName = str(body.displayName);
      if (!displayName) {
        return c.json({ error: "displayName cannot be empty." }, 400);
      }
      if (displayName !== before.displayName) {
        const clash = await prisma.customer.findUnique({ where: { displayName } });
        if (clash) {
          return c.json({ error: `Customer "${displayName}" already exists.` }, 409);
        }
      }
      data.displayName = displayName;
    }
    for (const key of [
      "companyName",
      "primaryContact",
      "email",
      "phone",
      "billingAddress",
      "taxId",
      "notes"
    ] as const) {
      if (body[key] !== undefined) {
        data[key] = str(body[key]);
      }
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.customer.update({ where: { id }, data: data as never });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "customer.update",
      entityType: "Customer",
      entityId: id,
      before,
      after: row
    });
    return c.json({ customer: row });
  })
  .delete("/customers/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.customer.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.customer.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "customer.delete",
      entityType: "Customer",
      entityId: id,
      before
    });
    return c.body(null, 204);
  })

  // ---------- Suppliers ----------
  .get("/suppliers", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const items = await prisma.supplier.findMany({
      where: q
        ? {
            OR: [
              { displayName: { contains: q } },
              { companyName: { contains: q } },
              { email: { contains: q } }
            ]
          }
        : undefined,
      orderBy: { displayName: "asc" }
    });
    return c.json({ items });
  })
  .get("/suppliers/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const row = await prisma.supplier.findUnique({ where: { id: c.req.param("id") } });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ supplier: row });
  })
  .post("/suppliers", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const displayName = str(body.displayName);
    if (!displayName) {
      return c.json({ error: "displayName is required." }, 400);
    }
    const existing = await prisma.supplier.findUnique({ where: { displayName } });
    if (existing) {
      return c.json({ error: `Supplier "${displayName}" already exists.` }, 409);
    }
    const row = await prisma.supplier.create({
      data: {
        displayName,
        companyName: str(body.companyName),
        primaryContact: str(body.primaryContact),
        email: str(body.email),
        phone: str(body.phone),
        mailingAddress: str(body.mailingAddress),
        taxId: str(body.taxId),
        notes: str(body.notes),
        active: body.active !== undefined ? Boolean(body.active) : true
      }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "supplier.create",
      entityType: "Supplier",
      entityId: row.id,
      after: row
    });
    return c.json({ supplier: row }, 201);
  })
  .patch("/suppliers/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.supplier.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.displayName !== undefined) {
      const displayName = str(body.displayName);
      if (!displayName) {
        return c.json({ error: "displayName cannot be empty." }, 400);
      }
      if (displayName !== before.displayName) {
        const clash = await prisma.supplier.findUnique({ where: { displayName } });
        if (clash) {
          return c.json({ error: `Supplier "${displayName}" already exists.` }, 409);
        }
      }
      data.displayName = displayName;
    }
    for (const key of [
      "companyName",
      "primaryContact",
      "email",
      "phone",
      "mailingAddress",
      "taxId",
      "notes"
    ] as const) {
      if (body[key] !== undefined) {
        data[key] = str(body[key]);
      }
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.supplier.update({ where: { id }, data: data as never });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "supplier.update",
      entityType: "Supplier",
      entityId: id,
      before,
      after: row
    });
    return c.json({ supplier: row });
  })
  .delete("/suppliers/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.supplier.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.supplier.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "supplier.delete",
      entityType: "Supplier",
      entityId: id,
      before
    });
    return c.body(null, 204);
  })

  // ---------- Products / Services ----------
  .get("/products", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const q = (c.req.query("q") ?? "").trim().toLowerCase();
    const kind = parseProductKind(c.req.query("kind"));
    const items = await prisma.product.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(q
          ? {
              OR: [
                { sku: { contains: q } },
                { name: { contains: q } },
                { description: { contains: q } }
              ]
            }
          : {})
      },
      include: {
        incomeAccount: true,
        expenseAccount: true
      },
      orderBy: { name: "asc" }
    });
    return c.json({ items });
  })
  .get("/products/:id", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const row = await prisma.product.findUnique({
      where: { id: c.req.param("id") },
      include: { incomeAccount: true, expenseAccount: true }
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ product: row });
  })
  .post("/products", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const body = await c.req.json<Record<string, unknown>>();
    const sku = str(body.sku);
    const name = str(body.name);
    const incomeAccountId = str(body.incomeAccountId);
    if (!sku || !name || !incomeAccountId) {
      return c.json({ error: "sku, name, and incomeAccountId are required." }, 400);
    }
    const kind = parseProductKind(body.kind) ?? ProductKind.service;
    const income = await prisma.account.findUnique({ where: { id: incomeAccountId } });
    if (!income) {
      return c.json({ error: "incomeAccountId not found." }, 400);
    }
    if (income.type !== AccountType.revenue) {
      return c.json({ error: "incomeAccountId must reference a revenue account." }, 400);
    }
    let expenseAccountId: string | null = null;
    if (body.expenseAccountId !== undefined && body.expenseAccountId !== null && str(body.expenseAccountId) !== "") {
      expenseAccountId = str(body.expenseAccountId);
      const expense = await prisma.account.findUnique({ where: { id: expenseAccountId } });
      if (!expense) {
        return c.json({ error: "expenseAccountId not found." }, 400);
      }
      if (expense.type !== AccountType.expense) {
        return c.json({ error: "expenseAccountId must reference an expense account." }, 400);
      }
    }
    const existing = await prisma.product.findUnique({ where: { sku } });
    if (existing) {
      return c.json({ error: `Product SKU "${sku}" already exists.` }, 409);
    }
    const row = await prisma.product.create({
      data: {
        sku,
        name,
        kind,
        description: str(body.description),
        salesPrice: Number(body.salesPrice ?? 0),
        purchaseCost: Number(body.purchaseCost ?? 0),
        taxable: body.taxable !== undefined ? Boolean(body.taxable) : false,
        active: body.active !== undefined ? Boolean(body.active) : true,
        incomeAccountId,
        expenseAccountId
      },
      include: { incomeAccount: true, expenseAccount: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "product.create",
      entityType: "Product",
      entityId: row.id,
      after: row
    });
    return c.json({ product: row }, 201);
  })
  .patch("/products/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    const body = await c.req.json<Record<string, unknown>>();
    const data: Record<string, unknown> = {};

    if (body.sku !== undefined) {
      const sku = str(body.sku);
      if (!sku) {
        return c.json({ error: "sku cannot be empty." }, 400);
      }
      if (sku !== before.sku) {
        const clash = await prisma.product.findUnique({ where: { sku } });
        if (clash) {
          return c.json({ error: `Product SKU "${sku}" already exists.` }, 409);
        }
      }
      data.sku = sku;
    }
    if (body.name !== undefined) {
      const name = str(body.name);
      if (!name) {
        return c.json({ error: "name cannot be empty." }, 400);
      }
      data.name = name;
    }
    if (body.kind !== undefined) {
      const kind = parseProductKind(body.kind);
      if (!kind) {
        return c.json({ error: "Invalid kind." }, 400);
      }
      data.kind = kind;
    }
    if (body.description !== undefined) {
      data.description = str(body.description);
    }
    if (body.salesPrice !== undefined) {
      data.salesPrice = Number(body.salesPrice);
    }
    if (body.purchaseCost !== undefined) {
      data.purchaseCost = Number(body.purchaseCost);
    }
    if (body.taxable !== undefined) {
      data.taxable = Boolean(body.taxable);
    }
    if (body.active !== undefined) {
      data.active = Boolean(body.active);
    }
    if (body.incomeAccountId !== undefined) {
      const incomeAccountId = str(body.incomeAccountId);
      if (!incomeAccountId) {
        return c.json({ error: "incomeAccountId cannot be empty." }, 400);
      }
      const income = await prisma.account.findUnique({ where: { id: incomeAccountId } });
      if (!income) {
        return c.json({ error: "incomeAccountId not found." }, 400);
      }
      if (income.type !== AccountType.revenue) {
        return c.json({ error: "incomeAccountId must reference a revenue account." }, 400);
      }
      data.incomeAccountId = incomeAccountId;
    }
    if (body.expenseAccountId !== undefined) {
      const raw = body.expenseAccountId;
      if (raw === null || str(raw) === "") {
        data.expenseAccountId = null;
      } else {
        const expenseAccountId = str(raw);
        const expense = await prisma.account.findUnique({ where: { id: expenseAccountId } });
        if (!expense) {
          return c.json({ error: "expenseAccountId not found." }, 400);
        }
        if (expense.type !== AccountType.expense) {
          return c.json({ error: "expenseAccountId must reference an expense account." }, 400);
        }
        data.expenseAccountId = expenseAccountId;
      }
    }

    if (Object.keys(data).length === 0) {
      return c.json({ error: "No fields to update." }, 400);
    }

    const row = await prisma.product.update({
      where: { id },
      data: data as never,
      include: { incomeAccount: true, expenseAccount: true }
    });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "product.update",
      entityType: "Product",
      entityId: id,
      before,
      after: row
    });
    return c.json({ product: row });
  })
  .delete("/products/:id", authRequired, requireRole(...CAN_EDIT), async (c) => {
    const id = c.req.param("id");
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) {
      return c.json({ error: "Not found" }, 404);
    }
    await prisma.product.delete({ where: { id } });
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "product.delete",
      entityType: "Product",
      entityId: id,
      before
    });
    return c.body(null, 204);
  });
