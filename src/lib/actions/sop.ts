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
  if (process.status === 'NEEDS_REVIEW') {
    throw new Error('This process has conflicting inputs from more than one interview — resolve them first.');
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


/**
 * Resolve a process flagged NEEDS_REVIEW (two or more completed interviews disagreed on how the
 * process actually works — see compareProcessFacts / checkProcessForConflicts). The reviewer
 * picks, for every field that disagreed, which interview's answer to keep, and which interview's
 * step sequence to keep. This never rewrites either employee's original interview — their
 * stateJson stays exactly as they gave it, for audit purposes — it instead records the reviewer's
 * decision as a new Interview authored by the reviewer, built from the chosen base interview's
 * full state with just the disputed fields overridden. Because it's a normal completed Interview
 * with completeness 100 and the most recent startedAt, pickPrimaryInterview naturally treats it as
 * the process's source of truth afterwards for every downstream read view (Digital Twin, SOP,
 * Process Maps) — no other code needs to know reconciliation happened.
 */
export async function resolveProcessConflict(
  processId: string,
  resolution: {
    baseInterviewId: string;
    overrides: Partial<Record<'role' | 'frequency' | 'trigger' | 'outcome' | 'checkerDetail' | 'rejectionHandling', string>>;
    stepsFromInterviewId?: string;
    note?: string;
  }
): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const process = await prisma.process.findUniqueOrThrow({ where: { id: processId } });
  if (process.status !== 'NEEDS_REVIEW') {
    throw new Error('This process is not currently flagged for review.');
  }

  const base = await prisma.interview.findUniqueOrThrow({ where: { id: resolution.baseInterviewId } });
  if (base.processId !== processId) {
    throw new Error("That interview does not belong to this process.");
  }

  const state = JSON.parse(base.stateJson) as InterviewState;

  for (const [field, value] of Object.entries(resolution.overrides)) {
    if (value !== undefined) {
      (state as Record<string, unknown>)[field] = value;
    }
  }

  let stepsFromInterviewId = resolution.baseInterviewId;
  if (resolution.stepsFromInterviewId && resolution.stepsFromInterviewId !== resolution.baseInterviewId) {
    const stepsSource = await prisma.interview.findUniqueOrThrow({ where: { id: resolution.stepsFromInterviewId } });
    if (stepsSource.processId !== processId) {
      throw new Error("That interview does not belong to this process.");
    }
    const stepsState = JSON.parse(stepsSource.stateJson) as InterviewState;
    state.steps = stepsState.steps;
    state.systemsMentioned = stepsState.systemsMentioned;
    stepsFromInterviewId = resolution.stepsFromInterviewId;
  }

  const reconciled = await prisma.interview.create({
    data: {
      processId,
      employeeId: session.user.id,
      language: state.language,
      status: 'COMPLETED',
      stateJson: JSON.stringify(state),
      completeness: 100,
      completedAt: new Date()
    }
  });

  await prisma.process.update({ where: { id: processId }, data: { status: 'COMPLETE' } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'process.reconciled',
    entityType: 'Process',
    entityId: processId,
    metadata: {
      baseInterviewId: resolution.baseInterviewId,
      stepsFromInterviewId,
      overrides: resolution.overrides,
      note: resolution.note ?? null,
      reconciledInterviewId: reconciled.id
    }
  });

  revalidatePath('/sop-library');
  revalidatePath(`/sop-library/${processId}`);
  revalidatePath(`/sop-library/${processId}/reconcile`);
  revalidatePath('/ai-interviews');
  revalidatePath('/digital-twin');
  revalidatePath('/process-discovery');
}
