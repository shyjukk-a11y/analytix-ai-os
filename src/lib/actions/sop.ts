'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { extractProcessFacts, pickPrimaryInterview } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { generateSopMarkdown } from '@/lib/sop-template';

/** (Re)generate the deterministic SOP for a process from its best available interview. Gated by
 * interview.review — the same org-wide oversight permission used everywhere else in Phase 3. */
export async function generateSop(processId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const process = await prisma.process.findUniqueOrThrow({
    where: { id: processId },
    include: {
      project: { include: { department: true } },
      interviews: { include: { employee: true } }
    }
  });

  if (process.interviews.length === 0) {
    throw new Error('This process has no captured interview to generate an SOP from.');
  }

  const primary = pickPrimaryInterview(process.interviews);
  const state = JSON.parse(primary.stateJson) as InterviewState;
  const facts = extractProcessFacts(state);

  const contentMd = generateSopMarkdown({
    processName: process.name || 'Untitled process',
    departmentName: process.project.department.name,
    projectName: process.project.name,
    employeeName: primary.employee.name,
    facts,
    generatedAt: new Date()
  });

  const title = process.name || 'Untitled process';

  await prisma.sop.upsert({
    where: { processId },
    update: { title, contentMd, status: 'DRAFT', sourceInterviewId: primary.id, generatedById: session.user.id, generatedAt: new Date() },
    create: { processId, title, contentMd, sourceInterviewId: primary.id, generatedById: session.user.id }
  });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'sop.generated',
    entityType: 'Process',
    entityId: processId,
    metadata: { sourceInterviewId: primary.id }
  });

  revalidatePath('/sop-library');
  revalidatePath(`/sop-library/${processId}`);
}

/** Toggle an existing SOP between DRAFT and PUBLISHED. */
export async function setSopStatus(processId: string, status: 'DRAFT' | 'PUBLISHED'): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  await prisma.sop.update({ where: { processId }, data: { status } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'sop.status_changed',
    entityType: 'Process',
    entityId: processId,
    metadata: { status }
  });

  revalidatePath('/sop-library');
  revalidatePath(`/sop-library/${processId}`);
}
