'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { getButtonLabels, observationTagLabel, type EngineAction, type InterviewState } from '@/lib/interview-engine';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';

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
};

const DEP_LABELS: Record<string, string> = {
  client: 'Client',
  otherDept: 'Other department',
  manager: 'Manager / supervisor',
  authority: 'External authority',
  vendor: 'Vendor / supplier',
  external: 'External consultant'
};

const PROBLEM_LABELS: Record<string, string> = {
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

const DIM_LABELS: Record<string, string> = {
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

const OBS_STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  partly: 'warning',
  rejected: 'neutral'
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

function FactsPanel({ state }: { state: InterviewState }) {
  const systems = Object.keys(state.systemsMentioned);
  const activeDeps = (Object.keys(DEP_LABELS) as (keyof typeof DEP_LABELS)[]).filter((k) => (state.deps as any)[k]);
  const activeProblems = (Object.keys(PROBLEM_LABELS) as (keyof typeof PROBLEM_LABELS)[]).filter((k) => (state.problems as any)[k]);
  const dimKeys = Object.keys(DIM_LABELS) as (keyof typeof DIM_LABELS)[];

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-navy-950">Captured so far</h2>
        <Badge tone="brand">{state.completeness}% complete</Badge>
      </CardHeader>
      <CardBody className="space-y-5 text-sm">
        <div className="space-y-1">
          {state.department ? <div><span className="text-xs text-slate-400">Department: </span>{state.department}</div> : null}
          {state.role ? <div><span className="text-xs text-slate-400">Role: </span>{state.role}</div> : null}
          {state.name ? <div><span className="text-xs text-slate-400">Process: </span>{state.name}</div> : null}
          {state.trigger ? <div><span className="text-xs text-slate-400">Trigger: </span>{state.trigger}</div> : null}
          {state.outcome ? <div><span className="text-xs text-slate-400">Outcome: </span>{state.outcome}</div> : null}
          {state.frequency ? <div><span className="text-xs text-slate-400">Frequency: </span>{state.frequency}</div> : null}
        </div>

        {state.steps.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow steps</div>
            <ol className="list-decimal space-y-1.5 pl-4">
              {state.steps.map((s, idx) => (
                <li key={idx}>
                  {s.text}
                  {s.systems.length ? <span className="text-xs text-slate-400"> · {s.systems.join(', ')}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {systems.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Systems</div>
            <div className="flex flex-wrap gap-1.5">
              {systems.map((s) => <Badge key={s}>{s}</Badge>)}
            </div>
          </div>
        ) : null}

        {activeDeps.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Depends on</div>
            <div className="flex flex-wrap gap-1.5">
              {activeDeps.map((k) => <Badge key={k}>{DEP_LABELS[k]}</Badge>)}
            </div>
          </div>
        ) : null}

        {activeProblems.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Pain points observed</div>
            <div className="flex flex-wrap gap-1.5">
              {activeProblems.map((k) => <Badge key={k} tone="caution">{PROBLEM_LABELS[k]}</Badge>)}
            </div>
          </div>
        ) : null}

        {state.exceptions.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Exceptions</div>
            <ul className="list-disc space-y-1 pl-4">{state.exceptions.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        ) : null}

        {state.knowledge.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Knowledge relied on</div>
            <ul className="list-disc space-y-1 pl-4">{state.knowledge.map((k, i) => <li key={i}>{k}</li>)}</ul>
          </div>
        ) : null}

        {state.aiObservations.length ? (
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">AI observations</div>
            <div className="space-y-1.5">
              {state.aiObservations.map((o, i) => (
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
            {dimKeys.map((k) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-xs text-slate-500">{DIM_LABELS[k]}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand-blue" style={{ width: `${(state.dims as any)[k]}%` }} />
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
  actions
}: {
  interviewId: string;
  initialMessages: ChatMessage[];
  initialState: InterviewState;
  initialAction: EngineAction;
  readOnly: boolean;
  // Required unless readOnly — enforced at the call sites, not by the type, since a reviewer
  // viewing someone else's interview never needs a set of actions at all.
  actions?: InterviewChatActions;
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

  function handleSend() {
    const text = inputText.trim();
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

  const obsAction = currentAction.kind === 'observation' ? currentAction : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="flex h-[70vh] flex-col">
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
                  <Button onClick={handleSend} disabled={isPending || !inputText.trim()}>
                    {isPending ? '…' : 'Send'}
                  </Button>
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
