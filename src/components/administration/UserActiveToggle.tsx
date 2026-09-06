'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setUserActive } from '@/lib/actions/users';
import { Button } from '@/components/ui/Button';

export function UserActiveToggle({
  userId,
  active,
  disabled
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="text-right">
      <Button
        variant="ghost"
        disabled={disabled || isPending}
        title={disabled ? 'You cannot deactivate your own account.' : undefined}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await setUserActive(userId, !active);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not update user.');
            }
          });
        }}
      >
        {isPending ? '…' : active ? 'Deactivate' : 'Reactivate'}
      </Button>
      {error ? <p className="mt-1 text-xs text-status-critical">{error}</p> : null}
    </div>
  );
}
