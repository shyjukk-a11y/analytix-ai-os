// AI interviewer turn.
//
// Drop-in alternative to the rule-based engine's `submitAnswer`: given the current
// InterviewState (which carries the project/department context) and the employee's latest
// message, it calls the model once and returns the next EngineAction, having mutated `state`
// in place — exactly the contract `performTurn` in actions/interviews.ts expects.
//
// It only drives the *question-asking* turns. AI Observation confirmation, the final summary,
// and correction requests still run through the deterministic engine functions, so the
// "employee confirms every inference" guarantee and the deterministic SOP are untouched.

import { z } from 'zod';
import { chatJSON, type ChatMessage } from './provider';
import {
  buildSummaryAction,
  DIM_KEYS,
  type EngineAction,
  type InterviewContext,
  type InterviewState,
  type Language,
  type ObservationCategory
} from '../interview-engine';

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  hi: 'Hindi',
  ar: 'Arabic',
  zh: 'Chinese',
  ml: 'Malayalam'
};

const OBS_CATEGORY: Record<string, ObservationCategory> = {
  duplicateEntry: 'OBSERVATION',
  docDependency: 'BOTTLENECK',
  knowledgeRisk: 'KNOWLEDGE_RISK',
  manualFollowUp: 'OBSERVATION',
  authorityCheck: 'OBSERVATION',
  bottleneckGeneral: 'BOTTLENECK'
};

const DepEnum = z.enum(['client', 'otherDept', 'manager', 'authority', 'vendor', 'external']);
const ProbEnum = z.enum(['manualWork', 'repeatedEntry', 'waiting', 'followUp', 'missingDocs', 'errors', 'rework', 'delays', 'unclearResp']);
const ObsKeyEnum = z.enum(['duplicateEntry', 'docDependency', 'knowledgeRisk', 'manualFollowUp', 'authorityCheck', 'bottleneckGeneral']);
const Score = z.coerce.number().catch(0);

const TurnSchema = z.object({
  reply: z.string().min(1),
  updates: z
    .object({
      department: z.string(),
      role: z.string(),
      processName: z.string(),
      trigger: z.string(),
      outcome: z.string(),
      frequency: z.string(),
      checker: z.string(),
      rejectionHandling: z.string(),
      waitDetail: z.string(),
      newSteps: z.array(
        z.object({ text: z.string().min(1), owner: z.string().optional(), systems: z.array(z.string()).optional() })
      ),
      systems: z.array(z.string()),
      dependencies: z.array(DepEnum),
      problems: z.array(ProbEnum),
      exceptions: z.array(z.string()),
      knowledge: z.array(z.string()),
      templates: z.array(z.string()),
      otherProcessesMentioned: z.array(z.string())
    })
    .partial()
    .default({}),
  coverage: z
    .object({
      start: Score,
      workflow: Score,
      roles: Score,
      systems: Score,
      controls: Score,
      waiting: Score,
      exceptions: Score,
      knowledge: Score,
      aiOpp: Score,
      kpis: Score
    })
    .partial()
    .default({}),
  observations: z.array(z.object({ key: ObsKeyEnum, text: z.string().min(1) })).default([]),
  validation: z
    .object({
      answersQuestion: z.boolean().default(true),
      gaps: z.array(z.string()).default([]),
      contradictions: z.array(z.string()).default([])
    })
    .default({ answersQuestion: true, gaps: [], contradictions: [] }),
  readyToWrapUp: z.boolean().default(false)
});

function line(label: string, value: string | null | undefined): string {
  const v = (value ?? '').trim();
  return v ? `- ${label}: ${v.replace(/\s*\n\s*/g, '; ')}` : '';
}

