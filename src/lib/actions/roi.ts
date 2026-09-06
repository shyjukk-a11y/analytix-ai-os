'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { calculateRoiNumbers, buildAssumptions } from '@/lib/roi-rules';

/** Calculate (or recalculate) the deterministic ROI estimate for an AI opportunity, from
 * reviewer-supplied inputs. Gated by interview.review, mirroring the AI Project generate action. */
export async function calculateRoi(
  opportunityId: string,
  input: { monthlyVolume: number; costPerHour: number }
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  if (!Number.isFinite(input.monthlyVolume) || input.monthlyVolume <= 0) {
    throw new Error('Monthly case volume must be a positive number.');
  }
  if (!Number.isFinite(input.costPerHour) || input.costPerHour <= 0) {
    throw new Error('Cost per hour must be a positive number.');
  }

  const opportunity = await prisma.aiOpportunity.findUniqueOrThrow({ where: { id: opportunityId } });

  const numbers = calculateRoiNumbers({
    impact: opportunity.impact,
    monthlyVolume: input.monthlyVolume,
    costPerHour: input.costPerHour
  });
  const assumptions = buildAssumptions({
    impact: opportunity.impact,
    monthlyVolume: input.monthlyVolume,
    minutesPerCase: numbers.minutesPerCase,
    costPerHour: input.costPerHour
  });

  const data = {
    monthlyVolume: input.monthlyVolume,
    minutesSavedPerCase: numbers.minutesPerCase,
    costPerHour: input.costPerHour,
    hoursSavedPerMonth: numbers.hoursSavedPerMonth,
    monthlySavingsEstimate: numbers.monthlySavingsEstimate,
    annualSavingsEstimate: numbers.annualSavingsEstimate,
    assumptions,
    calculatedById: session.user.id,
    calculatedAt: new Date()
  };

  await prisma.roiEstimate.upsert({
    where: { opportunityId },
    update: data,
    create: { opportunityId, ...data }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'roi.calculated',
    entityType: 'AiOpportunity',
    entityId: opportunityId,
    metadata: { monthlyVolume: input.monthlyVolume, costPerHour: input.costPerHour }
  });

  revalidatePath('/roi');
  revalidatePath(`/roi/${opportunityId}`);
}
