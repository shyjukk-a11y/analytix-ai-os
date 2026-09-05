'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAiOpportunityStatus } from '@/lib/actions/ai-opportunities';
import { Button } from '@/components/ui/Button';

export function DismissOpportunityButton({ id, status }: { id: string; status: 'IDENTIFIED' | 'DISMISSED' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next: 'IDENTIFIED' | 'DISMISSED' = status === 'IDENTIFIED' ? 'DISMISSED' : 'IDENTIFIED';

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setAiOpportunityStatus(id, next);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update this opportunity.');
            }
          });
        }}
      >
        {isPending ? '…' : status === 'IDENTIFIED' ? 'Dismiss' : 'Reopen'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
