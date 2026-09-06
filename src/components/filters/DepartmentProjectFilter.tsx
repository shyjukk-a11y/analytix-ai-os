'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/Field';

// Reusable department/project filter bar for the review-facing list pages (AI Interviews, AI
// Opportunities, AI Projects, ROI / Business Cases, Agent Library). Drives filtering entirely via
// URL search params (?departmentId=...&projectId=...) so the filtered view is a Server Component
// re-fetch, not client-side state -- shareable/bookmarkable links, and no client-side data
// duplication of what the server already queried.
export function DepartmentProjectFilter({
  departments,
  projects
}: {
  departments: { id: string; name: string }[];
  projects: { id: string; name: string; departmentId: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const departmentId = searchParams.get('departmentId') ?? '';
  const projectId = searchParams.get('projectId') ?? '';

  const visibleProjects = departmentId ? projects.filter((p) => p.departmentId === departmentId) : projects;

  function updateParams(next: { departmentId?: string; projectId?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.departmentId !== undefined) {
      if (next.departmentId) params.set('departmentId', next.departmentId);
      else params.delete('departmentId');
      // Changing (or clearing) the department invalidates any project filter from a different department.
      params.delete('projectId');
    }
    if (next.projectId !== undefined) {
      if (next.projectId) params.set('projectId', next.projectId);
      else params.delete('projectId');
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const hasFilters = Boolean(departmentId || projectId);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Department</span>
        <Select
          aria-label="Filter by department"
          value={departmentId}
          onChange={(e) => updateParams({ departmentId: e.target.value })}
          className="w-auto py-1.5 text-xs"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Project</span>
        <Select
          aria-label="Filter by project"
          value={projectId}
          onChange={(e) => updateParams({ projectId: e.target.value })}
          className="w-auto py-1.5 text-xs"
        >
          <option value="">All projects</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      {hasFilters ? (
        <button type="button" onClick={() => router.push(pathname)} className="text-xs text-brand-blue hover:underline">
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
