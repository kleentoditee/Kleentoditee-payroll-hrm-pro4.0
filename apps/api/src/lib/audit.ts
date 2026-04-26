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
}): Promise<void> {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    actorUserId: params.actorUserId ?? null
  };
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
