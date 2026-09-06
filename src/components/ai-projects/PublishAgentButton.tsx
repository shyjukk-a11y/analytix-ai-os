'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { publishAgent } from '@/lib/actions/agent-library';
import { Button } from '@/components/ui/Button';

export function PublishAgentButton({ opportunityId }: { opportunityId: string }) {
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
              await publishAgent(opportunityId);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not publish this agent.');
            }
          });
        }}
      >
        {isPending ? 'Publishing…' : 'Publish to Agent Library'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
