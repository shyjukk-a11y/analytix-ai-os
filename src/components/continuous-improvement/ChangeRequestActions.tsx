'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { markChangeRequestInProgress, resolveChangeRequest } from '@/lib/actions/continuous-improvement';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';

export function ChangeRequestActions({ changeRequestId, status }: { changeRequestId: string; status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (status === 'RESOLVED') return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-2">
        {status === 'OPEN' ? (
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await markChangeRequestInProgress(changeRequestId);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not update this request.');
                }
              });
            }}
          >
            {isPending ? '…' : 'Mark in progress'}
          </Button>
        ) : null}
      </div>
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note on how this was resolved…"
        className="min-h-[50px] text-sm"
        disabled={isPending}
      />
      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await resolveChangeRequest(changeRequestId, note);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not resolve this request.');
            }
          });
        }}
      >
        {isPending ? '…' : 'Resolve'}
      </Button>
      {error ? <p className="text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
