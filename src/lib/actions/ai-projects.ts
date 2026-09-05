'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { extractProcessFacts } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { impactRationale, effortRationale } from '@/lib/ai-opportunity-rules';
import { generateAiProjectMarkdown } from '@/lib/ai-project-template';

/** (Re)generate the deterministic AI project proposal for an opportunity, from the interview it
 * originated from. Gated by interview.review, mirroring the SOP Library's generate/regenerate. */
export async function generateAiProject(opportunityId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const opportunity = await prisma.aiOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    include: { process: { include: { project: { include: { department: true } }, interviews: true } } }
  });

  const sourceInterview =
    opportunity.process.interviews.find((i) => i.id === opportunity.sourceInterviewId) ?? opportunity.process.interviews[0];
  if (!sourceInterview) {
    throw new Error('No interview data available to generate this proposal from.');
  }

  const facts = extractProcessFacts(JSON.parse(sourceInterview.stateJson) as InterviewState);

  const contentMd = generateAiProjectMarkdown({
    opportunityTitle: opportunity.title,
    processName: opportunity.process.name || 'Untitled process',
    departmentName: opportunity.process.project.department.name,
    projectName: opportunity.process.project.name,
    description: opportunity.description,
    recommendation: opportunity.recommendation,
    impact: opportunity.impact,
    impactRationale: impactRationale(facts),
    effort: opportunity.effort,
    effortRationale: effortRationale(facts),
    facts,
    generatedAt: new Date()
  });

  await prisma.aiProject.upsert({
    where: { opportunityId },
    update: { title: opportunity.title, contentMd, status: 'DRAFT', generatedById: session.user.id, generatedAt: new Date() },
    create: { opportunityId, title: opportunity.title, contentMd, generatedById: session.user.id }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'ai_project.generated',
    entityType: 'AiOpportunity',
    entityId: opportunityId,
    metadata: {}
  });

  revalidatePath('/ai-projects');
  revalidatePath(`/ai-projects/${opportunityId}`);
  revalidatePath(`/ai-opportunities/${opportunityId}`);
}

/** Toggle an existing AI project proposal between DRAFT and PROPOSED. */
export async function setAiProjectStatus(opportunityId: string, status: 'DRAFT' | 'PROPOSED'): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.aiProject.update({ where: { opportunityId }, data: { status } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'ai_project.status_changed',
    entityType: 'AiOpportunity',
    entityId: opportunityId,
    metadata: { status }
  });

  revalidatePath('/ai-projects');
  revalidatePath(`/ai-projects/${opportunityId}`);
}
