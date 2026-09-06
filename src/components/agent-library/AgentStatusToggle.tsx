'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setAgentStatus } from '@/lib/actions/agent-library';
import { Button } from '@/components/ui/Button';

type AgentStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

const NEXT_STATUS: Record<AgentStatus, AgentStatus> = {
  DRAFT: 'ACTIVE',
  ACTIVE: 'RETIRED',
  RETIRED: 'DRAFT'
};

const LABEL: Record<AgentStatus, string> = {
  DRAFT: 'Activate',
  ACTIVE: 'Retire',
  RETIRED: 'Reactivate as draft'
};

export function AgentStatusToggle({ agentId, status }: { agentId: string; status: AgentStatus }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const next = NEXT_STATUS[status];

  return (
    <div>
      <Button
        variant="secondary"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setAgentStatus(agentId, next);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update status.');
            }
          });
        }}
      >
        {isPending ? '…' : LABEL[status]}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
