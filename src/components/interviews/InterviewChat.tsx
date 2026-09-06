'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { getButtonLabels, observationTagLabel, languageOptions, type EngineAction, type InterviewState, type Language } from '@/lib/interview-engine';
import type { InterviewSuggestions } from '@/lib/interview-suggestions';
import { extractProcessFacts, OBS_STATUS_TONE } from '@/lib/process-facts';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea, Select } from '@/components/ui/Field';

type ChatMessage = { id: string; sender: 'AI' | 'EMPLOYEE'; text: string };

type TurnResult = { action: EngineAction; state: InterviewState };

// Dependency-injected server actions so the same chat UI serves both the authenticated
// (session-gated) interview page and the public, no-login invite-link page — each passes in its
// own set of server actions (src/lib/actions/interviews.ts's authenticated vs. guest exports).
export type InterviewChatActions = {
  submitAnswer: (interviewId: string, text: string) => Promise<TurnResult>;
  resolveObservation: (interviewId: string, observationKey: string, status: 'confirmed' | 'partly' | 'rejected') => Promise<TurnResult>;
  confirmSummary: (interviewId: string) => Promise<TurnResult>;
  requestCorrection: (interviewId: string) => Promise<TurnResult>;
  // Optional: not every caller wires this up (yet), so the language switcher only renders when present.
  changeLanguage?: (interviewId: string, language: Language) => Promise<TurnResult>;
};

// Maps the four start-of-interview question keys to the matching suggestion list, so a picked
// chip can be submitted exactly like a typed answer -- see loadInterviewSuggestions.
const SUGGESTION_QUESTION_KEYS: Record<string, keyof InterviewSuggestions> = {
  qDepartment: 'departments',
  qRole: 'roles',
  qActivities: 'activities',
  qProcessName: 'processNames'
};

function actionToText(action: EngineAction): string {
  if (action.kind === 'ai_message') return action.text;
  if (action.kind === 'observation') return action.text;
  if (action.kind === 'summary') return `${action.introText}\n\n${action.summaryText}`;
  return action.text;
}

function Bubble({ message }: { message: ChatMessage }) {
  const isAi = message.sender === 'AI';
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          isAi ? 'bg-surface-muted text-slate-700' : 'bg-brand-blue text-white'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}

