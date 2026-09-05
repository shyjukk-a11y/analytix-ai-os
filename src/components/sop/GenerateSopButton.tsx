'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateSop } from '@/lib/actions/sop';
import { Button } from '@/components/ui/Button';

export function GenerateSopButton({ processId, label = 'Generate SOP' }: { processId: string; label?: string }) {
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
              await generateSop(processId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not generate SOP.');
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
