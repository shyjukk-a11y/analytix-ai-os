'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveProcessConflict } from '@/lib/actions/sop';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import type { ProcessFactsFieldDiff, ProcessFactsStepsOption } from '@/lib/process-facts';

export function ReconcileForm({
  processId,
  primaryInterviewId,
  fieldDiffs,
  stepsDiffer,
  stepsOptions
}: {
  processId: string;
  primaryInterviewId: string;
  fieldDiffs: ProcessFactsFieldDiff[];
  stepsDiffer: boolean;
  stepsOptions: ProcessFactsStepsOption[];
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    Object.fromEntries(fieldDiffs.map((d) => [d.field, primaryInterviewId]))
  );
  const [stepsChoice, setStepsChoice] = useState(primaryInterviewId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const overrides: Record<string, string> = {};
        for (const d of fieldDiffs) {
          const chosen = d.values.find((v) => v.interviewId === choices[d.field]);
          if (chosen && chosen.value !== null) overrides[d.field] = chosen.value;
        }
        await resolveProcessConflict(processId, {
          baseInterviewId: primaryInterviewId,
          overrides,
          stepsFromInterviewId: stepsDiffer ? stepsChoice : undefined
        });
        router.push(`/sop-library/${processId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save this decision.');
      }
    });
  }

  return (
    <div className="space-y-4">
      {fieldDiffs.map((d) => (
        <Card key={d.field}>
          <CardBody>
            <h3 className="mb-2 text-sm font-semibold text-navy-950">{d.label}</h3>
            <div className="space-y-2">
              {d.values.map((v) => (
                <label key={v.interviewId} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name={`field-${d.field}`}
                    className="mt-1"
                    checked={choices[d.field] === v.interviewId}
                    onChange={() => setChoices((c) => ({ ...c, [d.field]: v.interviewId }))}
                  />
                  <span>
                    <strong>{v.employeeName}:</strong> {v.value || <em className="text-slate-400">Not captured</em>}
                  </span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      ))}

      {stepsDiffer ? (
        <Card>
          <CardBody>
            <h3 className="mb-2 text-sm font-semibold text-navy-950">Step-by-step procedure</h3>
            <div className="space-y-3">
              {stepsOptions.map((opt) => (
                <label key={opt.interviewId} className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="steps"
                    className="mt-1"
                    checked={stepsChoice === opt.interviewId}
                    onChange={() => setStepsChoice(opt.interviewId)}
                  />
                  <span>
                    <strong>{opt.employeeName}&rsquo;s version:</strong>
                    <ol className="ml-4 mt-1 list-decimal space-y-0.5">
                      {opt.steps.map((s, i) => (
                        <li key={i}>{s.text}</li>
                      ))}
                    </ol>
                  </span>
                </label>
              ))}
            </div>
          </CardBody>
        </Card>
      ) : null}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={isPending}>
          {isPending ? 'Saving…' : 'Confirm & unlock SOP generation'}
        </Button>
        {error ? <span className="text-sm text-status-critical">{error}</span> : null}
      </div>
    </div>
  );
}
