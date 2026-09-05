import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function DigitalTwinListPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const processes = await prisma.process.findMany({
    where: { interviews: { some: {} } },
    include: {
      project: { include: { department: true } },
      interviews: { select: { status: true, completeness: true, employee: { select: { name: true } } } }
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="Process Digital Twin"
        subtitle="A structured, evidence-based record of each process — built entirely from what employees described."
      />

      {processes.length === 0 ? (
        <EmptyState
          icon="🧬"
          title="No processes captured yet"
          description="A digital twin appears here once an AI interview has captured a process."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processes.map((p) => {
            const best = p.interviews.reduce((max, i) => Math.max(max, i.completeness), 0);
            const hasCompleted = p.interviews.some((i) => i.status === 'COMPLETED');
            const contributors = Array.from(new Set(p.interviews.map((i) => i.employee.name)));
            return (
              <Link key={p.id} href={`/digital-twin/${p.id}`}>
                <Card className="h-full transition-shadow hover:shadow-cardLg">
                  <CardBody>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="text-2xl">🧬</div>
                      <Badge tone={hasCompleted ? 'success' : 'brand'}>{hasCompleted ? 'Captured' : `${best}%`}</Badge>
                    </div>
                    <div className="text-sm font-semibold text-navy-950">{p.name || 'Untitled process'}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {p.project.department.name} · {p.project.name}
                    </div>
                    <div className="mt-2 text-xs text-slate-400">{contributors.join(', ')}</div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
