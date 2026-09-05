// Deterministic SOP markdown generator (Phase 3 decision: templates, not a real LLM call).
//
// Turns a process's captured facts (see process-facts.ts) into a structured Markdown SOP. Every
// section either quotes something the employee actually said or explicitly says it wasn't
// captured — nothing is invented, estimated, or scored.
import type { ProcessFacts } from './process-facts';

export function generateSopMarkdown(params: {
  processName: string;
  departmentName: string;
  projectName: string;
  employeeName: string;
  facts: ProcessFacts;
  generatedAt: Date;
}): string {
  const { processName, departmentName, projectName, employeeName, facts, generatedAt } = params;
  const lines: string[] = [];

  lines.push(`# Standard Operating Procedure: ${processName}`);
  lines.push('');
  lines.push(`**Department:** ${departmentName}  `);
  lines.push(`**Project:** ${projectName}  `);
  lines.push(`**Role performing this process:** ${facts.role || 'Not captured during interview'}  `);
  lines.push(`**Typical frequency:** ${facts.frequency || 'Not captured during interview'}  `);
  lines.push('');
  lines.push(
    '> This SOP was generated automatically from an AI-led employee interview. Every statement below reflects what the employee described in their own words — nothing has been invented or estimated.'
  );
  lines.push('');

  lines.push('## 1. Purpose & Trigger');
  lines.push('');
  lines.push(facts.trigger ? `This process begins when: ${facts.trigger}` : 'Trigger not captured during interview.');
  lines.push('');

  lines.push('## 2. Step-by-Step Procedure');
  lines.push('');
  if (facts.steps.length) {
    facts.steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.text}${s.systems.length ? ` _(via ${s.systems.join(', ')})_` : ''}`);
    });
  } else {
    lines.push('_No steps captured yet._');
  }
  lines.push('');

  lines.push('## 3. Completion Criteria');
  lines.push('');
  lines.push(facts.outcome || 'Not captured during interview.');
  lines.push('');

  lines.push('## 4. Systems Used');
  lines.push('');
  lines.push(facts.systems.length ? facts.systems.map((s) => `- ${s}`).join('\n') : '_None mentioned._');
  lines.push('');

  lines.push('## 5. Dependencies');
  lines.push('');
  lines.push(facts.activeDeps.length ? facts.activeDeps.map((d) => `- ${d.label}`).join('\n') : '_None mentioned._');
  lines.push('');

  lines.push('## 6. Review, Approval & Rejection Handling');
  lines.push('');
  lines.push(`**Checked / approved by:** ${facts.checkerDetail || facts.checker || 'Not captured during interview'}`);
  lines.push('');
  lines.push(`**If rejected or sent back:** ${facts.rejectionHandling || 'Not captured during interview'}`);
  lines.push('');

  lines.push('## 7. Exceptions');
  lines.push('');
  lines.push(facts.exceptions.length ? facts.exceptions.map((e) => `- ${e}`).join('\n') : '_None reported._');
  lines.push('');

  lines.push('## 8. Knowledge, Templates & Checklists Relied On');
  lines.push('');
  const knowledgeLines = [...facts.knowledge.map((k) => `- ${k}`), ...facts.templates.map((t) => `- ${t}`)];
  lines.push(knowledgeLines.length ? knowledgeLines.join('\n') : '_None reported._');
  lines.push('');

  lines.push('## 9. Known Pain Points & Risks');
  lines.push('');
  const confirmedObs = facts.aiObservations.filter((o) => o.status === 'confirmed' || o.status === 'partly');
  const riskLines = [...facts.activeProblems.map((p) => `- ${p.label}`), ...confirmedObs.map((o) => `- ${o.text}`)];
  lines.push(riskLines.length ? riskLines.join('\n') : '_None flagged during interview._');
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push(`_Generated ${generatedAt.toISOString().slice(0, 10)} from an interview with ${employeeName}._`);

  return lines.join('\n');
}
