import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { STAGE_SEQUENCE, currentStage } from '@/lib/governance-rules';
import { StartGovernanceButton } from '@/components/governance/StartGovernanceButton';
import { RestartGovernanceButton } from '@/components/governance/RestartGovernanceButton';
import { GovernanceStageDecision } from '@/components/governance/GovernanceStageDecision';

const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'success' | 'critical'> = {
  NOT_STARTED: 'neutral',
  IN_REVIEW: 'brand',
  APPROVED: 'success',
  REJECTED: 'critical'
};

const STAGE_TONE: Record<string, 'neutral' | 'success' | 'critical'> = {
  PENDING: 'neutral',
  APPROVED: 'success',
  REJECTED: 'critical'
};

export default async function GovernanceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'governance.review')) notFound();

  // params.id is the AiOpportunity id, same convention as /ai-projects/[id] and /roi/[id].
  const opportunity = await prisma.aiOpportunity.findUnique({
    where: { id: params.id },
    include: {
      process: { include: { project: { include: { department: true } } } },
      aiProject: {
        include: {
          governanceStages: { include: { decidedBy: true }, orderBy: { stageOrder: 'asc' } }
        }
      }
    }
  });
  if (!opportunity) notFound();

  const aiProject = opportunity.aiProject;
  const isAdmin = session!.user.role === Role.ADMINISTRATOR;
  const current = aiProject ? currentStage(aiProject.governanceStages) : null;

  return (
    <div>
      <PageHeader
        title={aiProject?.title || opportunity.title}
        subtitle={`${opportunity.process.project.department.name} · ${opportunity.process.project.name} · ${opportunity.process.name || 'Untitled process'}`}
        actions={
          <>
            {aiProject ? <Badge tone={STATUS_TONE[aiProject.governanceStatus] ?? 'neutral'}>{aiProject.governanceStatus.replaceAll('_', ' ')}</Badge> : null}
            <Link href="/governance" className="self-center text-sm text-brand-blue hover:underline">
              ← Governance
            </Link>
          </>
        }
      />

      {!aiProject ? (
        <Card>
          <CardBody className="text-center">
            <p className="mb-3 text-sm text-slate-500">No AI project proposal exists for this opportunity yet.</p>
            <Link href={`/ai-projects/${opportunity.id}`} className="text-sm text-brand-blue hover:underline">
              Go generate one →
            </Link>
          </CardBody>
        </Card>
      ) : aiProject.status !== 'PROPOSED' ? (
        <Card>
          <CardBody className="text-center">
            <p className="text-sm text-slate-500">
              Only a proposed AI project can enter governance review — this one is still {aiProject.status}.
            </p>
          </CardBody>
        </Card>
      ) : aiProject.governanceStages.length === 0 ? (
        <Card>
          <CardBody className="text-center">
            <p className="mb-3 text-sm text-slate-500">Governance review hasn't started for this proposal yet.</p>
            <div className="flex justify-center">
              <StartGovernanceButton aiProjectId={aiProject.id} />
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {aiProject.governanceStatus === 'APPROVED' && aiProject.productionAt ? (
            <Card>
              <CardBody className="bg-status-success/5">
                <p className="text-sm font-medium text-status-success">
                  Approved into production on {aiProject.productionAt.toLocaleDateString()} — every stage signed off.
                </p>
              </CardBody>
            </Card>
          ) : null}

          {aiProject.governanceStatus === 'REJECTED' ? (
            <Card>
              <CardBody className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-status-critical">
                  This proposal was rejected at one stage. Restarting clears every decision and begins the chain again.
                </p>
                <RestartGovernanceButton aiProjectId={aiProject.id} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <div className="divide-y divide-surface-border">
              {STAGE_SEQUENCE.map((def) => {
                const stage = aiProject.governanceStages.find((s) => s.stageOrder === def.order);
                if (!stage) return null;
                const isCurrent = current?.id === stage.id;
                const canDecide = isCurrent && (isAdmin || session!.user.role === stage.role);
                return (
                  <div key={stage.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-navy-950">
                          {def.order}. {def.label}
                        </div>
                        <p className="text-xs text-slate-500">{def.description}</p>
                      </div>
                      <Badge tone={STAGE_TONE[stage.status] ?? 'neutral'}>{stage.status}</Badge>
                    </div>

                    {stage.status !== 'PENDING' ? (
                      <div className="mt-2 text-xs text-slate-500">
                        {stage.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {stage.decidedBy?.name ?? 'someone'}
                        {stage.decidedAt ? ` · ${stage.decidedAt.toLocaleDateString()}` : ''}
                        {stage.comment ? <div className="mt-1 italic text-slate-500">"{stage.comment}"</div> : null}
                      </div>
                    ) : null}

                    {canDecide ? (
                      <div className="mt-3">
                        <GovernanceStageDecision stageId={stage.id} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
