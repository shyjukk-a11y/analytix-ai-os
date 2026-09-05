'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan, can, ForbiddenError } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { writeAuditLog } from '@/lib/audit';
import {
  beginInterview,
  submitAnswer as engineSubmitAnswer,
  resolveObservation as engineResolveObservation,
  confirmSummary as engineConfirmSummary,
  needCorrection as engineNeedCorrection,
  type InterviewState,
  type EngineAction,
  type Language
} from '@/lib/interview-engine';

// Server actions for Phase 2 (AI Interviews — capture only). These wrap the deterministic,
// rule-based engine in src/lib/interview-engine.ts: the engine owns all interview logic and
// operates on a plain InterviewState object, while this file's only job is persistence (Prisma),
// access control, and audit logging — see README's Phase 2 notes.
//
// Design note on state vs. DB: the full InterviewState is round-tripped to the client after every
// turn (returned alongside the EngineAction) so the chat UI can drive itself locally, exactly like
// the Phase 0 HTML prototype did with its single in-memory state object. The DB copy
// (Interview.stateJson) plus the normalized InterviewMessage / InterviewStepRecord /
// InterviewObservation tables exist so an interview can be resumed after a reload and so Phase 3+
// modules (and reviewers) can query the captured facts without re-parsing JSON.
//
// Two access paths call into the same turn logic below:
//  - the authenticated path (submitInterviewAnswer etc.) — the caller must be signed in as the
//    interview's own employee (or an administrator).
//  - the guest/invite-link path (submitGuestInterviewAnswer etc.) — no session at all; instead the
//    interview must have a non-null inviteLinkId, proving it was created by startInterviewFromInviteLink
//    for a pre-selected staff member. A normal employee's session-protected interview always has
//    inviteLinkId = null, so it can never be reached through the guest functions.

const OBSERVATION_STATUS: Record<string, string> = {
  confirmed: 'CONFIRMED',
  partly: 'PARTLY',
  rejected: 'REJECTED'
};

// Mirrors deriveAiOpportunities()'s key -> category assignment in interview-engine.ts, so a
// resolved observation that (unexpectedly) has no pre-existing PENDING row still gets the right
// category instead of defaulting to OBSERVATION.
const OBSERVATION_CATEGORY: Record<string, string> = {
  duplicateEntry: 'OBSERVATION',
  docDependency: 'BOTTLENECK',
  knowledgeRisk: 'KNOWLEDGE_RISK',
  manualFollowUp: 'OBSERVATION',
  authorityCheck: 'OBSERVATION',
  bottleneckGeneral: 'BOTTLENECK'
};

type Actor = { userId: string; isAdmin: boolean } | null;

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new ForbiddenError('You must be signed in.');
  return session;
}

async function loadInterviewForActor(interviewId: string, actor: Actor) {
  const interview = await prisma.interview.findUniqueOrThrow({ where: { id: interviewId } });
  if (actor) {
    const isOwner = interview.employeeId === actor.userId;
    if (!isOwner && !actor.isAdmin) {
      throw new ForbiddenError('This interview belongs to another employee.');
    }
  } else if (!interview.inviteLinkId) {
    // Never let an unauthenticated caller touch an interview that wasn't created via an invite link.
    throw new ForbiddenError('This interview requires signing in.');
  }
  const state = JSON.parse(interview.stateJson) as InterviewState;
  return { interview, state };
}

/** Persist one engine action (an AI chat bubble) as an InterviewMessage row. */
async function recordActionMessage(interviewId: string, action: EngineAction) {
  let text: string;
  let questionKey: string | null;
  if (action.kind === 'ai_message') {
    text = action.text;
    questionKey = action.questionKey;
  } else if (action.kind === 'observation') {
    text = action.text;
    questionKey = action.observationKey;
  } else if (action.kind === 'summary') {
    text = `${action.introText}\n\n${action.summaryText}`;
    questionKey = null;
  } else {
    text = action.text;
    questionKey = null;
  }
  await prisma.interviewMessage.create({ data: { interviewId, sender: 'AI', questionKey, text } });
}

