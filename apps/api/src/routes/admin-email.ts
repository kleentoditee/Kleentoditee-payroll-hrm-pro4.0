/**
 * Email outbox administration (Batch 16): delivery log, manual flush,
 * failed-message retry, and SMTP transport verification (monitoring).
 */
import { prisma, requireOrgId, Role } from "@kleentoditee/db";
import { Hono } from "hono";
import { writeAudit } from "../lib/audit.js";
import {
  isEmailDeliveryConfigured,
  processEmailQueue,
  retryEmailMessage,
  verifyEmailTransport
} from "../lib/email.js";
import { authRequired, requireRole, type AuthVariables } from "../middleware/auth.js";

const CAN_VIEW = [Role.platform_owner, Role.hr_admin] as const;
const CAN_OPERATE = [Role.platform_owner] as const;

function orgScope(c: { get: (k: string) => unknown }): { orgId?: string | null } {
  const roles = (c.get("roles") as Role[]) ?? [];
  if (roles.includes(Role.platform_owner)) return {}; // sees all orgs + platform mail
  return { orgId: requireOrgId() };
}

export const adminEmailRoutes = new Hono<{ Variables: AuthVariables }>()

  .get("/email-queue", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const status = c.req.query("status");
    const where = {
      ...orgScope(c),
      ...(status ? { status: status as never } : {})
    };
    const [items, queued, sent, failed] = await Promise.all([
      prisma.emailMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true, createdAt: true, toEmail: true, subject: true, template: true,
          status: true, attempts: true, maxAttempts: true, lastError: true,
          nextAttemptAt: true, sentAt: true, orgId: true
        }
      }),
      prisma.emailMessage.count({ where: { ...orgScope(c), status: "QUEUED" } }),
      prisma.emailMessage.count({ where: { ...orgScope(c), status: "SENT" } }),
      prisma.emailMessage.count({ where: { ...orgScope(c), status: "FAILED" } })
    ]);
    return c.json({
      items,
      summary: { queued, sent, failed, smtpConfigured: isEmailDeliveryConfigured() }
    });
  })

  .post("/email-queue/process", authRequired, requireRole(...CAN_OPERATE), async (c) => {
    const result = await processEmailQueue(25);
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "email_queue.process",
      entityType: "EmailMessage",
      after: result
    });
    return c.json({ result });
  })

  .post("/email-queue/:id/retry", authRequired, requireRole(...CAN_VIEW), async (c) => {
    const id = c.req.param("id");
    const msg = await prisma.emailMessage.findUnique({ where: { id }, select: { orgId: true } });
    if (!msg) return c.json({ error: "Not found" }, 404);
    const scope = orgScope(c);
    if (scope.orgId !== undefined && msg.orgId !== scope.orgId) {
      return c.json({ error: "Not found" }, 404);
    }
    const ok = await retryEmailMessage(id);
    if (!ok) return c.json({ error: "Only FAILED messages can be retried." }, 409);
    await writeAudit({
      actorUserId: c.get("userId"),
      action: "email_queue.retry",
      entityType: "EmailMessage",
      entityId: id
    });
    return c.json({ retried: true });
  })

  .get("/email-transport/verify", authRequired, requireRole(...CAN_OPERATE), async (c) => {
    const result = await verifyEmailTransport();
    return c.json({ configured: isEmailDeliveryConfigured(), ...result });
  });
