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
import { approvedCount, STAGE_SEQUENCE } from '@/lib/governance-rules';
import { StartGovernanceButton } from '@/components/governance/StartGovernanceButton';

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'critical'> = {
  NOT_STARTED: 'neutral',
  IN_REVIEW: 'brand',
  APPROVED: 'success',
  REJECTED: 'critical'
};

export default async function GovernancePage({ searchParams }: { searchParams: ListFilterParams }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'governance.review')) notFound();

  const processFilter = relationFilterWhere(searchParams);

  const [{ departments, projects }, aiProjects] = await Promise.all([
    loadFilterOptions(),
    prisma.aiProject.findMany({
      where: { status: 'PROPOSED', opportunity: { process: processFilter } },
      include: {
        opportunity: { include: { process: { include: { project: { include: { department: true } } } } } },
        governanceStages: true
      },
      orderBy: { generatedAt: 'desc' }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Governance"
        subtitle={`Sequential sign-off from process owner to production — ${STAGE_SEQUENCE.length} fixed stages per proposed AI project.`}
      />

      <DepartmentProjectFilter departments={departments} projects={projects} />

      {aiProjects.length === 0 ? (
        <EmptyState
          icon="⚖️"
          title={
            searchParams.departmentId || searchParams.projectId
              ? 'No proposed AI projects match this filter'
              : 'No proposed AI projects yet'
          }
          description="A project must be generated and marked as proposed (in AI Projects) before it can enter governance review."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {aiProjects.map((p) => {
              const opp = p.opportunity;
              const approved = approvedCount(p.governanceStages);
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-navy-950">{p.title}</div>
                    <div className="truncate text-xs text-slate-500">
                      {opp.process.project.department.name} · {opp.process.project.name} · {opp.process.name || 'Untitled process'}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    {p.governanceStages.length > 0 ? (
                      <span className="text-xs text-slate-400">
                        {approved}/{STAGE_SEQUENCE.length} approved
                      </span>
                    ) : null}
                    <Badge tone={STATUS_TONE[p.governanceStatus] ?? 'neutral'}>{p.governanceStatus.replaceAll('_', ' ')}</Badge>
                    {p.governanceStatus === 'NOT_STARTED' ? (
                      <StartGovernanceButton aiProjectId={p.id} />
                    ) : (
                      <Link href={`/governance/${opp.id}`} className="text-sm text-brand-blue hover:underline">
                        View
                      </Link>
                    )}
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
