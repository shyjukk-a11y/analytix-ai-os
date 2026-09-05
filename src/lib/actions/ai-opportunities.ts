'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

/** Lightweight triage: a reviewer can dismiss an opportunity they don't want to pursue, or
 * reopen one they dismissed by mistake. Full governance sign-off is a later phase. */
export async function setAiOpportunityStatus(id: string, status: 'IDENTIFIED' | 'DISMISSED'): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.aiOpportunity.update({ where: { id }, data: { status } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'ai_opportunity.status_changed',
    entityType: 'AiOpportunity',
    entityId: id,
    metadata: { status }
  });

  revalidatePath('/ai-opportunities');
  revalidatePath(`/ai-opportunities/${id}`);
}
