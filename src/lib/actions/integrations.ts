'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

/** Records configuration metadata for a connector -- this app has no real credentials for any of
 * these systems, so this is deliberately just a config-status record, never a live connection
 * test or sync. */
export async function configureIntegration(id: string, input: { name: string; endpointOrNote?: string }): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'admin.manage');

  const name = input.name.trim();
  if (!name) throw new Error('Give this connector a name.');

  await prisma.integration.update({
    where: { id },
    data: {
      name,
      endpointOrNote: input.endpointOrNote?.trim() || null,
      status: 'CONFIGURED',
      configuredById: session.user.id,
      configuredAt: new Date()
    }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'integration.configured',
    entityType: 'Integration',
    entityId: id,
    metadata: {}
  });

  revalidatePath('/integrations');
}

export async function disconnectIntegration(id: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'admin.manage');

  await prisma.integration.update({
    where: { id },
    data: { status: 'NOT_CONFIGURED', endpointOrNote: null, configuredById: null, configuredAt: null }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'integration.disconnected',
    entityType: 'Integration',
    entityId: id,
    metadata: {}
  });

  revalidatePath('/integrations');
}
