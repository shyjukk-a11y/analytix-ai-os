import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { AgentStatusToggle } from '@/components/agent-library/AgentStatusToggle';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'neutral'> = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  RETIRED: 'warning'
};

export default async function AgentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      publishedBy: true,
      sourceProject: {
        include: {
          opportunity: { include: { process: { include: { project: { include: { department: true } } } } } }
        }
      }
    }
  });
  if (!agent) notFound();

  const reuseCandidates = await prisma.aiOpportunity.findMany({
    where: { key: agent.key, status: 'IDENTIFIED', id: { not: agent.sourceProject.opportunityId } },
    include: { process: { include: { project: { include: { department: true } } } } },
    orderBy: { createdAt: 'desc' }
  });

  const sourceOpp = agent.sourceProject.opportunity;

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle={`Sourced from ${sourceOpp.process.project.department.name} · ${sourceOpp.process.project.name} · ${sourceOpp.process.name || 'Untitled process'}`}
        actions={
          <>
            <Badge tone={STATUS_TONE[agent.status] ?? 'neutral'}>{agent.status}</Badge>
            <Link href="/agent-library" className="self-center text-sm text-brand-blue hover:underline">
              ← Agent Library
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Published by {agent.publishedBy.name} · {agent.publishedAt.toLocaleDateString()}
            </p>
            <div className="flex gap-2">
              <AgentStatusToggle agentId={agent.id} status={agent.status as 'DRAFT' | 'ACTIVE' | 'RETIRED'} />
              <Link
                href={`/ai-projects/${sourceOpp.id}`}
                className="inline-flex items-center rounded-lg border border-surface-border px-3 py-1.5 text-sm text-brand-blue hover:bg-brand-bluePale"
              >
                View source AI project
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-700">{agent.description}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-navy-950">Reuse candidates</h3>
            <p className="text-xs text-slate-500">
              Other identified opportunities of the same kind ({agent.key}) that this agent could also address.
            </p>
          </CardHeader>
          <CardBody className="p-0">
            {reuseCandidates.length === 0 ? (
              <div className="p-5">
                <EmptyState icon="🔍" title="No reuse candidates yet" description="No other matching opportunities have been identified elsewhere yet." />
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {reuseCandidates.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-navy-950">{o.title}</div>
                      <div className="truncate text-xs text-slate-500">
                        {o.process.project.department.name} · {o.process.project.name} · {o.process.name || 'Untitled process'}
                      </div>
                    </div>
                    <Link href={`/ai-opportunities/${o.id}`} className="flex-none text-sm text-brand-blue hover:underline">
                      View opportunity
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
