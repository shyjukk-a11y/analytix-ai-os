import { Role } from '@/lib/enums';
import { ROLE_LABELS } from '@/lib/rbac';

// Deterministic content + sequencing rules for Phase 6's Governance module.
//
// The chain is fixed and sequential: a stage can only be decided once every stage before it has
// been APPROVED (see currentStage()). This mirrors an approval workflow that runs from the person
// closest to the work (the process owner who wrote/reviewed the proposal) up through business,
// compliance, security and strategic sign-off, ending with executive approval into production.
export type GovernanceStageStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type GovernanceStatus = 'NOT_STARTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export type StageDefinition = { order: number; role: Role; label: string; description: string };

export const STAGE_SEQUENCE: StageDefinition[] = [
  {
    order: 1,
    role: Role.PROCESS_OWNER,
    label: ROLE_LABELS.PROCESS_OWNER,
    description: 'Confirms the proposal accurately reflects how the process actually works today.'
  },
  {
    order: 2,
    role: Role.DEPARTMENT_HEAD,
    label: ROLE_LABELS.DEPARTMENT_HEAD,
    description: "Business sign-off that this is worth the department's time and priority."
  },
  {
    order: 3,
    role: Role.LEGAL_COMPLIANCE_REVIEWER,
    label: ROLE_LABELS.LEGAL_COMPLIANCE_REVIEWER,
    description: 'Reviews for regulatory, contractual and policy compliance.'
  },
  {
    order: 4,
    role: Role.INFORMATION_SECURITY,
    label: ROLE_LABELS.INFORMATION_SECURITY,
    description: 'Reviews data handling, access and security posture of the proposed approach.'
  },
  {
    order: 5,
    role: Role.AI_TRANSFORMATION_COMMITTEE,
    label: ROLE_LABELS.AI_TRANSFORMATION_COMMITTEE,
    description: 'Strategic/portfolio approval alongside every other AI initiative in flight.'
  },
  {
    order: 6,
    role: Role.MANAGEMENT_CEO,
    label: ROLE_LABELS.MANAGEMENT_CEO,
    description: 'Final executive sign-off to move this into production.'
  }
];

export type StageLike = { id: string; stageOrder: number; status: string; role: string };

/** The first not-yet-decided stage, in order — the only stage that can currently be acted on.
 * Returns null once every stage has been decided (all APPROVED, or one REJECTED and nothing past
 * it was ever reachable). */
export function currentStage<T extends StageLike>(stages: T[]): T | null {
  const sorted = [...stages].sort((a, b) => a.stageOrder - b.stageOrder);
  return sorted.find((s) => s.status === 'PENDING') ?? null;
}

/** Derives the overall governance status from its stages: REJECTED if any stage was rejected,
 * APPROVED once every stage is APPROVED, IN_REVIEW while any decision is still pending. */
export function computeGovernanceStatus<T extends StageLike>(stages: T[]): GovernanceStatus {
  if (stages.length === 0) return 'NOT_STARTED';
  if (stages.some((s) => s.status === 'REJECTED')) return 'REJECTED';
  if (stages.every((s) => s.status === 'APPROVED')) return 'APPROVED';
  return 'IN_REVIEW';
}

export function approvedCount<T extends StageLike>(stages: T[]): number {
  return stages.filter((s) => s.status === 'APPROVED').length;
}
