'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadKnowledgeSource } from '@/lib/actions/projects';
import { Button } from '@/components/ui/Button';

export function KnowledgeUploadForm({ projectId }: { projectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await uploadKnowledgeSource(projectId, formData);
            formRef.current?.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed.');
          }
        });
      }}
      className="flex flex-wrap items-center gap-3"
    >
      <input
        type="file"
        name="file"
        required
        accept=".pdf,.doc,.docx,.xls,.xlsx,image/png,image/jpeg,image/webp"
        className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-bluePale file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-blue"
      />
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? 'Uploading…' : 'Upload'}
      </Button>
      {error ? <span className="text-sm text-status-critical">{error}</span> : null}
    </form>
  );
}
