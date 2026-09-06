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

const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default async function RoiListPage({ searchParams }: { searchParams: ListFilterParams }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const [{ departments, projects }, opportunities] = await Promise.all([
    loadFilterOptions(),
    prisma.aiOpportunity.findMany({
      where: { status: 'IDENTIFIED', process: relationFilterWhere(searchParams) },
      include: {
        process: { include: { project: { include: { department: true } } } },
        roiEstimate: true
      },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="ROI / Business Cases"
        subtitle="Deterministic, formula-based savings estimates per AI opportunity — planning figures, not audited financial analysis."
      />

      <DepartmentProjectFilter departments={departments} projects={projects} />

      {opportunities.length === 0 ? (
        <EmptyState
          icon="📈"
          title={searchParams.departmentId || searchParams.projectId ? 'No opportunities match this filter' : 'No AI opportunities to estimate yet'}
          description="Calculate an ROI estimate once an opportunity has been identified from a completed interview."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {opportunities.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-950">{o.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {o.process.project.department.name} · {o.process.project.name} · {o.process.name || 'Untitled process'}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {o.roiEstimate ? (
                    <Badge tone="success">{currency(o.roiEstimate.annualSavingsEstimate)}/yr est.</Badge>
                  ) : null}
                  <Link href={`/roi/${o.id}`} className="text-sm text-brand-blue hover:underline">
                    {o.roiEstimate ? 'View' : 'Calculate'}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
