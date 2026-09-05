'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan, ForbiddenError } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { writeAuditLog } from '@/lib/audit';
import type { Language } from '@/lib/interview-engine';

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new ForbiddenError('You must be signed in.');
  return session;
}

/** Generate a shareable, no-login-required interview link for a pre-selected staff member. */
export async function createInterviewInviteLink(projectId: string, employeeId: string, language: Language): Promise<{ id: string; token: string }> {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.review');

  const link = await prisma.interviewInviteLink.create({
    data: { projectId, employeeId, language, createdById: session.user.id }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'interview_link.created',
    entityType: 'InterviewInviteLink',
    entityId: link.id,
    metadata: { projectId, employeeId, language }
  });

  revalidatePath('/ai-interviews');
  return { id: link.id, token: link.token };
}

/** Deactivate an invite link (does not affect an interview already started from it). */
export async function revokeInterviewInviteLink(linkId: string): Promise<void> {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.review');

  const link = await prisma.interviewInviteLink.findUniqueOrThrow({ where: { id: linkId } });
  const isCreator = link.createdById === session.user.id;
  const isAdmin = session.user.role === Role.ADMINISTRATOR;
  if (!isCreator && !isAdmin) {
    throw new ForbiddenError('Only the person who created this link (or an administrator) can revoke it.');
  }

  await prisma.interviewInviteLink.update({ where: { id: linkId }, data: { active: false } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'interview_link.revoked',
    entityType: 'InterviewInviteLink',
    entityId: linkId,
    metadata: {}
  });

  revalidatePath('/ai-interviews');
}
