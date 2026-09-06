import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RaiseChangeRequestForm } from '@/components/continuous-improvement/RaiseChangeRequestForm';
import { ChangeRequestActions } from '@/components/continuous-improvement/ChangeRequestActions';

const STATUS_TONE: Record<string, 'brand' | 'warning' | 'success'> = {
  OPEN: 'brand',
  IN_PROGRESS: 'warning',
  RESOLVED: 'success'
};

// A published SOP is considered due for review 90 days after it was last generated/updated —
// a fixed, documented cadence, not a guess.
const REVIEW_DUE_DAYS = 90;

export default async function ContinuousImprovementPage() {
  const session = await getServerSession(authOptions);
  const canReview = can(session?.user.role, 'interview.review');
  if (!can(session?.user.role, 'interview.conduct') && !canReview) notFound();

  const [sops, changeRequests] = await Promise.all([
    prisma.sop.findMany({
      where: { status: 'PUBLISHED' },
      include: { process: true },
      orderBy: { updatedAt: 'asc' }
    }),
    prisma.changeRequest.findMany({
      include: { sop: { include: { process: true } }, raisedBy: true, resolvedBy: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  const now = Date.now();
  const dueForReview = sops.filter((s) => now - s.updatedAt.getTime() > REVIEW_DUE_DAYS * 24 * 60 * 60 * 1000);

  const open = changeRequests.filter((c) => c.status !== 'RESOLVED');
  const resolved = changeRequests.filter((c) => c.status === 'RESOLVED');

  return (
    <div>
      <PageHeader
        title="Continuous Improvement"
        subtitle={`Scheduled SOP review (every ${REVIEW_DUE_DAYS} days) and change requests raised against published procedures.`}
      />

      <div className="space-y-6">
        {sops.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Raise a change request</h2>
            </CardHeader>
            <CardBody>
              <RaiseChangeRequestForm sops={sops.map((s) => ({ id: s.id, name: s.process.name || s.title }))} />
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-navy-950">Due for scheduled review</h2>
            <p className="text-xs text-slate-500">Published SOPs last updated more than {REVIEW_DUE_DAYS} days ago.</p>
          </CardHeader>
          <CardBody className="p-0">
            {dueForReview.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">Nothing due yet — every published SOP was updated within the last {REVIEW_DUE_DAYS} days.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {dueForReview.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-navy-950">{s.process.name || s.title}</span>
                    <span className="text-xs text-slate-400">Last updated {s.updatedAt.toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-navy-950">Open change requests</h2>
          {open.length === 0 ? (
            <EmptyState icon="🔄" title="No open change requests" description="Anyone can raise one above against a published SOP." />
          ) : (
            <div className="space-y-3">
              {open.map((c) => (
                <Card key={c.id}>
                  <CardBody>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-navy-950">{c.sop.process.name || c.sop.title}</span>
                      <Badge tone={STATUS_TONE[c.status] ?? 'neutral'}>{c.status.replaceAll('_', ' ')}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{c.summary}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Raised by {c.raisedBy.name} · {c.createdAt.toLocaleDateString()}
                    </p>
                    {canReview ? <ChangeRequestActions changeRequestId={c.id} status={c.status as 'OPEN' | 'IN_PROGRESS'} /> : null}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>

        {resolved.length > 0 ? (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-500">Resolved</h2>
            <Card>
              <div className="divide-y divide-surface-border opacity-70">
                {resolved.map((c) => (
                  <div key={c.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-navy-950">{c.sop.process.name || c.sop.title}</span>
                      <Badge tone="success">Resolved</Badge>
                    </div>
                    <p className="text-sm text-slate-600">{c.summary}</p>
                    {c.resolutionNote ? <p className="mt-1 text-xs italic text-slate-500">"{c.resolutionNote}"</p> : null}
                    <p className="mt-1 text-xs text-slate-400">
                      Resolved by {c.resolvedBy?.name ?? 'someone'} · {c.resolvedAt?.toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}
