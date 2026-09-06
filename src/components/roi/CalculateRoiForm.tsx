'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { calculateRoi } from '@/lib/actions/roi';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';

export function CalculateRoiForm({
  opportunityId,
  defaultMonthlyVolume,
  defaultCostPerHour,
  label = 'Calculate ROI estimate'
}: {
  opportunityId: string;
  defaultMonthlyVolume: number;
  defaultCostPerHour: number;
  label?: string;
}) {
  const router = useRouter();
  const [monthlyVolume, setMonthlyVolume] = useState(String(defaultMonthlyVolume));
  const [costPerHour, setCostPerHour] = useState(String(defaultCostPerHour));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const volume = Number(monthlyVolume);
        const cost = Number(costPerHour);
        startTransition(async () => {
          try {
            await calculateRoi(opportunityId, { monthlyVolume: volume, costPerHour: cost });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not calculate this estimate.');
          }
        });
      }}
      className="flex flex-wrap items-end gap-4"
    >
      <div className="w-40">
        <Label htmlFor="monthlyVolume">Monthly case volume</Label>
        <Input
          id="monthlyVolume"
          type="number"
          min={1}
          step={1}
          required
          value={monthlyVolume}
          onChange={(e) => setMonthlyVolume(e.target.value)}
        />
      </div>
      <div className="w-40">
        <Label htmlFor="costPerHour">Cost per hour ($)</Label>
        <Input
          id="costPerHour"
          type="number"
          min={0.01}
          step={0.01}
          required
          value={costPerHour}
          onChange={(e) => setCostPerHour(e.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Calculating…' : label}
      </Button>
      {error ? <p className="w-full text-xs text-status-critical">{error}</p> : null}
    </form>
  );
}
