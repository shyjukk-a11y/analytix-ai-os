'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

/** Publish a proposed AI project to the reusable Agent Library. Carries the project's title and
 * proposed approach over verbatim -- nothing new is generated, this is purely a cataloguing step
 * so other, similar opportunities elsewhere in the organization can be spotted as reuse candidates
 * (matched on AiOpportunity.key, see the Agent Library detail page). */
export async function publishAgent(opportunityId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const opportunity = await prisma.aiOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { aiProject: true }
  });

  if (!opportunity.aiProject) {
    throw new Error('Generate an AI project proposal before publishing it to the Agent Library.');
  }

  const agent = await prisma.agent.upsert({
    where: { sourceProjectId: opportunity.aiProject.id },
    update: {},
    create: {
      key: opportunity.key,
      category: opportunity.category,
      name: opportunity.title,
      description: opportunity.recommendation,
      sourceProjectId: opportunity.aiProject.id,
      publishedById: session.user.id
    }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'agent.published',
    entityType: 'AiOpportunity',
    entityId: opportunityId,
    metadata: { agentId: agent.id }
  });

  revalidatePath('/agent-library');
  revalidatePath(`/agent-library/${agent.id}`);
  revalidatePath(`/ai-projects/${opportunityId}`);
}

/** Cycle an Agent's lifecycle status: DRAFT -> ACTIVE -> RETIRED -> DRAFT. */
export async function setAgentStatus(agentId: string, status: 'DRAFT' | 'ACTIVE' | 'RETIRED'): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.agent.update({ where: { id: agentId }, data: { status } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'agent.status_changed',
    entityType: 'Agent',
    entityId: agentId,
    metadata: { status }
  });

  revalidatePath('/agent-library');
  revalidatePath(`/agent-library/${agentId}`);
}
