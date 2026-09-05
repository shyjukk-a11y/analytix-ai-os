'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteInterview } from '@/lib/actions/interviews';

// Two-click inline confirm instead of window.confirm()/alert() — keeps this button usable inside
// automated testing (a native confirm() dialog blocks further page interaction) and avoids an
// extra modal for what's a reversible-enough, low-stakes action in Phase 2 (capture-only) data.
export function DeleteInterviewButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    if (!confirming) {
      setConfirming(true);
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    startTransition(async () => {
      try {
        await deleteInterview(interviewId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not delete this interview.');
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {error ? <span className="text-xs text-status-critical">{error}</span> : null}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={confirming ? 'Click again to confirm' : 'Delete interview'}
        className={
          confirming
            ? 'rounded-lg bg-status-criticalBg px-2 py-1 text-xs font-semibold text-status-critical'
            : 'rounded-lg p-1.5 text-slate-400 hover:bg-status-criticalBg hover:text-status-critical disabled:opacity-50'
        }
      >
        {isPending ? '…' : confirming ? 'Confirm delete' : '🗑'}
      </button>
    </div>
  );
}
