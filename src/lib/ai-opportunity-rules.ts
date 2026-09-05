// Deterministic content + scoring rules for Phase 4's AI Opportunities module.
//
// Every opportunity originates from a CONFIRMED or PARTLY-confirmed AI observation the engine
// raised during an interview (interview-engine.ts's deriveAiOpportunities) — never invented.
// impact/effort are transparent LOW|MEDIUM|HIGH bands derived from what was actually captured
// (pain points flagged, systems/dependencies mentioned), each with a rationale string the UI
// shows alongside the badge — no fabricated numeric score or percentage.
import type { ProcessFacts } from './process-facts';

export type Band = 'LOW' | 'MEDIUM' | 'HIGH';

// Keyed by the same observation `key` the engine uses (see interview-engine.ts's
// deriveAiOpportunities and src/lib/actions/interviews.ts's OBSERVATION_CATEGORY map).
export const OPPORTUNITY_CONTENT: Record<string, { title: string; recommendation: string }> = {
  duplicateEntry: {
    title: 'Eliminate duplicate data entry across systems',
    recommendation:
      'Introduce a one-time-entry / sync layer (e.g. system integration or RPA) so client data captured once flows automatically into every system it is currently re-typed into.'
  },
  docDependency: {
    title: 'Automate document collection & tracking',
    recommendation:
      'An automation-assisted document checklist and reminder flow that chases missing client documents automatically instead of relying on manual follow-up.'
  },
  knowledgeRisk: {
    title: 'Reduce key-person knowledge risk',
    recommendation:
      "Capture this employee's know-how into a structured, searchable knowledge base or AI assistant so the process is not dependent on one person's memory."
  },
  manualFollowUp: {
    title: 'Automate manual follow-ups',
    recommendation: 'An automated status-tracking and reminder workflow to replace manual follow-up chasing.'
  },
  authorityCheck: {
    title: 'Streamline external authority checks',
    recommendation:
      'Automated status polling or notification integration with the external authority or portal, where available, to reduce manual checking.'
  },
  bottleneckGeneral: {
    title: 'Reduce waiting time in the process',
    recommendation:
      'Investigate parallelizing or automating the step(s) causing the reported wait, or add proactive status notifications so cases do not stall silently.'
  }
};

export function deriveImpact(facts: ProcessFacts): Band {
  const n = facts.activeProblems.length;
  if (n >= 4) return 'HIGH';
  if (n >= 2) return 'MEDIUM';
  return 'LOW';
}

export function deriveEffort(facts: ProcessFacts): Band {
  const complexity = facts.systems.length + facts.activeDeps.length;
  if (complexity >= 5) return 'HIGH';
  if (complexity >= 2) return 'MEDIUM';
  return 'LOW';
}

export function impactRationale(facts: ProcessFacts): string {
  return facts.activeProblems.length
    ? `Based on ${facts.activeProblems.length} pain point${facts.activeProblems.length === 1 ? '' : 's'} the employee flagged (${facts.activeProblems
        .map((p) => p.label)
        .join(', ')}).`
    : 'No specific pain points were flagged for this process yet.';
}

export function effortRationale(facts: ProcessFacts): string {
  const parts: string[] = [];
  if (facts.systems.length) {
    parts.push(`${facts.systems.length} system${facts.systems.length === 1 ? '' : 's'} involved (${facts.systems.join(', ')})`);
  }
  if (facts.activeDeps.length) {
    parts.push(
      `${facts.activeDeps.length} external dependenc${facts.activeDeps.length === 1 ? 'y' : 'ies'} (${facts.activeDeps
        .map((d) => d.label)
        .join(', ')})`
    );
  }
  return parts.length ? `Based on ${parts.join(' and ')}.` : 'No systems or external dependencies were mentioned.';
}
