// Shared fact-extraction & label maps over InterviewState.
//
// Phase 2's InterviewChat "Captured so far" panel and Phase 3's read-only modules (Process
// Digital Twin, SOP generator, Knowledge Base extraction, Process Maps, Bottlenecks) all need to
// turn a persisted InterviewState (Interview.stateJson) into the same human-readable facts. This
// module is the single source of truth for that derivation so all of them render identically and
// none of them re-implement (and risk drifting from) the label maps.
import type { DimKey, InterviewState } from './interview-engine';

export const DEP_LABELS: Record<string, string> = {
  client: 'Client',
  otherDept: 'Other department',
  manager: 'Manager / supervisor',
  authority: 'External authority',
  vendor: 'Vendor / supplier',
  external: 'External consultant'
};

export const PROBLEM_LABELS: Record<string, string> = {
  manualWork: 'Manual work',
  repeatedEntry: 'Repeated data entry',
  waiting: 'Waiting on something',
  followUp: 'Manual follow-up needed',
  missingDocs: 'Missing documents',
  errors: 'Errors',
  rework: 'Rework',
  delays: 'Delays',
  unclearResp: 'Unclear responsibility',
  noChecklist: 'No documented checklist'
};

export const DIM_LABELS: Record<DimKey, string> = {
  start: 'Basics',
  workflow: 'Workflow',
  roles: 'Roles',
  systems: 'Systems',
  controls: 'Controls',
  waiting: 'Waiting / delays',
  exceptions: 'Exceptions',
  knowledge: 'Knowledge',
  aiOpp: 'AI opportunities',
  kpis: 'Wrap-up'
};

export const OBS_STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  partly: 'warning',
  rejected: 'neutral'
};

export type ProcessFacts = {
  department: string | null;
  role: string | null;
  name: string | null;
  trigger: string | null;
  outcome: string | null;
  frequency: string | null;
  checker: string | null;
  checkerDetail: string | null;
  rejectionHandling: string | null;
  waitDetail: string | null;
  steps: { text: string; owner: string; systems: string[] }[];
  systems: string[];
  activeDeps: { key: string; label: string }[];
  activeProblems: { key: string; label: string }[];
  exceptions: string[];
  knowledge: string[];
  templates: string[];
  aiObservations: { text: string; status: string; key: string }[];
  dims: { key: DimKey; label: string; value: number }[];
  completeness: number;
};

/**
 * Pure derivation of the "facts panel" shape from a persisted InterviewState — no side effects,
 * safe to call from a Server Component or a client component render.
 */
export function extractProcessFacts(state: InterviewState): ProcessFacts {
  const systems = Object.keys(state.systemsMentioned);
  const activeDeps = (Object.keys(DEP_LABELS) as (keyof typeof DEP_LABELS)[])
    .filter((k) => (state.deps as any)[k])
    .map((k) => ({ key: k, label: DEP_LABELS[k] }));
  const activeProblems = (Object.keys(PROBLEM_LABELS) as (keyof typeof PROBLEM_LABELS)[])
    .filter((k) => (state.problems as any)[k])
    .map((k) => ({ key: k, label: PROBLEM_LABELS[k] }));
  const dims = (Object.keys(DIM_LABELS) as DimKey[]).map((k) => ({ key: k, label: DIM_LABELS[k], value: state.dims[k] }));

  return {
    department: state.department,
    role: state.role,
    name: state.name,
    trigger: state.trigger,
    outcome: state.outcome,
    frequency: state.frequency,
    checker: state.checker,
    checkerDetail: state.checkerDetail,
    rejectionHandling: state.rejectionHandling,
    waitDetail: state.waitDetail,
    steps: state.steps,
    systems,
    activeDeps,
    activeProblems,
    exceptions: state.exceptions,
    knowledge: state.knowledge,
    templates: state.templates,
    aiObservations: state.aiObservations,
    dims,
    completeness: state.completeness
  };
}

/**
 * Pick the single "best" interview to represent a process's digital twin / SOP / process map:
 * prefer a COMPLETED interview (highest completeness, most recent as tiebreak), and fall back to
 * the most complete in-progress one if none has finished yet.
 */
export function pickPrimaryInterview<T extends { status: string; completeness: number; startedAt: Date }>(
  interviews: T[]
): T {
  const completed = interviews.filter((i) => i.status === 'COMPLETED');
  const pool = completed.length ? completed : interviews;
  return [...pool].sort((a, b) => b.completeness - a.completeness || b.startedAt.getTime() - a.startedAt.getTime())[0];
}