function systemPrompt(ctx: InterviewContext, language: Language): string {
  const langName = LANGUAGE_NAMES[language] ?? 'English';
  return [
    `You are "Alex", an AI process consultant for Analytix. You are interviewing an employee to capture EXACTLY how they do their work today, so a Standard Operating Procedure can be generated from it.`,
    `You do NOT write the SOP — a deterministic template does that from the facts you capture. Your job is to CAPTURE, never to summarise, embellish, or invent.`,
    ``,
    `CONTEXT YOU ALREADY HAVE — do not ask the employee to repeat it; confirm it and build on it:`,
    line('Employee', `${ctx.employeeName}${ctx.employeeJobTitle ? `, ${ctx.employeeJobTitle}` : ''}`),
    line('Department', `${ctx.departmentName}${ctx.serviceArea ? ` (${ctx.serviceArea})` : ''}`),
    line('Project / area', `${ctx.projectName}${ctx.projectDescription ? ` — ${ctx.projectDescription}` : ''}`),
    line('Purpose of this interview', ctx.interviewObjective),
    line('Business objective', ctx.businessObjective),
    line('In scope', ctx.inScopeActivities),
    line('Out of scope (do NOT chase these)', ctx.outOfScopeActivities),
    line('Systems the project expects', ctx.currentSystems),
    line('Pain points already suspected', ctx.existingPainPoints),
    line('Mandatory checks', ctx.mandatoryChecks),
    line('Mandatory approvals', ctx.mandatoryApprovals),
    line('Volume', ctx.currentVolume),
    line('Staffing', ctx.currentManpower),
    ``,
    `HOW TO INTERVIEW:`,
    `- Reply in ${langName}. One clear question at a time. Short, plain language, no jargon.`,
    `- Briefly acknowledge what they said, then ask the next thing ("Got it — so after X, what happens next?").`,
    `- Confirm the basics you already know, then spend the conversation on THEIR real step-by-step: what starts a case, each step in order (who does it, in which system), what marks it finished, where they wait, what goes wrong, and know-how that isn't written down.`,
    `- If an answer is vague ("I check the documents"), probe it ("check them for what, exactly?").`,
    `- If they describe several different jobs, pick ONE process to walk through fully this session; put the rest in updates.otherProcessesMentioned. Do not try to cover them all at once.`,
    `- Treat the suspected pain points as things to probe gently, not as leading questions.`,
    `- Never record a fact the employee did not actually state.`,
    `- Set readyToWrapUp = true only once you have a complete start-to-finish picture: trigger, ordered steps, outcome, systems, checks/approvals, delays, exceptions, and know-how.`,
    ``,
    `AI OBSERVATIONS — add to "observations" (max once each) only when the conversation clearly shows it; the employee will confirm it separately:`,
    `- duplicateEntry: the same data entered into more than one system`,
    `- docDependency: progress waits on documents/inputs from a client or third party`,
    `- knowledgeRisk: important know-how lives only in someone's head`,
    `- manualFollowUp: chasing people for updates/inputs is done manually`,
    `- authorityCheck: someone manually checks an external/government system for status`,
    `- bottleneckGeneral: waiting/follow-up is clearly a major source of delay`,
    ``,
    `OUTPUT — reply with ONLY a JSON object:`,
    `{`,
    `  "reply": string,                       // what you say next, in ${langName}, one message`,
    `  "updates": {                           // ONLY fields newly established or changed this turn; omit the rest`,
    `    "department"|"role"|"processName"|"trigger"|"outcome"|"frequency"|"checker"|"rejectionHandling"|"waitDetail": string,`,
    `    "newSteps": [{ "text": string, "owner"?: string, "systems"?: string[] }],`,
    `    "systems": string[], "dependencies": ("client"|"otherDept"|"manager"|"authority"|"vendor"|"external")[],`,
    `    "problems": ("manualWork"|"repeatedEntry"|"waiting"|"followUp"|"missingDocs"|"errors"|"rework"|"delays"|"unclearResp")[],`,
    `    "exceptions": string[], "knowledge": string[], "templates": string[], "otherProcessesMentioned": string[]`,
    `  },`,
    `  "coverage": { "start","workflow","roles","systems","controls","waiting","exceptions","knowledge","aiOpp","kpis": 0-100 },`,
    `  "observations": [{ "key": string, "text": string }],`,
    `  "validation": { "answersQuestion": boolean, "gaps": string[], "contradictions": string[] },`,
    `  "readyToWrapUp": boolean`,
    `}`
  ]
    .filter((l) => l !== '')
    .join('\n');
}

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pushUnique(list: string[], values: string[] | undefined) {
  if (!values) return;
  for (const raw of values) {
    const v = raw.trim();
    if (v && !list.some((x) => x.toLowerCase() === v.toLowerCase())) list.push(v);
  }
}

function historyForModel(state: InterviewState): ChatMessage[] {
  const hist = state.llmHistory ?? [];
  return hist.slice(-30).map((m) => ({ role: m.role, content: m.content }));
}

/**
 * Run one AI interviewer turn. Mutates `state` and returns the next EngineAction. On any model
 * or network failure it degrades to a plain re-ask rather than throwing, so a hiccup never
 * kills an in-progress interview.
 */
