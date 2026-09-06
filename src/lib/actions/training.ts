'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { extractProcessFacts } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { generateTrainingModuleMarkdown } from '@/lib/training-template';

/** (Re)generate the deterministic training module for a process's published SOP, mirroring the
 * AI Project / SOP generate-regenerate pattern. */
export async function generateTrainingModule(processId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const process = await prisma.process.findUniqueOrThrow({
    where: { id: processId },
    include: { sop: true, interviews: true }
  });

  if (!process.sop) {
    throw new Error('Generate and publish an SOP for this process before creating a training module.');
  }
  if (process.sop.status !== 'PUBLISHED') {
    throw new Error('Only a published SOP can have a training module generated.');
  }

  const sourceInterview =
    process.interviews.find((i) => i.id === process.sop!.sourceInterviewId) ?? process.interviews[0];
  if (!sourceInterview) {
    throw new Error('No interview data available to generate this training module from.');
  }
  const facts = extractProcessFacts(JSON.parse(sourceInterview.stateJson) as InterviewState);

  const contentMd = generateTrainingModuleMarkdown({
    sopTitle: process.sop.title,
    processName: process.name || 'Untitled process',
    sopContentMd: process.sop.contentMd,
    sopSteps: facts.steps.map((s) => s.text),
    generatedAt: new Date()
  });

  await prisma.trainingModule.upsert({
    where: { sopId: process.sop.id },
    update: { title: `Training: ${process.sop.title}`, contentMd, generatedById: session.user.id, generatedAt: new Date() },
    create: { sopId: process.sop.id, title: `Training: ${process.sop.title}`, contentMd, generatedById: session.user.id }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'training_module.generated',
    entityType: 'Sop',
    entityId: process.sop.id,
    metadata: {}
  });

  revalidatePath('/training');
  revalidatePath(`/training/${processId}`);
}

/** Toggle a training module between DRAFT and PUBLISHED. */
export async function setTrainingModuleStatus(processId: string, sopId: string, status: 'DRAFT' | 'PUBLISHED'): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.trainingModule.update({ where: { sopId }, data: { status } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'training_module.status_changed',
    entityType: 'Sop',
    entityId: sopId,
    metadata: { status }
  });

  revalidatePath('/training');
  revalidatePath(`/training/${processId}`);
}
