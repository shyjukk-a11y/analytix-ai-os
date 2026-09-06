'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProcessCompletely, deleteProcessInterviewsOnly, type ProcessDependencySummary } from '@/lib/actions/process-delete';
import { Button } from '@/components/ui/Button';

function summaryLines(summary: ProcessDependencySummary): string[] {
  const lines: string[] = [];
  if (summary.interviews > 0) {
    lines.push(`${summary.interviews} AI interview${summary.interviews === 1 ? '' : 's'} and their full chat transcripts`);
  }
  if (summary.sop) {
    lines.push('Its generated SOP');
  }
  if (summary.trainingModule) {
    lines.push('The training module generated from that SOP');
  }
  if (summary.changeRequests > 0) {
    lines.push(`${summary.changeRequests} change request${summary.changeRequests === 1 ? '' : 's'} raised against that SOP`);
  }
  if (summary.knowledgeItems > 0) {
    lines.push(`${summary.knowledgeItems} Knowledge Base entr${summary.knowledgeItems === 1 ? 'y' : 'ies'}`);
  }
  if (summary.aiOpportunities > 0) {
    lines.push(`${summary.aiOpportunities} AI Opportunit${summary.aiOpportunities === 1 ? 'y' : 'ies'}`);
  }
  if (summary.aiProjects > 0) {
    lines.push(`${summary.aiProjects} AI Project business case${summary.aiProjects === 1 ? '' : 's'}`);
  }
  if (summary.agents > 0) {
    lines.push(`${summary.agents} published Agent${summary.agents === 1 ? '' : 's'} in the Agent Library`);
  }
  if (summary.roiEstimates > 0) {
    lines.push(`${summary.roiEstimates} ROI estimate${summary.roiEstimates === 1 ? '' : 's'}`);
  }
  if (summary.governanceStages > 0) {
    lines.push(`${summary.governanceStages} governance approval decision${summary.governanceStages === 1 ? '' : 's'}`);
  }
  if (summary.impactMeasurements > 0) {
    lines.push(`${summary.impactMeasurements} 30/60/90-day impact measurement${summary.impactMeasurements === 1 ? '' : 's'}`);
  }
  return lines;
}

export function ProcessDeleteControls({
  processId,
  summary,
  canFullDelete,
  canDeleteInterviews,
  afterFullDeleteHref,
  variant = 'full'
}: {
  processId: string;
  summary: ProcessDependencySummary;
  canFullDelete: boolean;
  canDeleteInterviews: boolean;
  afterFullDeleteHref?: string;
  variant?: 'compact' | 'full';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canFullDelete && !canDeleteInterviews) return null;

  const lines = summaryLines(summary);

  function handleDeleteInterviewsOnly() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProcessInterviewsOnly(processId);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete the interviews.');
      }
    });
  }

  function handleDeleteEverything() {
    if (!window.confirm('This permanently deletes the process and everything listed above. This cannot be undone. Continue?')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteProcessCompletely(processId);
        if (afterFullDeleteHref) {
          router.push(afterFullDeleteHref);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete this process.');
      }
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Delete this process"
        className={
          variant === 'compact'
            ? 'rounded-lg p-1.5 text-slate-400 hover:bg-status-criticalBg hover:text-status-critical'
            : 'rounded-lg border border-status-criticalBg px-3 py-1.5 text-sm font-medium text-status-critical hover:bg-status-criticalBg'
        }
      >
        {variant === 'compact' ? '🗑' : '🗑 Delete process…'}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-10 mt-2 w-96 max-w-[90vw] rounded-lg border border-surface-border bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="mb-2 text-sm font-semibold text-navy-950">Deleting this process will also delete:</h4>
          {lines.length > 0 ? (
            <ul className="mb-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-slate-500">Nothing else has been built from this process yet.</p>
          )}

          {error ? <p className="mb-2 text-xs text-status-critical">{error}</p> : null}

          <div className="flex flex-col gap-2">
            {canDeleteInterviews && summary.interviews > 0 ? (
              <div>
                <Button type="button" variant="secondary" disabled={isPending} onClick={handleDeleteInterviewsOnly}>
                  {isPending ? 'Working…' : 'Delete only AI Interviews'}
                </Button>
                <p className="mt-1 text-[11px] text-slate-400">
                  Keeps the SOP, Knowledge Base entries and everything built downstream — just resets this process to
                  &ldquo;no captured interview&rdquo; so it can be re-interviewed from scratch.
                </p>
              </div>
            ) : null}
            {canFullDelete ? (
              <div>
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={handleDeleteEverything}
                  className="!bg-status-critical hover:!opacity-90"
                >
                  {isPending ? 'Working…' : 'Delete process and everything above'}
                </Button>
                <p className="mt-1 text-[11px] text-slate-400">Permanent. Cannot be undone.</p>
              </div>
            ) : null}
            <button type="button" className="self-start text-xs text-slate-400 hover:underline" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
