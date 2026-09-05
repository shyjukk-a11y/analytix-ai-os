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
import { GenerateSopButton } from '@/components/sop/GenerateSopButton';

export default async function SopLibraryPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const processes = await prisma.process.findMany({
    where: { interviews: { some: {} } },
    include: {
      project: { include: { department: true } },
      sop: true
    },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader title="SOP Library" subtitle="Standard operating procedures generated from captured interviews — draft until reviewed." />

      {processes.length === 0 ? (
        <EmptyState icon="📋" title="No processes captured yet" description="Generate an SOP once a process has been discovered through an AI interview." />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {processes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-950">{p.name || 'Untitled process'}</div>
                  <div className="text-xs text-slate-500">
                    {p.project.department.name} · {p.project.name}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {p.sop ? (
                    <>
                      <Badge tone={p.sop.status === 'PUBLISHED' ? 'success' : 'neutral'}>{p.sop.status}</Badge>
                      <Link href={`/sop-library/${p.id}`} className="text-sm text-brand-blue hover:underline">
                        View
                      </Link>
                    </>
                  ) : (
                    <GenerateSopButton processId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
