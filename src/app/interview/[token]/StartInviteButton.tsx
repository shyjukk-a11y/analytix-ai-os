'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startInterviewFromInviteLink } from '@/lib/actions/interviews';
import { Button } from '@/components/ui/Button';

export function StartInviteButton({ token, label }: { token: string; label: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <Button
        type="button"
        className="w-full"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const interviewId = await startInterviewFromInviteLink(token);
              router.push(`/interview/session/${interviewId}`);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not start the interview.');
            }
          });
        }}
      >
        {isPending ? 'Starting…' : label}
      </Button>
      {error ? <p className="mt-2 text-sm text-status-critical">{error}</p> : null}
    </div>
  );
}
