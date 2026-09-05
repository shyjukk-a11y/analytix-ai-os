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

const IMPACT_TONE: Record<string, 'success' | 'brand' | 'neutral'> = { HIGH: 'success', MEDIUM: 'brand', LOW: 'neutral' };
const EFFORT_TONE: Record<string, 'critical' | 'caution' | 'success'> = { HIGH: 'critical', MEDIUM: 'caution', LOW: 'success' };

export default async function AiOpportunitiesPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const opportunities = await prisma.aiOpportunity.findMany({
    include: {
      process: { include: { project: { include: { department: true } } } },
      aiProject: true
    },
    orderBy: { createdAt: 'desc' }
  });

  const active = opportunities.filter((o) => o.status === 'IDENTIFIED');
  const dismissed = opportunities.filter((o) => o.status === 'DISMISSED');

  function Row({ o }: { o: (typeof opportunities)[number] }) {
    return (
      <Link href={`/ai-opportunities/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-navy-950">{o.title}</div>
          <div className="truncate text-xs text-slate-500">
            {o.process.project.department.name} · {o.process.project.name} · {o.process.name || 'Untitled process'}
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {o.aiProject ? <Badge tone={o.aiProject.status === 'PROPOSED' ? 'success' : 'neutral'}>Proposal: {o.aiProject.status}</Badge> : null}
          <Badge tone={IMPACT_TONE[o.impact] ?? 'neutral'}>Impact: {o.impact}</Badge>
          <Badge tone={EFFORT_TONE[o.effort] ?? 'neutral'}>Effort: {o.effort}</Badge>
        </div>
      </Link>
    );
  }

  return (
    <div>
      <PageHeader
        title="AI Opportunities"
        subtitle="Improvement opportunities identified from confirmed AI observations during interviews — scored by evidence, not guesswork."
      />

      {active.length === 0 && dismissed.length === 0 ? (
        <EmptyState
          icon="💡"
          title="No AI opportunities identified yet"
          description="Opportunities appear here automatically once an employee confirms an AI-raised observation during their interview."
        />
      ) : (
        <>
          {active.length === 0 ? (
            <EmptyState icon="💡" title="No open opportunities" description="Every identified opportunity has been dismissed — see below." />
          ) : (
            <Card className="mb-6">
              <div className="divide-y divide-surface-border">
                {active.map((o) => (
                  <Row key={o.id} o={o} />
                ))}
              </div>
            </Card>
          )}

          {dismissed.length ? (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-500">Dismissed</h2>
              <Card>
                <div className="divide-y divide-surface-border opacity-60">
                  {dismissed.map((o) => (
                    <Row key={o.id} o={o} />
                  ))}
                </div>
              </Card>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
