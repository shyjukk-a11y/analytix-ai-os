'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { recordImpactMeasurement } from '@/lib/actions/impact-measurement';
import type { CheckpointDays } from '@/lib/impact-measurement-rules';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';

export function RecordImpactMeasurementForm({
  agentId,
  checkpointDays,
  defaultMonthlyVolume,
  defaultHoursSaved,
  defaultSavings,
  defaultNote,
  label = 'Record actuals'
}: {
  agentId: string;
  checkpointDays: CheckpointDays;
  defaultMonthlyVolume: number;
  defaultHoursSaved: number;
  defaultSavings: number;
  defaultNote?: string;
  label?: string;
}) {
  const router = useRouter();
  const [monthlyVolume, setMonthlyVolume] = useState(String(defaultMonthlyVolume));
  const [hoursSaved, setHoursSaved] = useState(String(defaultHoursSaved));
  const [savings, setSavings] = useState(String(defaultSavings));
  const [note, setNote] = useState(defaultNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await recordImpactMeasurement(agentId, checkpointDays, {
              actualMonthlyVolume: Number(monthlyVolume),
              actualHoursSaved: Number(hoursSaved),
              actualSavings: Number(savings),
              note
            });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not record this measurement.');
          }
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor={`vol-${checkpointDays}`}>Actual monthly volume</Label>
          <Input id={`vol-${checkpointDays}`} type="number" min={0} step={1} required value={monthlyVolume} onChange={(e) => setMonthlyVolume(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`hrs-${checkpointDays}`}>Actual hours saved / month</Label>
          <Input id={`hrs-${checkpointDays}`} type="number" min={0} step={0.1} required value={hoursSaved} onChange={(e) => setHoursSaved(e.target.value)} />
        </div>
        <div>
          <Label htmlFor={`sav-${checkpointDays}`}>Actual monthly savings ($)</Label>
          <Input id={`sav-${checkpointDays}`} type="number" min={0} step={0.01} required value={savings} onChange={(e) => setSavings(e.target.value)} />
        </div>
      </div>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note on how this was measured…" className="min-h-[50px] text-sm" />
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Saving…' : label}
      </Button>
      {error ? <p className="text-xs text-status-critical">{error}</p> : null}
    </form>
  );
}
