import { prisma } from '@/lib/prisma';

export async function writeAuditLog(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      }
    });
  } catch (err) {
    // Audit logging must never break the primary action it's observing.
    console.error('[audit] failed to write audit log', err);
  }
}
