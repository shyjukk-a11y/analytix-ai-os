import type { EngineAction, InterviewState, ObservationCategory } from './interview-engine';

/**
 * Reconstruct "what should be shown right now" for an interview that's being (re)loaded from the
 * database, without re-invoking any engine logic (which has shift/mutate side effects on
 * state.pendingObs that must only ever happen once, when the turn is actually taken).
 *
 * Priority order: an unresolved AI Observation card always wins (it was shown but never
 * answered); then a completed interview shows its closing message; then a summary awaiting
 * confirm-or-correction; otherwise the last question asked is re-shown so the employee can answer it.
 */
export function buildResumeAction(
  state: InterviewState,
  lastAiMessageText: string | undefined,
  pendingObs: { key: string; category: string; text: string } | undefined
): EngineAction {
  if (pendingObs) {
    return { kind: 'observation', observationKey: pendingObs.key, category: pendingObs.category as ObservationCategory, text: pendingObs.text };
  }
  if (state.completed) {
    return { kind: 'completed', text: lastAiMessageText ?? '' };
  }
  if (state.stage === 'summary') {
    // recordActionMessage() persisted this as `${introText}\n\n${summaryText}` — reverse it by
    // splitting on the first blank line, since summaryIntro itself never contains one.
    const combined = lastAiMessageText ?? '';
    const sepIdx = combined.indexOf('\n\n');
    const introText = sepIdx >= 0 ? combined.slice(0, sepIdx) : combined;
    const summaryText = sepIdx >= 0 ? combined.slice(sepIdx + 2) : '';
    return { kind: 'summary', introText, summaryText };
  }
  return { kind: 'ai_message', text: lastAiMessageText ?? '', questionKey: state.lastQKey ?? '' };
}
