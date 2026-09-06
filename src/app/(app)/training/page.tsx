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
import { GenerateTrainingModuleButton } from '@/components/training/GenerateTrainingModuleButton';

export default async function TrainingPage() {
  const session = await getServerSession(authOptions);
  const canGenerate = can(session?.user.role, 'interview.review');
  if (!can(session?.user.role, 'interview.conduct') && !canGenerate) notFound();

  const processes = await prisma.process.findMany({
    where: { sop: { status: 'PUBLISHED' } },
    include: { project: { include: { department: true } }, sop: { include: { trainingModule: true } } },
    orderBy: { updatedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="Training"
        subtitle="Learning modules generated from published SOPs — every module restates its source SOP, nothing invented."
      />

      {processes.length === 0 ? (
        <EmptyState
          icon="🎓"
          title="No published SOPs yet"
          description="Publish an SOP in the SOP Library first — a training module can only be generated from a published SOP."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {processes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-950">{p.name || 'Untitled process'}</div>
                  <div className="truncate text-xs text-slate-500">
                    {p.project.department.name} · {p.project.name}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {p.sop?.trainingModule ? (
                    <>
                      <Badge tone={p.sop.trainingModule.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                        {p.sop.trainingModule.status}
                      </Badge>
                      <Link href={`/training/${p.id}`} className="text-sm text-brand-blue hover:underline">
                        View
                      </Link>
                    </>
                  ) : canGenerate ? (
                    <GenerateTrainingModuleButton processId={p.id} />
                  ) : (
                    <span className="text-xs text-slate-400">Not generated yet</span>
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