export async function runInterviewerTurn(state: InterviewState, answerText: string): Promise<EngineAction> {
  const answer = answerText.trim();
  const ctx = state.context;
  if (!ctx) {
    // Should not happen (caller checks), but never throw from here.
    return { kind: 'ai_message', text: 'Thanks. Could you tell me a bit more?', questionKey: 'llm' };
  }

  state.transcript.push({ q: 'llm', a: answer });
  state.llmHistory = [...(state.llmHistory ?? []), { role: 'user', content: answer }];
  const wasCorrection = state.stage === 'correctionAsk';

  let turn: z.infer<typeof TurnSchema>;
  try {
    turn = await chatJSON({
      system: systemPrompt(ctx, state.language),
      messages: historyForModel(state),
      schema: TurnSchema,
      temperature: 0.4,
      maxTokens: 1400
    });
  } catch (err) {
    console.error('[interviewer] turn failed:', err instanceof Error ? err.message : err);
    const msg =
      "I'm having trouble connecting right now — give it a moment and send your last message again.";
    state.llmHistory = [...(state.llmHistory ?? []), { role: 'assistant', content: msg }];
    return { kind: 'ai_message', text: msg, questionKey: 'llm' };
  }

  // --- apply captured facts (additive; scalars set when the model reports them this turn) ---
  const u = turn.updates;
  if (u.department) state.department = u.department;
  if (u.role) state.role = u.role;
  if (u.processName) state.name = u.processName.slice(0, 80);
  if (u.trigger) state.trigger = u.trigger;
  if (u.outcome) state.outcome = u.outcome;
  if (u.frequency) state.frequency = u.frequency;
  if (u.checker) state.checkerDetail = u.checker;
  if (u.rejectionHandling) state.rejectionHandling = u.rejectionHandling;
  if (u.waitDetail) state.waitDetail = u.waitDetail;

  for (const s of u.newSteps ?? []) {
    state.steps.push({ text: s.text.trim(), owner: (s.owner || state.role || 'Employee').trim(), systems: (s.systems ?? []).map((x) => x.trim()).filter(Boolean) });
  }
  for (const sys of u.systems ?? []) {
    const v = sys.trim();
    if (v) state.systemsMentioned[v] = true;
  }
  for (const d of u.dependencies ?? []) state.deps[d] = true;
  for (const p of u.problems ?? []) (state.problems as Record<string, boolean>)[p] = true;
  pushUnique(state.exceptions, u.exceptions);
  pushUnique(state.knowledge, u.knowledge);
  pushUnique(state.templates, u.templates);

  // --- coverage + completeness ---
  for (const k of DIM_KEYS) {
    const v = (turn.coverage as Record<string, number | undefined>)[k];
    if (typeof v === 'number') state.dims[k] = clamp100(v);
  }
  state.completeness = Math.round(DIM_KEYS.reduce((acc, k) => acc + (state.dims[k] || 0), 0) / DIM_KEYS.length);

  // --- reviewer notes ---
  const otherProcesses: string[] = [];
  pushUnique(otherProcesses, u.otherProcessesMentioned);
  state.llmNotes = {
    gaps: turn.validation.gaps.slice(0, 12),
    contradictions: turn.validation.contradictions.slice(0, 12),
    otherProcesses
  };

  // --- queue AI observations (deduped; each only once) ---
  for (const obs of turn.observations) {
    if (state.obsGiven[obs.key]) continue;
    state.obsGiven[obs.key] = true;
    state.pendingObs.push({ key: obs.key, category: OBS_CATEGORY[obs.key] ?? 'OBSERVATION', text: obs.text.trim() });
  }

  state.llmHistory = [...(state.llmHistory ?? []), { role: 'assistant', content: turn.reply }];

  // --- decide what to show next ---
  if (state.pendingObs.length > 0) {
    state.stage = 'observations';
    const next = state.pendingObs.shift()!;
    return { kind: 'observation', observationKey: next.key, category: next.category, text: next.text };
  }

  const readyEnough = state.completeness >= 55 && state.steps.length >= 3;
  if (wasCorrection || (turn.readyToWrapUp && readyEnough)) {
    state.stage = 'summary';
    return buildSummaryAction(state);
  }

  state.stage = 'llm';
  state.lastQKey = 'llm';
  return { kind: 'ai_message', text: turn.reply, questionKey: 'llm' };
}
