// Deterministic AI project proposal / business-case markdown generator (Phase 4 decision, same
// as Phase 3's SOPs: templates, not a real LLM call). Every section either quotes what an
// employee actually said, states the deterministic recommendation rule that produced it, or
// explicitly says something wasn't captured — no fabricated ROI figures or timelines.
import type { ProcessFacts } from './process-facts';

export function generateAiProjectMarkdown(params: {
  opportunityTitle: string;
  processName: string;
  departmentName: string;
  projectName: string;
  description: string;
  recommendation: string;
  impact: string;
  impactRationale: string;
  effort: string;
  effortRationale: string;
  facts: ProcessFacts;
  generatedAt: Date;
}): string {
  const {
    opportunityTitle,
    processName,
    departmentName,
    projectName,
    description,
    recommendation,
    impact,
    impactRationale,
    effort,
    effortRationale,
    facts,
    generatedAt
  } = params;
  const lines: string[] = [];

  lines.push(`# AI Project Proposal: ${opportunityTitle}`);
  lines.push('');
  lines.push(`**Process:** ${processName}  `);
  lines.push(`**Department:** ${departmentName}  `);
  lines.push(`**Project:** ${projectName}  `);
  lines.push('');
  lines.push(
    '> Generated from a confirmed AI observation raised during an employee interview — not a real LLM call. Every claim below is either quoted from the interview or explicitly labeled as a recommendation.'
  );
  lines.push('');

  lines.push('## 1. Problem Statement');
  lines.push('');
  lines.push(description);
  lines.push('');

  lines.push('## 2. Proposed AI Approach');
  lines.push('');
  lines.push(recommendation);
  lines.push('');

  lines.push('## 3. Expected Impact');
  lines.push('');
  lines.push(`**${impact}** — ${impactRationale}`);
  lines.push('');

  lines.push('## 4. Estimated Effort / Complexity');
  lines.push('');
  lines.push(`**${effort}** — ${effortRationale}`);
  lines.push('');

  lines.push('## 5. Process Context');
  lines.push('');
  lines.push(`**Frequency:** ${facts.frequency || 'Not captured during interview'}  `);
  lines.push(`**Systems involved:** ${facts.systems.length ? facts.systems.join(', ') : 'None mentioned'}  `);
  lines.push(`**Dependencies:** ${facts.activeDeps.length ? facts.activeDeps.map((d) => d.label).join(', ') : 'None mentioned'}`);
  lines.push('');

  lines.push('## 6. Next Steps');
  lines.push('');
  lines.push('- Route to the AI Transformation Committee for review and prioritization.');
  lines.push('- Confirm technical feasibility with the Technology Team.');
  lines.push('- If approved, define a pilot scope and success metrics before full rollout.');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`_Generated ${generatedAt.toISOString().slice(0, 10)}._`);

  return lines.join('\n');
}