/** Re-sync the flat walkthrough-step table from the engine state's `steps` array. */
async function syncSteps(interviewId: string, state: InterviewState) {
  await prisma.interviewStepRecord.deleteMany({ where: { interviewId } });
  if (state.steps.length) {
    await prisma.interviewStepRecord.createMany({
      data: state.steps.map((s, idx) => ({
        interviewId,
        stepIndex: idx,
        text: s.text,
        owner: s.owner,
        systems: s.systems.join(', ') || null
      }))
    });
  }
}

/**
 * Re-sync InterviewObservation rows from engine state.
 * - The observation currently being shown (if any) gets a PENDING row, so a page reload between
 *   the card appearing and the employee clicking Yes/Partly/No doesn't lose track of it (the
 *   engine itself removes it from state.pendingObs the moment it's shown — see nextObservationAction).
 * - Every resolved entry in state.aiObservations gets its row created/updated to the final status.
 */
async function syncObservations(interviewId: string, state: InterviewState, currentAction: EngineAction) {
  if (currentAction.kind === 'observation') {
    const existing = await prisma.interviewObservation.findFirst({
      where: { interviewId, key: currentAction.observationKey }
    });
    if (!existing) {
      await prisma.interviewObservation.create({
        data: {
          interviewId,
          key: currentAction.observationKey,
          category: currentAction.category,
          text: currentAction.text,
          status: 'PENDING'
        }
      });
    }
  }

  for (const obs of state.aiObservations) {
    const status = OBSERVATION_STATUS[obs.status] ?? 'PENDING';
    const existing = await prisma.interviewObservation.findFirst({ where: { interviewId, key: obs.key } });
    if (existing) {
      if (existing.status !== status) {
        await prisma.interviewObservation.update({ where: { id: existing.id }, data: { status, resolvedAt: new Date() } });
      }
    } else {
      await prisma.interviewObservation.create({
        data: {
          interviewId,
          key: obs.key,
          category: OBSERVATION_CATEGORY[obs.key] ?? 'OBSERVATION',
          text: obs.text,
          status,
          resolvedAt: new Date()
        }
      });
    }
  }
}

/** Keep the parent Process row's name/department/status in step with what the interview has learned. */
async function syncProcess(processId: string, state: InterviewState) {
  const data: { name?: string; department?: string; status?: string } = {};
  if (state.name) data.name = state.name;
  if (state.department) data.department = state.department;
  if (state.completed) data.status = 'COMPLETE';
  if (Object.keys(data).length) {
    await prisma.process.update({ where: { id: processId }, data });
  }
}

/**
 * On interview completion, upsert each distinct knowledge/template statement the employee
 * mentioned as a KnowledgeItem row, so Phase 3's Knowledge Base module has it immediately without
 * re-parsing stateJson. Deduped per process by exact text via the model's compound unique index,
 * so a second employee describing the same process doesn't create noisy duplicates.
 */
async function syncKnowledgeItemsOnCompletion(processId: string, interviewId: string, state: InterviewState) {
  const rows: { category: string; text: string }[] = [
    ...state.knowledge.map((text) => ({ category: 'KNOWLEDGE', text })),
    ...state.templates.map((text) => ({ category: 'TEMPLATE', text }))
  ];
  for (const row of rows) {
    await prisma.knowledgeItem.upsert({
      where: { processId_category_text: { processId, category: row.category, text: row.text } },
      update: {},
      create: { processId, category: row.category, text: row.text, sourceInterviewId: interviewId }
    });
  }
}

async function persistTurn(params: { interviewId: string; processId: string; state: InterviewState; action: EngineAction }) {
  const { interviewId, processId, state, action } = params;
  await recordActionMessage(interviewId, action);
  await syncSteps(interviewId, state);
  await syncObservations(interviewId, state, action);
  await syncProcess(processId, state);
  await prisma.interview.update({
    where: { id: interviewId },
    data: {
      stateJson: JSON.stringify(state),
      completeness: state.completeness,
      status: state.completed ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: state.completed ? new Date() : undefined
    }
  });
}

