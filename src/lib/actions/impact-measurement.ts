'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import type { CheckpointDays } from '@/lib/impact-measurement-rules';

/** Record (or correct) the actual, reviewer-reported figures for one 30/60/90-day checkpoint
 * against an Agent's baseline ROI estimate. This app has no live usage telemetry, so these are
 * always a person's own reported numbers — never inferred or estimated by the platform. */
export async function recordImpactMeasurement(
  agentId: string,
  checkpointDays: CheckpointDays,
  input: { actualMonthlyVolume: number; actualHoursSaved: number; actualSavings: number; note?: string }
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  if (!Number.isFinite(input.actualMonthlyVolume) || input.actualMonthlyVolume < 0) {
    throw new Error('Actual monthly volume must be zero or a positive number.');
  }
  if (!Number.isFinite(input.actualHoursSaved) || input.actualHoursSaved < 0) {
    throw new Error('Actual hours saved must be zero or a positive number.');
  }
  if (!Number.isFinite(input.actualSavings) || input.actualSavings < 0) {
    throw new Error('Actual savings must be zero or a positive number.');
  }

  const data = {
    actualMonthlyVolume: Math.round(input.actualMonthlyVolume),
    actualHoursSaved: input.actualHoursSaved,
    actualSavings: input.actualSavings,
    note: input.note?.trim() || null,
    recordedById: session.user.id,
    recordedAt: new Date()
  };

  await prisma.impactMeasurement.upsert({
    where: { agentId_checkpointDays: { agentId, checkpointDays } },
    update: data,
    create: { agentId, checkpointDays, ...data }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'impact_measurement.recorded',
    entityType: 'Agent',
    entityId: agentId,
    metadata: { checkpointDays }
  });

  revalidatePath('/impact-measurement');
  revalidatePath(`/impact-measurement/${agentId}`);
}
