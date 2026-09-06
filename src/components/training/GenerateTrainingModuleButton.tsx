'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateTrainingModule } from '@/lib/actions/training';
import { Button } from '@/components/ui/Button';

export function GenerateTrainingModuleButton({ processId, label = 'Generate training module' }: { processId: string; label?: string }) {
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
              await generateTrainingModule(processId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not generate this training module.');
            }
          });
        }}
      >
        {isPending ? 'Generating…' : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
