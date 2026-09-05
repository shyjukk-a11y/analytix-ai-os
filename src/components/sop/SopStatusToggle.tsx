'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setSopStatus } from '@/lib/actions/sop';
import { Button } from '@/components/ui/Button';

export function SopStatusToggle({ processId, status }: { processId: string; status: 'DRAFT' | 'PUBLISHED' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next: 'DRAFT' | 'PUBLISHED' = status === 'DRAFT' ? 'PUBLISHED' : 'DRAFT';

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setSopStatus(processId, next);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update status.');
            }
          });
        }}
      >
        {isPending ? '…' : status === 'DRAFT' ? 'Mark as published' : 'Revert to draft'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
