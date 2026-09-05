'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAiProjectStatus } from '@/lib/actions/ai-projects';
import { Button } from '@/components/ui/Button';

export function AiProjectStatusToggle({ opportunityId, status }: { opportunityId: string; status: 'DRAFT' | 'PROPOSED' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next: 'DRAFT' | 'PROPOSED' = status === 'DRAFT' ? 'PROPOSED' : 'DRAFT';

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setAiProjectStatus(opportunityId, next);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update status.');
            }
          });
        }}
      >
        {isPending ? '…' : status === 'DRAFT' ? 'Mark as proposed' : 'Revert to draft'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
