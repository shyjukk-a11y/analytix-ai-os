import { prisma } from '@/lib/prisma';

// Shared department/project filtering for the review-facing list pages (AI Interviews, AI
// Opportunities, AI Projects, ROI / Business Cases, Agent Library) -- all URL-search-param driven
// (see DepartmentProjectFilter.tsx) so the filtered view is a plain Server Component re-fetch.
export type ListFilterParams = { departmentId?: string; projectId?: string };

export async function loadFilterOptions() {
  const [departments, projects] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.aiTransformationProject.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, departmentId: true }
    })
  ]);
  return { departments, projects };
}

/** Builds the `{ projectId?, project?: { departmentId? } }` shape for filtering anything that has
 * a direct `process` relation (Interview, AiOpportunity) -- i.e. `where: { process: relationFilterWhere(params) }`.
 * Returns undefined (no filter at all) when neither param is set, since Prisma treats an
 * `undefined` field value as "don't filter on this" rather than "match nothing". */
export function relationFilterWhere(params: ListFilterParams): Record<string, unknown> | undefined {
  if (!params.departmentId && !params.projectId) return undefined;
  return {
    ...(params.projectId ? { projectId: params.projectId } : {}),
    ...(params.departmentId ? { project: { departmentId: params.departmentId } } : {})
  };
}