/**
 * Shared core for every "take a turn" action (authenticated or guest): load + ownership-check the
 * interview, record the employee's side of this turn as a chat message, run the engine, persist
 * the result, and — if this turn completed the interview — audit-log it and extract its knowledge.
 */
async function performTurn(
  interviewId: string,
  actor: Actor,
  buildEmployeeMessage: (state: InterviewState) => { text: string; questionKey: string | null },
  run: (state: InterviewState) => EngineAction
): Promise<{ action: EngineAction; state: InterviewState }> {
  const { interview, state } = await loadInterviewForActor(interviewId, actor);
  if (state.completed) throw new Error('This interview is already completed.');

  const { text, questionKey } = buildEmployeeMessage(state);
  await prisma.interviewMessage.create({ data: { interviewId, sender: 'EMPLOYEE', questionKey, text } });

  const action = run(state);
  await persistTurn({ interviewId, processId: interview.processId, state, action });

  if (state.completed) {
    await syncKnowledgeItemsOnCompletion(interview.processId, interviewId, state);

    await writeAuditLog({
      actorId: actor?.userId ?? null,
      action: 'interview.completed',
      entityType: 'Interview',
      entityId: interviewId,
      metadata: {}
    });
    revalidatePath('/ai-interviews');
    revalidatePath('/process-discovery');
    revalidatePath('/digital-twin');
    revalidatePath('/knowledge-base');
  }

  return { action, state };
}

/** Start a brand-new interview (and its Process) for a project, for the signed-in employee themselves. */
export async function startInterview(projectId: string, language: Language): Promise<string> {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.conduct');

  const project = await prisma.aiTransformationProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { department: true }
  });

  const process = await prisma.process.create({
    data: { projectId, department: project.department.name, createdById: session.user.id }
  });

  const { state, messages } = beginInterview(language);

  const interview = await prisma.interview.create({
    data: {
      processId: process.id,
      employeeId: session.user.id,
      language,
      stateJson: JSON.stringify(state),
      completeness: state.completeness
    }
  });

  for (const action of messages) {
    await recordActionMessage(interview.id, action);
  }

  await writeAuditLog({
    actorId: session.user.id,
    action: 'interview.started',
    entityType: 'Interview',
    entityId: interview.id,
    metadata: { projectId, language }
  });

  revalidatePath('/ai-interviews');
  return interview.id;
}

/**
 * Open (or resume) the interview behind an active invite link — no session required. If the
 * pre-selected staff member already has an in-progress interview from this exact link, that same
 * interview is resumed rather than starting over.
 */
export async function startInterviewFromInviteLink(token: string): Promise<string> {
  const link = await prisma.interviewInviteLink.findUnique({
    where: { token },
    include: { project: { include: { department: true } } }
  });
  if (!link || !link.active) {
    throw new Error('This interview link is no longer active. Please ask for a new one.');
  }

  const existing = await prisma.interview.findFirst({
    where: { inviteLinkId: link.id, status: 'IN_PROGRESS' },
    orderBy: { startedAt: 'desc' }
  });
  if (existing) return existing.id;

  const process = await prisma.process.create({
    data: { projectId: link.projectId, department: link.project.department.name, createdById: link.createdById }
  });

  const { state, messages } = beginInterview(link.language as Language);

  const interview = await prisma.interview.create({
    data: {
      processId: process.id,
      employeeId: link.employeeId,
      language: link.language,
      stateJson: JSON.stringify(state),
      completeness: state.completeness,
      inviteLinkId: link.id
    }
  });

  for (const action of messages) {
    await recordActionMessage(interview.id, action);
  }

  await writeAuditLog({
    actorId: null,
    action: 'interview.started_via_link',
    entityType: 'Interview',
    entityId: interview.id,
    metadata: { projectId: link.projectId, linkId: link.id, employeeId: link.employeeId }
  });

  return interview.id;
}

/** Submit the employee's free-text answer to the current question (signed-in employee). */
export async function submitInterviewAnswer(interviewId: string, text: string) {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.conduct');
  return performTurn(
    interviewId,
    { userId: session.user.id, isAdmin: session.user.role === Role.ADMINISTRATOR },
    (state) => ({ text, questionKey: state.lastQKey }),
    (state) => engineSubmitAnswer(state, text)
  );
}

