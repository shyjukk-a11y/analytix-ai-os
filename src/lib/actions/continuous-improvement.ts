'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

/** Flag a published SOP for review — deliberately open to anyone who can be interviewed, not just
 * reviewers, since spotting a stale procedure is usually the front-line employee's job. */
export async function raiseChangeRequest(sopId: string, summary: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.conduct');

  const trimmed = summary.trim();
  if (!trimmed) throw new Error('Describe what needs to change or be reviewed.');

  const changeRequest = await prisma.changeRequest.create({
    data: { sopId, summary: trimmed, raisedById: session.user.id }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'change_request.raised',
    entityType: 'Sop',
    entityId: sopId,
    metadata: { changeRequestId: changeRequest.id }
  });

  revalidatePath('/continuous-improvement');
}

/** Mark a change request as actively being worked on. */
export async function markChangeRequestInProgress(changeRequestId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.changeRequest.update({ where: { id: changeRequestId }, data: { status: 'IN_PROGRESS' } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'change_request.in_progress',
    entityType: 'ChangeRequest',
    entityId: changeRequestId,
    metadata: {}
  });

  revalidatePath('/continuous-improvement');
}

/** Resolve a change request with an optional note on what was done about it. */
export async function resolveChangeRequest(changeRequestId: string, resolutionNote?: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.changeRequest.update({
    where: { id: changeRequestId },
    data: {
      status: 'RESOLVED',
      resolvedById: session.user.id,
      resolvedAt: new Date(),
      resolutionNote: resolutionNote?.trim() || null
    }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'change_request.resolved',
    entityType: 'ChangeRequest',
    entityId: changeRequestId,
    metadata: {}
  });

  revalidatePath('/continuous-improvement');
}
