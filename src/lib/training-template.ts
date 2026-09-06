// Deterministic training-module markdown generator (Phase 7 decision, same philosophy as
// sop-template.ts / ai-project-template.ts: templates, not a real LLM call).
//
// A training module never adds anything beyond what its source SOP already states -- it wraps
// the SOP's own procedure in a learning-oriented framing (objectives + a knowledge-check
// checklist built directly from the SOP's own steps) so a new team member can be trained from it.
export function generateTrainingModuleMarkdown(params: {
  sopTitle: string;
  processName: string;
  sopContentMd: string;
  sopSteps: string[];
  generatedAt: Date;
}): string {
  const { sopTitle, processName, sopContentMd, sopSteps, generatedAt } = params;
  const lines: string[] = [];

  lines.push(`# Training Module: ${processName}`);
  lines.push('');
  lines.push(
    `> Generated from the published Standard Operating Procedure "${sopTitle}" on ${generatedAt
      .toISOString()
      .slice(0, 10)}. This module restates that SOP for learning purposes — nothing below has been added or estimated beyond what the SOP itself already states.`
  );
  lines.push('');

  lines.push('## Learning Objectives');
  lines.push('');
  lines.push('By completing this module, a team member should be able to:');
  lines.push('- Perform each step of the procedure below, in the correct order.');
  lines.push('- Recognize the known pain points and risks flagged during process discovery.');
  lines.push("- Know what to do when a case is rejected or sent back, per the SOP's review section.");
  lines.push('');

  lines.push('## Full Procedure (from the published SOP)');
  lines.push('');
  lines.push(sopContentMd);
  lines.push('');

  lines.push('## Knowledge Check');
  lines.push('');
  if (sopSteps.length) {
    sopSteps.forEach((s) => lines.push(`- [ ] I can perform: ${s}`));
  } else {
    lines.push('_No individual steps were captured to check against._');
  }

  return lines.join('\n');
}
