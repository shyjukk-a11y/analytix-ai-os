import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CalculateRoiForm } from '@/components/roi/CalculateRoiForm';
import { extractProcessFacts } from '@/lib/process-facts';
import { guessMonthlyVolume } from '@/lib/roi-rules';
import type { InterviewState } from '@/lib/interview-engine';

const DEFAULT_COST_PER_HOUR = 40;

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default async function RoiDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  // params.id is the AiOpportunity id, same convention as /ai-projects/[id].
  const opportunity = await prisma.aiOpportunity.findUnique({
    where: { id: params.id },
    include: {
      process: { include: { project: { include: { department: true } }, interviews: true } },
      roiEstimate: { include: { calculatedBy: true } }
    }
  });
  if (!opportunity) notFound();

  const sourceInterview =
    opportunity.process.interviews.find((i) => i.id === opportunity.sourceInterviewId) ?? opportunity.process.interviews[0];
  const facts = sourceInterview ? extractProcessFacts(JSON.parse(sourceInterview.stateJson) as InterviewState) : null;

  const defaultMonthlyVolume = guessMonthlyVolume(facts?.frequency ?? null);
  const defaultCostPerHour = opportunity.roiEstimate?.costPerHour ?? DEFAULT_COST_PER_HOUR;

  return (
    <div>
      <PageHeader
        title={opportunity.title}
        subtitle={`${opportunity.process.project.department.name} · ${opportunity.process.project.name} · ${opportunity.process.name || 'Untitled process'}`}
        actions={
          <>
            <Badge tone={opportunity.impact === 'HIGH' ? 'critical' : opportunity.impact === 'MEDIUM' ? 'warning' : 'neutral'}>
              {opportunity.impact} impact
            </Badge>
            <Link href="/roi" className="self-center text-sm text-brand-blue hover:underline">
              ← ROI / Business Cases
            </Link>
          </>
        }
      />

      <div className="space-y-4">
        {opportunity.roiEstimate ? (
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-navy-950">Current estimate</h3>
              <p className="text-xs text-slate-400">
                Calculated by {opportunity.roiEstimate.calculatedBy.name} · {opportunity.roiEstimate.calculatedAt.toLocaleDateString()}
              </p>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-xs text-slate-500">Monthly volume</div>
                  <div className="text-lg font-semibold text-navy-950">{opportunity.roiEstimate.monthlyVolume}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Minutes saved / case</div>
                  <div className="text-lg font-semibold text-navy-950">{opportunity.roiEstimate.minutesSavedPerCase}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Hours saved / month</div>
                  <div className="text-lg font-semibold text-navy-950">{opportunity.roiEstimate.hoursSavedPerMonth.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Monthly savings est.</div>
                  <div className="text-lg font-semibold text-status-success">{currency(opportunity.roiEstimate.monthlySavingsEstimate)}</div>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-brand-bluePale/40 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Annual savings estimate</div>
                <div className="text-2xl font-bold text-navy-950">{currency(opportunity.roiEstimate.annualSavingsEstimate)}</div>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">{opportunity.roiEstimate.assumptions}</p>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-navy-950">{opportunity.roiEstimate ? 'Recalculate' : 'Calculate ROI estimate'}</h3>
            <p className="text-xs text-slate-500">
              Monthly volume is pre-filled from the interview's stated case frequency where available — adjust before calculating.
            </p>
          </CardHeader>
          <CardBody>
            <CalculateRoiForm
              opportunityId={opportunity.id}
              defaultMonthlyVolume={defaultMonthlyVolume}
              defaultCostPerHour={defaultCostPerHour}
              label={opportunity.roiEstimate ? 'Recalculate' : 'Calculate ROI estimate'}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
