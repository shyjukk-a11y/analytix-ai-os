'use client';

import { useRef, useState, useTransition } from 'react';
import { raiseChangeRequest } from '@/lib/actions/continuous-improvement';
import { Button } from '@/components/ui/Button';
import { Label, Select, Textarea } from '@/components/ui/Field';

export function RaiseChangeRequestForm({ sops }: { sops: { id: string; name: string }[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [sopId, setSopId] = useState(sops[0]?.id ?? '');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await raiseChangeRequest(sopId, summary);
            setSummary('');
            formRef.current?.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not raise this change request.');
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="crSop">Which SOP?</Label>
        <Select id="crSop" value={sopId} onChange={(e) => setSopId(e.target.value)} required>
          {sops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="crSummary">What needs to change or be reviewed?</Label>
        <Textarea
          id="crSummary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="e.g. Step 4 now goes through the new portal, not email…"
          required
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending || !sopId}>
        {isPending ? 'Submitting…' : 'Raise change request'}
      </Button>
      {error ? <p className="text-xs text-status-critical">{error}</p> : null}
    </form>
  );
}
