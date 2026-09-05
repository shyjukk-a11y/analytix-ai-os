import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { extractProcessFacts } from '@/lib/process-facts';
import { impactRationale, effortRationale } from '@/lib/ai-opportunity-rules';
import type { InterviewState } from '@/lib/interview-engine';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DismissOpportunityButton } from '@/components/ai-opportunities/DismissOpportunityButton';
import { GenerateAiProjectButton } from '@/components/ai-projects/GenerateAiProjectButton';

const IMPACT_TONE: Record<string, 'success' | 'brand' | 'neutral'> = { HIGH: 'success', MEDIUM: 'brand', LOW: 'neutral' };
const EFFORT_TONE: Record<string, 'critical' | 'caution' | 'success'> = { HIGH: 'critical', MEDIUM: 'caution', LOW: 'success' };

export default async function AiOpportunityDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const opportunity = await prisma.aiOpportunity.findUnique({
    where: { id: params.id },
    include: {
      process: { include: { project: { include: { department: true } }, interviews: true } },
      aiProject: true
    }
  });
  if (!opportunity) notFound();

  const sourceInterview =
    opportunity.process.interviews.find((i) => i.id === opportunity.sourceInterviewId) ?? opportunity.process.interviews[0];
  const facts = sourceInterview ? extractProcessFacts(JSON.parse(sourceInterview.stateJson) as InterviewState) : null;

  return (
    <div>
      <PageHeader
        title={opportunity.title}
        subtitle={`${opportunity.process.project.department.name} · ${opportunity.process.project.name} · ${opportunity.process.name || 'Untitled process'}`}
        actions={
          <>
            <Badge tone={opportunity.status === 'DISMISSED' ? 'neutral' : 'brand'}>{opportunity.status}</Badge>
            <Link href="/ai-opportunities" className="self-center text-sm text-brand-blue hover:underline">
              ← All opportunities
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">What the employee said</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-700">{opportunity.description}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Proposed AI approach</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-slate-700">{opportunity.recommendation}</p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Impact</h2>
            </CardHeader>
            <CardBody>
              <Badge tone={IMPACT_TONE[opportunity.impact] ?? 'neutral'}>{opportunity.impact}</Badge>
              <p className="mt-2 text-xs text-slate-500">{facts ? impactRationale(facts) : 'No interview data available.'}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Effort</h2>
            </CardHeader>
            <CardBody>
              <Badge tone={EFFORT_TONE[opportunity.effort] ?? 'neutral'}>{opportunity.effort}</Badge>
              <p className="mt-2 text-xs text-slate-500">{facts ? effortRationale(facts) : 'No interview data available.'}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Actions</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              <DismissOpportunityButton id={opportunity.id} status={opportunity.status as 'IDENTIFIED' | 'DISMISSED'} />
              {opportunity.aiProject ? (
                <Link href={`/ai-projects/${opportunity.id}`} className="block text-sm text-brand-blue hover:underline">
                  View AI project proposal ({opportunity.aiProject.status})
                </Link>
              ) : (
                <GenerateAiProjectButton opportunityId={opportunity.id} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
