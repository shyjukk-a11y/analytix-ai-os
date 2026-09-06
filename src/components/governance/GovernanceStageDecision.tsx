'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { decideGovernanceStage } from '@/lib/actions/governance';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';

/** The Approve/Reject form shown only to the person who can currently act on a stage -- rendered
 * for the single stage that's next in the sequence (see currentStage() in governance-rules.ts).
 * An optional comment is recorded either way and shown permanently once decided. */
export function GovernanceStageDecision({ stageId }: { stageId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function decide(decision: 'APPROVED' | 'REJECTED') {
    setError(null);
    startTransition(async () => {
      try {
        await decideGovernanceStage(stageId, decision, comment);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record this decision.');
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment for this decision…"
        className="min-h-[60px] text-sm"
        disabled={isPending}
      />
      <div className="flex gap-2">
        <Button disabled={isPending} onClick={() => decide('APPROVED')}>
          {isPending ? '…' : 'Approve'}
        </Button>
        <Button variant="secondary" disabled={isPending} onClick={() => decide('REJECTED')}>
          {isPending ? '…' : 'Reject'}
        </Button>
      </div>
      {error ? <p className="text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
