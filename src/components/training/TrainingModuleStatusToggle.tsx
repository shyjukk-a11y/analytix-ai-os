'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setTrainingModuleStatus } from '@/lib/actions/training';
import { Button } from '@/components/ui/Button';

export function TrainingModuleStatusToggle({
  processId,
  sopId,
  status
}: {
  processId: string;
  sopId: string;
  status: 'DRAFT' | 'PUBLISHED';
}) {
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
              await setTrainingModuleStatus(processId, sopId, next);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update status.');
            }
          });
        }}
      >
        {isPending ? '…' : status === 'DRAFT' ? 'Publish' : 'Unpublish'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
