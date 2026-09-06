'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { restartGovernanceReview } from '@/lib/actions/governance';
import { Button } from '@/components/ui/Button';

export function RestartGovernanceButton({ aiProjectId }: { aiProjectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await restartGovernanceReview(aiProjectId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not restart governance review.');
            }
          });
        }}
      >
        {isPending ? 'Restarting…' : 'Restart review'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
