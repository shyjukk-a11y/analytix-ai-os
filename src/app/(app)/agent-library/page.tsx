import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DepartmentProjectFilter } from '@/components/filters/DepartmentProjectFilter';
import { loadFilterOptions, relationFilterWhere, type ListFilterParams } from '@/lib/list-filters';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  RETIRED: 'warning'
};

export default async function AgentLibraryPage({ searchParams }: { searchParams: ListFilterParams }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const processFilter = relationFilterWhere(searchParams);

  const [{ departments, projects }, agents] = await Promise.all([
    loadFilterOptions(),
    prisma.agent.findMany({
      where: processFilter ? { sourceProject: { opportunity: { process: processFilter } } } : undefined,
      include: {
        sourceProject: { include: { opportunity: { include: { process: { include: { project: { include: { department: true } } } } } } } },
        publishedBy: true
      },
      orderBy: { publishedAt: 'desc' }
    })
  ]);

  const reuseCounts = await Promise.all(
    agents.map((a) =>
      prisma.aiOpportunity.count({
        where: { key: a.key, status: 'IDENTIFIED', id: { not: a.sourceProject.opportunityId } }
      })
    )
  );

  return (
    <div>
      <PageHeader
        title="Agent Library"
        subtitle="Reusable internal AI agent components, published from proposed AI projects."
      />

      <DepartmentProjectFilter departments={departments} projects={projects} />

      {agents.length === 0 ? (
        <EmptyState
          icon="📚"
          title={searchParams.departmentId || searchParams.projectId ? 'No agents match this filter' : 'No agents published yet'}
          description="Publish a proposed AI project to the Agent Library to catalogue it for reuse elsewhere in the organization."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {agents.map((a, i) => {
              const opp = a.sourceProject.opportunity;
              return (
              <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-950">{a.name}</div>
                  <div className="truncate text-xs text-slate-500">
                    {opp.process.project.department.name} · {opp.process.project.name} · Published by {a.publishedBy.name} · {a.publishedAt.toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {reuseCounts[i] > 0 ? (
                    <Badge tone="brand">{reuseCounts[i]} reuse candidate{reuseCounts[i] === 1 ? '' : 's'}</Badge>
                  ) : null}
                  <Badge tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.status}</Badge>
                  <Link href={`/agent-library/${a.id}`} className="text-sm text-brand-blue hover:underline">
                    View
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
