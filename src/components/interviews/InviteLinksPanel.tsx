'use client';

import { useMemo, useState, useTransition } from 'react';
import { createInterviewInviteLink, revokeInterviewInviteLink } from '@/lib/actions/interview-links';
import type { Language } from '@/lib/interview-engine';
import { Button } from '@/components/ui/Button';
import { Label, Select, FormRow } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';

type Department = { id: string; name: string };
type Project = { id: string; name: string; departmentId: string };
type Staff = { id: string; name: string; role: string };

type InviteLink = {
  id: string;
  token: string;
  active: boolean;
  language: string;
  projectName: string;
  employeeName: string;
  createdByName: string;
  interviewCount: number;
};

function ShareUrl({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? `${window.location.origin}/interview/${token}` : `/interview/${token}`;

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full min-w-0 flex-1 rounded-lg border border-surface-border bg-surface-muted px-2.5 py-1.5 text-xs text-slate-600"
      />
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard API unavailable (e.g. insecure context) — the input above is still selectable/copyable.
          }
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
}

export function InviteLinksPanel({
  departments,
  projects,
  staff,
  languages,
  initialLinks
}: {
  departments: Department[];
  projects: Project[];
  staff: Staff[];
  languages: { code: Language; name: string }[];
  initialLinks: InviteLink[];
}) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '');
  const projectsInDept = useMemo(() => projects.filter((p) => p.departmentId === departmentId), [projects, departmentId]);
  const [projectId, setProjectId] = useState(projectsInDept[0]?.id ?? '');
  const [employeeId, setEmployeeId] = useState(staff[0]?.id ?? '');
  const [language, setLanguage] = useState<Language>('en');
  const [links, setLinks] = useState(initialLinks);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDepartmentChange(id: string) {
    setDepartmentId(id);
    const first = projects.find((p) => p.departmentId === id);
    setProjectId(first?.id ?? '');
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNewToken(null);
    if (!projectId || !employeeId) {
      setError('Choose a department, project and staff member first.');
      return;
    }
    startTransition(async () => {
      try {
        const { id, token } = await createInterviewInviteLink(projectId, employeeId, language);
        const project = projects.find((p) => p.id === projectId);
        const employee = staff.find((s) => s.id === employeeId);
        setLinks((prev) => [
          {
            id,
            token,
            active: true,
            language,
            projectName: project?.name ?? '',
            employeeName: employee?.name ?? '',
            createdByName: 'You',
            interviewCount: 0
          },
          ...prev
        ]);
        setNewToken(token);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate the link.');
      }
    });
  }

  function handleRevoke(linkId: string) {
    if (!window.confirm('Revoke this link? It will stop working for anyone who has not already started their interview.')) return;
    startTransition(async () => {
      try {
        await revokeInterviewInviteLink(linkId);
        setLinks((prev) => prev.map((l) => (l.id === linkId ? { ...l, active: false } : l)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not revoke the link.');
      }
    });
  }

  return (
    <div>
      {departments.length === 0 || projects.length === 0 || staff.length === 0 ? (
        <p className="text-sm text-slate-500">
          You need at least one department, project and staff member set up before generating an interview link.
        </p>
      ) : (
        <form onSubmit={handleGenerate} className="space-y-4">
          <FormRow>
            <div>
              <Label htmlFor="linkDepartment">Department</Label>
              <Select id="linkDepartment" value={departmentId} onChange={(e) => handleDepartmentChange(e.target.value)}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="linkProject">Project</Label>
              <Select id="linkProject" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={projectsInDept.length === 0}>
                {projectsInDept.length === 0 ? (
                  <option value="">No projects in this department</option>
                ) : (
                  projectsInDept.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))
                )}
              </Select>
            </div>
          </FormRow>
          <FormRow>
            <div>
              <Label htmlFor="linkStaff">Staff name</Label>
              <Select id="linkStaff" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="linkLanguage">Interview language</Label>
              <Select id="linkLanguage" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </Select>
            </div>
          </FormRow>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isPending || !projectId || !employeeId}>
              {isPending ? 'Generating…' : '🔗 Generate Link'}
            </Button>
            {error ? <span className="text-sm text-status-critical">{error}</span> : null}
          </div>
        </form>
      )}

      {newToken ? (
        <div className="mt-4 rounded-lg border border-brand-bluePale bg-brand-bluePale/30 p-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-blue">Link ready — share it with your staff member</div>
          <ShareUrl token={newToken} />
        </div>
      ) : null}

      {links.length > 0 ? (
        <div className="mt-6 divide-y divide-surface-border border-t border-surface-border">
          {links.map((link) => (
            <div key={link.id} className="py-3">
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium text-navy-950">{link.employeeName}</span>
                  <span className="text-slate-400"> · {link.projectName}</span>
                  {link.createdByName !== 'You' ? <span className="text-slate-400"> · by {link.createdByName}</span> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={link.active ? 'success' : 'neutral'}>{link.active ? 'Active' : 'Revoked'}</Badge>
                  {link.active ? (
                    <Button type="button" variant="ghost" disabled={isPending} onClick={() => handleRevoke(link.id)}>
                      Revoke
                    </Button>
                  ) : null}
                </div>
              </div>
              {link.active ? <ShareUrl token={link.token} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
