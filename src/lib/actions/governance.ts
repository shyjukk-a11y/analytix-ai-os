'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { writeAuditLog } from '@/lib/audit';
import { STAGE_SEQUENCE, currentStage, computeGovernanceStatus } from '@/lib/governance-rules';

/** Start (or restart-after-rejection, for a fresh AiProject that never went through review) the
 * fixed 6-stage governance chain for a proposed AI project. Gated the same as managing the
 * project itself. Idempotent: calling it again once stages already exist is a no-op. */
export async function startGovernanceReview(aiProjectId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const aiProject = await prisma.aiProject.findUniqueOrThrow({
    where: { id: aiProjectId },
    include: { governanceStages: true }
  });

  if (aiProject.status !== 'PROPOSED') {
    throw new Error('Only a proposed AI project can enter governance review.');
  }
  if (aiProject.governanceStages.length > 0) {
    return; // already started
  }

  await prisma.governanceStage.createMany({
    data: STAGE_SEQUENCE.map((s) => ({
      aiProjectId,
      stageOrder: s.order,
      role: s.role,
      status: 'PENDING'
    }))
  });
  await prisma.aiProject.update({ where: { id: aiProjectId }, data: { governanceStatus: 'IN_REVIEW' } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'governance.started',
    entityType: 'AiProject',
    entityId: aiProjectId,
    metadata: {}
  });

  revalidatePath('/governance');
  revalidatePath(`/governance/${aiProject.opportunityId}`);
  revalidatePath('/approvals');
}

/** Decide the current (and only actionable) stage of a governance chain. Only the stage's own
 * required role -- or an administrator, mirroring every other owner-or-admin gate in this app --
 * may decide it, and only once every earlier stage has been approved. */
export async function decideGovernanceStage(
  stageId: string,
  decision: 'APPROVED' | 'REJECTED',
  comment?: string
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');

  const stage = await prisma.governanceStage.findUniqueOrThrow({
    where: { id: stageId },
    include: { aiProject: { include: { governanceStages: true } } }
  });

  const isAdmin = session.user.role === Role.ADMINISTRATOR;
  if (!isAdmin && session.user.role !== stage.role) {
    throw new Error(`This stage requires sign-off from ${stage.role.replaceAll('_', ' ')}.`);
  }

  const current = currentStage(stage.aiProject.governanceStages);
  if (!current || current.id !== stage.id) {
    throw new Error('This stage is not currently awaiting a decision.');
  }

  await prisma.governanceStage.update({
    where: { id: stageId },
    data: {
      status: decision,
      decidedById: session.user.id,
      decidedAt: new Date(),
      comment: comment?.trim() || null
    }
  });

  const refreshedStages = await prisma.governanceStage.findMany({ where: { aiProjectId: stage.aiProjectId } });
  const newStatus = computeGovernanceStatus(refreshedStages);

  await prisma.aiProject.update({
    where: { id: stage.aiProjectId },
    data: {
      governanceStatus: newStatus,
      productionAt: newStatus === 'APPROVED' ? new Date() : null
    }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: decision === 'APPROVED' ? 'governance.stage_approved' : 'governance.stage_rejected',
    entityType: 'GovernanceStage',
    entityId: stageId,
    metadata: { aiProjectId: stage.aiProjectId, stageOrder: stage.stageOrder, role: stage.role, comment: comment ?? null }
  });

  revalidatePath('/governance');
  revalidatePath(`/governance/${stage.aiProject.opportunityId}`);
  revalidatePath('/approvals');
}

/** Reset every stage back to PENDING (clearing decisions) so a rejected proposal can be
 * resubmitted for review after rework -- gated the same as starting a review. */
export async function restartGovernanceReview(aiProjectId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const aiProject = await prisma.aiProject.findUniqueOrThrow({ where: { id: aiProjectId } });

  await prisma.governanceStage.updateMany({
    where: { aiProjectId },
    data: { status: 'PENDING', decidedById: null, decidedAt: null, comment: null }
  });
  await prisma.aiProject.update({ where: { id: aiProjectId }, data: { governanceStatus: 'IN_REVIEW', productionAt: null } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'governance.restarted',
    entityType: 'AiProject',
    entityId: aiProjectId,
    metadata: {}
  });

  revalidatePath('/governance');
  revalidatePath(`/governance/${aiProject.opportunityId}`);
  revalidatePath('/approvals');
}