// Renders the exact same shape of facts (extractProcessFacts) that Phase 3's Process Digital
// Twin, SOP generator and Knowledge Base modules read from the persisted stateJson — so what an
// employee sees captured live matches what reviewers see afterwards, byte for byte.
function FactsPanel({ state }: { state: InterviewState }) {
  const facts = extractProcessFacts(state);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-950">Captured so far</h2>
        <Badge tone="brand">{facts.completeness}% complete</Badge>
      </CardHeader>
      <CardBody className="space-y-5 text-sm">
        <div className="space-y-1">
          {facts.department ? <div><span className="text-xs text-slate-400">Department: </span>{facts.department}</div> : null}
          {facts.role ? <div><span className="text-xs text-slate-400">Role: </span>{facts.role}</div> : null}
          {facts.name ? <div><span className="text-xs text-slate-400">Process: </span>{facts.name}</div> : null}
          {facts.trigger ? <div><span className="text-xs text-slate-400">Trigger: </span>{facts.trigger}</div> : null}
          {facts.outcome ? <div><span className="text-xs text-slate-400">Outcome: </span>{facts.outcome}</div> : null}
          {facts.frequency ? <div><span className="text-xs text-slate-400">Frequency: </span>{facts.frequency}</div> : null}
        </div>

        {facts.steps.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow steps</div>
            <ol className="list-decimal space-y-1.5 pl-4">
              {facts.steps.map((s, idx) => (
                <li key={idx}>
                  {s.text}
                  {s.systems.length ? <span className="text-xs text-slate-400"> · {s.systems.join(', ')}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {facts.systems.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Systems</div>
            <div className="flex flex-wrap gap-1.5">
              {facts.systems.map((s) => <Badge key={s}>{s}</Badge>)}
            </div>
          </div>
        ) : null}

        {facts.activeDeps.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Depends on</div>
            <div className="flex flex-wrap gap-1.5">
              {facts.activeDeps.map((d) => <Badge key={d.key}>{d.label}</Badge>)}
            </div>
          </div>
        ) : null}

        {facts.activeProblems.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Pain points observed</div>
            <div className="flex flex-wrap gap-1.5">
              {facts.activeProblems.map((p) => <Badge key={p.key} tone="caution">{p.label}</Badge>)}
            </div>
          </div>
        ) : null}

        {facts.exceptions.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Exceptions</div>
            <ul className="list-disc space-y-1 pl-4">{facts.exceptions.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ) : null}

        {facts.knowledge.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Knowledge relied on</div>
            <ul className="list-disc space-y-1 pl-4">{facts.knowledge.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </div>
        ) : null}

        {facts.aiObservations.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">AI observations</div>
            <div className="space-y-1.5">
              {facts.aiObservations.map((o, i) => (
                <div key={i} className="flex items-start justify-between gap-2">
                  <span className="text-slate-600">{o.text}</span>
                  <Badge tone={OBS_STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Coverage by dimension</div>
          <div className="space-y-1.5">
            {facts.dims.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-slate-500">{d.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${d.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export function InterviewChat({
  interviewId,
  initialMessages,
  initialState,
  initialAction,
  readOnly,
  actions,
  suggestions
}: {
  interviewId: string;
  initialMessages: ChatMessage[];
  initialState: InterviewState;
  initialAction: EngineAction;
  readOnly: boolean;
  // Required unless readOnly — enforced at the call sites, not by the type, since a reviewer
  // viewing someone else's interview never needs a set of actions at all.
  actions?: InterviewChatActions;
  // Optional "pick from these" values for the department/role/activities/process-name questions —
  // see loadInterviewSuggestions. Undefined (or an empty list for the current question) just means
  // no chips render; free-text entry always still works.
  suggestions?: InterviewSuggestions;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [engineState, setEngineState] = useState<InterviewState>(initialState);
  const [currentAction, setCurrentAction] = useState<EngineAction>(initialAction);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const labels = getButtonLabels(engineState.language);
  let localId = 0;
  const nextId = () => `local-${Date.now()}-${localId++}`;

  function pushEmployeeMessage(text: string) {
    setMessages((m) => [...m, { id: nextId(), sender: 'EMPLOYEE', text }]);
  }

  function applyResult(action: EngineAction, state: InterviewState) {
    setMessages((m) => [...m, { id: nextId(), sender: 'AI', text: actionToText(action) }]);
    setEngineState(state);
    setCurrentAction(action);
  }

  function handleSend(override?: string) {
    const text = (override ?? inputText).trim();
    if (!text) return;
    setInputText('');
    setError(null);
    pushEmployeeMessage(text);
    startTransition(async () => {
      try {
        const { action, state } = await actions!.submitAnswer(interviewId, text);
        applyResult(action, state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong sending your answer.');
      }
    });
  }

  function handleObservation(observationKey: string, status: 'confirmed' | 'partly' | 'rejected') {
    const label = status === 'confirmed' ? labels.yes : status === 'partly' ? labels.partly : labels.no;
    setError(null);
    pushEmployeeMessage(label);
    startTransition(async () => {
      try {
        const { action, state } = await actions!.resolveObservation(interviewId, observationKey, status);
        applyResult(action, state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong recording that.');
      }
    });
  }

  function handleConfirm() {
    setError(null);
    pushEmployeeMessage(labels.confirm);
    startTransition(async () => {
      try {
        const { action, state } = await actions!.confirmSummary(interviewId);
        applyResult(action, state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong confirming the summary.');
      }
    });
  }

  function handleCorrection() {
    setError(null);
    pushEmployeeMessage(labels.correction);
    startTransition(async () => {
      try {
        const { action, state } = await actions!.requestCorrection(interviewId);
        applyResult(action, state);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong requesting a correction.');
      }
    });
  }

  function handleLanguageChange(language: Language) {
    if (!actions?.changeLanguage || language === engineState.language) return;
    setError(null);
    startTransition(async () => {
      try {
        const { action, state } = await actions.changeLanguage!(interviewId, language);
        // A plain question or an AI Observation card is re-shown as a fresh bubble, translated;
        // a summary/completed message stays exactly as originally shown (see changeLanguageCore's
        // doc comment) — only the language (and therefore button labels) switches for those.
        if (action.kind === 'ai_message' || action.kind === 'observation') {
          applyResult(action, state);
        } else {
          setEngineState(state);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not change the interview language.');
      }
    });
  }

  const obsAction = currentAction.kind === 'observation' ? currentAction : null;

  const currentSuggestions =
    !readOnly && suggestions && currentAction.kind === 'ai_message' && SUGGESTION_QUESTION_KEYS[currentAction.questionKey]
      ? suggestions[SUGGESTION_QUESTION_KEYS[currentAction.questionKey]]
      : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="flex h-[70vh] flex-col">
          {!readOnly && actions?.changeLanguage ? (
            <CardHeader className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-xs font-medium text-slate-500">Language</span>
              <Select
                value={engineState.language}
                disabled={isPending}
                onChange={(e) => handleLanguageChange(e.target.value as Language)}
                className="w-auto py-1.5 text-xs"
              >
                {languageOptions().map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </CardHeader>
          ) : null}
          <CardBody className="flex-1 space-y-3 overflow-y-auto">
            {messages.map((m) => <Bubble key={m.id} message={m} />)}
            {obsAction ? (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl border border-surface-border bg-white px-4 py-3">
                  <div className="mb-2">
                    <Badge tone="warning">{observationTagLabel(engineState.language, obsAction.category)}</Badge>
                  </div>
                  {!readOnly ? (
                    <div className="flex gap-2">
                      <Button variant="secondary" disabled={isPending} onClick={() => handleObservation(obsAction.observationKey, 'confirmed')}>
                        {labels.yes}
                      </Button>
                      <Button variant="secondary" disabled={isPending} onClick={() => handleObservation(obsAction.observationKey, 'partly')}>
                        {labels.partly}
                      </Button>
                      <Button variant="secondary" disabled={isPending} onClick={() => handleObservation(obsAction.observationKey, 'rejected')}>
                        {labels.no}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </CardBody>

          {!readOnly ? (
            <div className="border-t border-surface-border p-4">
              {currentAction.kind === 'ai_message' ? (
                <div>
                  {currentSuggestions.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {currentSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleSend(s)}
                          className="rounded-full border border-brand-bluePale bg-brand-bluePale/40 px-3 py-1 text-xs font-medium text-brand-blue hover:bg-brand-bluePale disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2">
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Type your answer…"
                    className="min-h-[52px]"
                    disabled={isPending}
                  />
                  <Button onClick={() => handleSend()} disabled={isPending || !inputText.trim()}>
                    {isPending ? '…' : 'Send'}
                  </Button>
                  </div>
                </div>
              ) : null}

              {currentAction.kind === 'summary' ? (
                <div className="flex gap-2">
                  <Button disabled={isPending} onClick={handleConfirm}>{labels.confirm}</Button>
                  <Button variant="secondary" disabled={isPending} onClick={handleCorrection}>{labels.correction}</Button>
                </div>
              ) : null}

              {currentAction.kind === 'completed' ? (
                <p className="text-sm font-medium text-status-success">
                  Interview completed — thank you. The captured facts on the right are saved to this process.
                </p>
              ) : null}

              {error ? <p className="mt-2 text-sm text-status-critical">{error}</p> : null}
            </div>
          ) : (
            <div className="border-t border-surface-border p-4">
              <p className="text-sm text-slate-400">Viewing as a reviewer — read only.</p>
            </div>
          )}
        </Card>
      </div>

      <div>
        <FactsPanel state={engineState} />
      </div>
    </div>
  );
}
