'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { configureIntegration, disconnectIntegration } from '@/lib/actions/integrations';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Field';

export function IntegrationConfigForm({
  id,
  name,
  endpointOrNote,
  isConfigured
}: {
  id: string;
  name: string;
  endpointOrNote: string | null;
  isConfigured: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(name);
  const [endpointInput, setEndpointInput] = useState(endpointOrNote ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {isConfigured ? 'Edit' : 'Configure'}
        </Button>
        {isConfigured ? (
          <Button
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await disconnectIntegration(id);
                  router.refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not disconnect.');
                }
              });
            }}
          >
            {isPending ? '…' : 'Disconnect'}
          </Button>
        ) : null}
        {error ? <p className="text-xs text-status-critical">{error}</p> : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            await configureIntegration(id, { name: nameInput, endpointOrNote: endpointInput });
            setEditing(false);
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save this configuration.');
          }
        });
      }}
      className="space-y-2"
    >
      <div>
        <Label htmlFor={`name-${id}`}>Display name</Label>
        <Input id={`name-${id}`} value={nameInput} onChange={(e) => setNameInput(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor={`endpoint-${id}`} hint="(optional)">
          Endpoint / connection note
        </Label>
        <Input
          id={`endpoint-${id}`}
          value={endpointInput}
          onChange={(e) => setEndpointInput(e.target.value)}
          placeholder="e.g. https://... or a note on how this is wired up"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      {error ? <p className="text-xs text-status-critical">{error}</p> : null}
    </form>
  );
}
