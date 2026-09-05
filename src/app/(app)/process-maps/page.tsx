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

export default async function ProcessMapsListPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const processes = await prisma.process.findMany({
    where: { interviews: { some: {} } },
    include: {
      project: { include: { department: true } },
      interviews: { select: { status: true, completeness: true } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader title="Process Maps" subtitle="Visual flowcharts of each captured process — steps, decisions and where they lead." />

      {processes.length === 0 ? (
        <EmptyState icon="🗺️" title="No processes captured yet" description="A process map appears here once an interview has captured workflow steps." />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {processes.map((p) => {
              const hasCompleted = p.interviews.some((i) => i.status === 'COMPLETED');
              const best = p.interviews.reduce((max, i) => Math.max(max, i.completeness), 0);
              return (
                <Link key={p.id} href={`/process-maps/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-navy-950">{p.name || 'Untitled process'}</div>
                    <div className="text-xs text-slate-500">
                      {p.project.department.name} · {p.project.name}
                    </div>
                  </div>
                  <Badge tone={hasCompleted ? 'success' : 'brand'}>{hasCompleted ? 'Captured' : `${best}% in progress`}</Badge>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
