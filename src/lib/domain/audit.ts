import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Audit logging.
 *
 * Every clinical write goes through here. The log is the reason nothing needs to be
 * mutable: a correction is a new row, and this records who made it, from where.
 */

export interface AuditInput {
  actorId: string | null;
  actorRole: Role | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  request?: Request;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const headers = input.request?.headers;

  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: (input.before ?? undefined) as object | undefined,
      after: (input.after ?? undefined) as object | undefined,
      ip:
        headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        headers?.get("x-real-ip") ??
        null,
      userAgent: headers?.get("user-agent") ?? null,
    },
  });
}
