'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startGovernanceReview } from '@/lib/actions/governance';
import { Button } from '@/components/ui/Button';

export function StartGovernanceButton({ aiProjectId }: { aiProjectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await startGovernanceReview(aiProjectId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not start governance review.');
            }
          });
        }}
      >
        {isPending ? 'Starting…' : 'Start governance review'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
