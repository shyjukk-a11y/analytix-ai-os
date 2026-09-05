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

export default async function ProcessDiscoveryPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const processes = await prisma.process.findMany({
    include: {
      project: { include: { department: true } },
      interviews: {
        select: { id: true, status: true, completeness: true, startedAt: true, employee: { select: { name: true } } },
        orderBy: { startedAt: 'desc' }
      }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="Process Discovery"
        subtitle="Every process employees have started describing, and how far each capture has gotten."
      />

      {processes.length === 0 ? (
        <EmptyState
          icon="🧭"
          title="No processes discovered yet"
          description="Processes appear here as soon as an AI interview begins capturing them."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {processes.map((p) => {
              const hasCompleted = p.interviews.some((i) => i.status === 'COMPLETED');
              const best = p.interviews.reduce((max, i) => Math.max(max, i.completeness), 0);
              const contributors = Array.from(new Set(p.interviews.map((i) => i.employee.name)));
              return (
                <Link
                  key={p.id}
                  href={`/digital-twin/${p.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-navy-950">{p.name || 'Untitled process'}</div>
                    <div className="truncate text-xs text-slate-500">
                      {p.project.department.name} · {p.project.name} · {contributors.join(', ')}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    <span className="text-xs text-slate-400">
                      {p.interviews.length} interview{p.interviews.length === 1 ? '' : 's'}
                    </span>
                    <Badge tone={hasCompleted ? 'success' : 'brand'}>{hasCompleted ? 'Captured' : `${best}% in progress`}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
