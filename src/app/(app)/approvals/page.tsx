import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { STAGE_SEQUENCE, currentStage } from '@/lib/governance-rules';
import { GovernanceStageDecision } from '@/components/governance/GovernanceStageDecision';

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'governance.review')) notFound();

  const isAdmin = session!.user.role === Role.ADMINISTRATOR;

  const inReview = await prisma.aiProject.findMany({
    where: { governanceStatus: 'IN_REVIEW' },
    include: {
      opportunity: { include: { process: { include: { project: { include: { department: true } } } } } },
      governanceStages: true
    },
    orderBy: { generatedAt: 'asc' }
  });

  // Only the single stage that's actually actionable right now, and only when it belongs to this
  // user's role (an administrator sees every pending stage, mirroring the admin override used
  // everywhere else a decision is gated by role).
  type AiProjectRow = (typeof inReview)[number];
  type StageRow = AiProjectRow['governanceStages'][number];

  const myApprovals = inReview
    .map((p) => ({ aiProject: p, stage: currentStage(p.governanceStages) }))
    .filter((row): row is { aiProject: AiProjectRow; stage: StageRow } =>
      row.stage !== null && (isAdmin || row.stage.role === session!.user.role)
    );

  const stageLabel = (order: number) => STAGE_SEQUENCE.find((s) => s.order === order)?.label ?? '';

  return (
    <div>
      <PageHeader
        title="Approvals"
        subtitle={
          isAdmin
            ? 'Every governance stage across the organization currently awaiting a decision.'
            : `Governance stages currently awaiting your sign-off as ${session!.user.role.replaceAll('_', ' ')}.`
        }
      />

      {myApprovals.length === 0 ? (
        <EmptyState icon="✅" title="Nothing waiting on you" description="Governance stages needing your decision will show up here as soon as they reach you." />
      ) : (
        <div className="space-y-3">
          {myApprovals.map(({ aiProject, stage }) => {
            const opp = aiProject.opportunity;
            return (
              <Card key={aiProject.id}>
                <CardBody>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/governance/${opp.id}`} className="text-sm font-semibold text-navy-950 hover:underline">
                        {aiProject.title}
                      </Link>
                      <div className="truncate text-xs text-slate-500">
                        {opp.process.project.department.name} · {opp.process.project.name} · {opp.process.name || 'Untitled process'}
                      </div>
                    </div>
                    <Badge tone="brand">Stage {stage.stageOrder}: {stageLabel(stage.stageOrder)}</Badge>
                  </div>
                  <GovernanceStageDecision stageId={stage.id} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
