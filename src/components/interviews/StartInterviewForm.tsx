'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { startInterview } from '@/lib/actions/interviews';
import type { Language } from '@/lib/interview-engine';
import { Button } from '@/components/ui/Button';
import { Label, Select, FormRow } from '@/components/ui/Field';

export function StartInterviewForm({
  projects,
  languages
}: {
  projects: { id: string; name: string }[];
  languages: { code: Language; name: string }[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [language, setLanguage] = useState<Language>('en');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          try {
            const interviewId = await startInterview(projectId, language);
            router.push(`/ai-interviews/${interviewId}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not start the interview.');
          }
        });
      }}
    >
      <FormRow>
        {projects.length > 1 ? (
          <div>
            <Label htmlFor="projectId">Project</Label>
            <Select id="projectId" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="language">Interview language</Label>
          <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} required>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </Select>
        </div>
      </FormRow>
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={isPending || !projectId}>
          {isPending ? 'Starting…' : '+ Start Interview'}
        </Button>
        {error ? <span className="text-sm text-status-critical">{error}</span> : null}
      </div>
    </form>
  );
}
