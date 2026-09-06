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
import { CHECKPOINTS } from '@/lib/impact-measurement-rules';

export default async function ImpactMeasurementPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const agents = await prisma.agent.findMany({
    where: { status: 'ACTIVE' },
    include: { impactMeasurements: true },
    orderBy: { publishedAt: 'asc' }
  });

  const now = Date.now();

  return (
    <div>
      <PageHeader
        title="Impact Measurement"
        subtitle="30 / 60 / 90 day before-vs-after measurement for every active agent, against its baseline ROI estimate."
      />

      {agents.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No active agents yet"
          description="Activate an agent in the Agent Library to start tracking its 30/60/90-day impact."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {agents.map((a) => {
              const recorded = a.impactMeasurements.filter((m) => m.recordedAt).length;
              const nextDue = CHECKPOINTS.find(
                (days) => !a.impactMeasurements.some((m) => m.checkpointDays === days && m.recordedAt)
              );
              const nextDueDate = nextDue ? new Date(a.publishedAt.getTime() + nextDue * 24 * 60 * 60 * 1000) : null;
              const isDue = nextDueDate ? nextDueDate.getTime() <= now : false;
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-navy-950">{a.name}</div>
                    <div className="text-xs text-slate-500">Published {a.publishedAt.toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-none items-center gap-3">
                    {nextDueDate ? (
                      <Badge tone={isDue ? 'warning' : 'neutral'}>
                        {isDue ? `${nextDue}-day checkpoint due` : `${nextDue}-day due ${nextDueDate.toLocaleDateString()}`}
                      </Badge>
                    ) : (
                      <Badge tone="success">All checkpoints recorded</Badge>
                    )}
                    <span className="text-xs text-slate-400">{recorded}/{CHECKPOINTS.length}</span>
                    <Link href={`/impact-measurement/${a.id}`} className="text-sm text-brand-blue hover:underline">
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