/** Resolve an AI Observation confirmation card — signed-in employee. */
export async function resolveInterviewObservation(interviewId: string, observationKey: string, status: 'confirmed' | 'partly' | 'rejected') {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.conduct');
  const label = status === 'confirmed' ? 'Confirmed' : status === 'partly' ? 'Partly confirmed' : 'Not applicable';
  return performTurn(
    interviewId,
    { userId: session.user.id, isAdmin: session.user.role === Role.ADMINISTRATOR },
    () => ({ text: label, questionKey: observationKey }),
    (state) => engineResolveObservation(state, observationKey, status)
  );
}

/** The employee confirms the generated summary is correct — completes the interview (signed-in). */
export async function confirmInterviewSummary(interviewId: string) {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.conduct');
  return performTurn(
    interviewId,
    { userId: session.user.id, isAdmin: session.user.role === Role.ADMINISTRATOR },
    () => ({ text: 'Confirmed — summary is correct.', questionKey: null }),
    (state) => engineConfirmSummary(state)
  );
}

/** The employee says the summary needs a correction — reopens one free-text turn (signed-in). */
export async function requestInterviewCorrection(interviewId: string) {
  const session = await requireSession();
  assertCan(session.user.role, 'interview.conduct');
  return performTurn(
    interviewId,
    { userId: session.user.id, isAdmin: session.user.role === Role.ADMINISTRATOR },
    () => ({ text: 'Requesting a correction.', questionKey: null }),
    (state) => engineNeedCorrection(state)
  );
}

/**
 * Permanently delete an interview (and, via onDelete: Cascade, its messages/steps/observations).
 * Allowed for the interview's own employee, an administrator, or anyone with interview.review
 * (department heads / process owners / committee / management) — the same audience that can
 * already see it listed under "All interviews (review)".
 */
export async function deleteInterview(interviewId: string): Promise<void> {
  const session = await requireSession();
  const interview = await prisma.interview.findUniqueOrThrow({ where: { id: interviewId } });

  const isOwner = interview.employeeId === session.user.id;
  const isAdmin = session.user.role === Role.ADMINISTRATOR;
  const isReviewer = can(session.user.role, 'interview.review');
  if (!isOwner && !isAdmin && !isReviewer) {
    throw new ForbiddenError('You do not have permission to delete this interview.');
  }

  await prisma.interview.delete({ where: { id: interviewId } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'interview.deleted',
    entityType: 'Interview',
    entityId: interviewId,
    metadata: {}
  });

  revalidatePath('/ai-interviews');
}

// ---------------------------------------------------------------------------
// Guest (invite-link) turn actions — no session. See loadInterviewForActor: these only ever
// succeed against an interview whose inviteLinkId is set.
// ---------------------------------------------------------------------------

export async function submitGuestInterviewAnswer(interviewId: string, text: string) {
  return performTurn(
    interviewId,
    null,
    (state) => ({ text, questionKey: state.lastQKey }),
    (state) => engineSubmitAnswer(state, text)
  );
}

export async function resolveGuestInterviewObservation(interviewId: string, observationKey: string, status: 'confirmed' | 'partly' | 'rejected') {
  const label = status === 'confirmed' ? 'Confirmed' : status === 'partly' ? 'Partly confirmed' : 'Not applicable';
  return performTurn(
    interviewId,
    null,
    () => ({ text: label, questionKey: observationKey }),
    (state) => engineResolveObservation(state, observationKey, status)
  );
}

export async function confirmGuestInterviewSummary(interviewId: string) {
  return performTurn(
    interviewId,
    null,
    () => ({ text: 'Confirmed — summary is correct.', questionKey: null }),
    (state) => engineConfirmSummary(state)
  );
}

export async function requestGuestInterviewCorrection(interviewId: string) {
  return performTurn(
    interviewId,
    null,
    () => ({ text: 'Requesting a correction.', questionKey: null }),
    (state) => engineNeedCorrection(state)
  );
}
