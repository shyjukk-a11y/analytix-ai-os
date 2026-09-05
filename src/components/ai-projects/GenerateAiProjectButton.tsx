'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generateAiProject } from '@/lib/actions/ai-projects';
import { Button } from '@/components/ui/Button';

export function GenerateAiProjectButton({ opportunityId, label = 'Generate AI project proposal' }: { opportunityId: string; label?: string }) {
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
              await generateAiProject(opportunityId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not generate this proposal.');
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
