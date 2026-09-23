import type { Prisma } from "@kleentoditee/db";
import { prisma } from "@kleentoditee/db";

export async function writeAudit(params: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  /** Explicit tenant tag for platform-level events outside an org scope (Batch 12). */
  orgId?: string | null;
}): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    actorUserId: params.actorUserId ?? null
  };
  if (params.orgId !== undefined) {
    data.orgId = params.orgId;
  }
  if (params.before !== undefined) {
    data.before = params.before as Prisma.InputJsonValue;
  }
  if (params.after !== undefined) {
    data.after = params.after as Prisma.InputJsonValue;
  }
  if (params.metadata !== undefined) {
    data.metadata = params.metadata as Prisma.InputJsonValue;
  }
  await prisma.auditLog.create({ data });
}
