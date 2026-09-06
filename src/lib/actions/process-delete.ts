'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';

export type ProcessDependencySummary = {
  interviews: number;
  sop: boolean;
  trainingModule: boolean;
  changeRequests: number;
  knowledgeItems: number;
  aiOpportunities: number;
  aiProjects: number;
  agents: number;
  roiEstimates: number;
  governanceStages: number;
  impactMeasurements: number;
};

/**
 * Read-only: everything that would be permanently destroyed if this Process were deleted, walked
 * all the way down the real cascade chain (Process -> Interview/Sop/KnowledgeItem/AiOpportunity ->
 * AiProject -> Agent -> ImpactMeasurement, and Sop -> TrainingModule/ChangeRequest). Used to build
 * the warning in ProcessDeleteControls before any destructive action is offered — never called
 * from a delete action itself without the reviewer having seen this first.
 */
export async function getProcessDependencySummary(processId: string): Promise<ProcessDependencySummary> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const process = await prisma.process.findUniqueOrThrow({
    where: { id: processId },
    include: {
      interviews: { select: { id: true } },
      sop: { include: { trainingModule: true, changeRequests: true } },
      knowledgeItems: { select: { id: true } },
      aiOpportunities: {
        include: {
          roiEstimate: true,
          aiProject: {
            include: {
              agent: { include: { impactMeasurements: true } },
              governanceStages: true
            }
          }
        }
      }
    }
  });

  let aiProjects = 0;
  let agents = 0;
  let governanceStages = 0;
  let impactMeasurements = 0;
  let roiEstimates = 0;

  for (const opp of process.aiOpportunities) {
    if (opp.roiEstimate) roiEstimates += 1;
    if (opp.aiProject) {
      aiProjects += 1;
      governanceStages += opp.aiProject.governanceStages.length;
      if (opp.aiProject.agent) {
        agents += 1;
        impactMeasurements += opp.aiProject.agent.impactMeasurements.length;
      }
    }
  }

  return {
    interviews: process.interviews.length,
    sop: Boolean(process.sop),
    trainingModule: Boolean(process.sop?.trainingModule),
    changeRequests: process.sop?.changeRequests.length ?? 0,
    knowledgeItems: process.knowledgeItems.length,
    aiOpportunities: process.aiOpportunities.length,
    aiProjects,
    agents,
    roiEstimates,
    governanceStages,
    impactMeasurements
  };
}

function revalidateEverythingProcessTouches(processId: string) {
  for (const path of [
    '/process-discovery',
    '/digital-twin',
    `/digital-twin/${processId}`,
    '/process-maps',
    `/process-maps/${processId}`,
    '/sop-library',
    `/sop-library/${processId}`,
    '/knowledge-base',
    '/bottlenecks',
    '/ai-opportunities',
    '/ai-projects',
    '/agent-library',
    '/roi',
    '/governance',
    '/approvals',
    '/training',
    '/continuous-improvement',
    '/impact-measurement',
    '/ai-interviews'
  ]) {
    revalidatePath(path);
  }
}

/**
 * Permanently delete a process and everything built from it. Deliberately restricted to
 * Administrator: through AI Opportunities -> AI Projects -> Agents a process can cascade into
 * published agents, ROI estimates, governance sign-off history and impact measurements — none of
 * which a department head or process owner should be able to erase unilaterally. The full
 * dependency summary is captured into the audit log entry itself, since after this call the rows
 * it describes no longer exist to inspect.
 */
export async function deleteProcessCompletely(processId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'admin.manage');

  const [summary, process] = await Promise.all([
    getProcessDependencySummary(processId),
    prisma.process.findUniqueOrThrow({ where: { id: processId }, select: { name: true, projectId: true } })
  ]);

  await prisma.process.delete({ where: { id: processId } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'process.deleted',
    entityType: 'Process',
    entityId: processId,
    metadata: { name: process.name, projectId: process.projectId, deletedDependencies: summary }
  });

  revalidateEverythingProcessTouches(processId);
}

/**
 * Delete only the AI Interviews captured for this process (and their chat messages/steps/AI
 * Observation confirmations, via cascade) — the Process record itself, its SOP, Knowledge Base
 * entries, and every downstream AI Opportunity/Project/Agent/ROI/Governance/Impact record are left
 * untouched. Resets the process back to IN_PROGRESS since it no longer has any captured interview
 * to show. Available to anyone who can already review interviews, not just administrators.
 */
export async function deleteProcessInterviewsOnly(processId: string): Promise<void> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error('You must be signed in.');
  assertCan(session.user.role, 'interview.review');

  const { count } = await prisma.interview.deleteMany({ where: { processId } });
  await prisma.process.update({ where: { id: processId }, data: { status: 'IN_PROGRESS' } });

  await writeAuditLog({
    actorId: session.user.id,
    action: 'process.interviews_deleted',
    entityType: 'Process',
    entityId: processId,
    metadata: { deletedInterviewCount: count }
  });

  revalidateEverythingProcessTouches(processId);
}
