import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CHECKPOINTS, type CheckpointDays } from '@/lib/impact-measurement-rules';
import { RecordImpactMeasurementForm } from '@/components/impact-measurement/RecordImpactMeasurementForm';

const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export default async function ImpactMeasurementDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    include: {
      impactMeasurements: { include: { recordedBy: true } },
      sourceProject: { include: { opportunity: { include: { roiEstimate: true } } } }
    }
  });
  if (!agent) notFound();

  const baseline = agent.sourceProject.opportunity.roiEstimate;
  const now = Date.now();

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle={`Published ${agent.publishedAt.toLocaleDateString()} · baseline from its ROI estimate`}
        actions={
          <Link href="/impact-measurement" className="self-center text-sm text-brand-blue hover:underline">
            ← Impact Measurement
          </Link>
        }
      />

      <div className="space-y-4">
        {baseline ? (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Baseline (from ROI estimate)</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-slate-500">Monthly volume</div>
                <div className="font-semibold text-navy-950">{baseline.monthlyVolume}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Hours saved / month</div>
                <div className="font-semibold text-navy-950">{baseline.hoursSavedPerMonth.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Monthly savings</div>
                <div className="font-semibold text-navy-950">{currency(baseline.monthlySavingsEstimate)}</div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">
                No baseline ROI estimate exists for this agent's source opportunity yet — calculate one in ROI / Business Cases for a
                before-vs-after comparison.
              </p>
            </CardBody>
          </Card>
        )}

        {CHECKPOINTS.map((days) => {
          const measurement = agent.impactMeasurements.find((m) => m.checkpointDays === days);
          const dueDate = new Date(agent.publishedAt.getTime() + days * 24 * 60 * 60 * 1000);
          const isDue = dueDate.getTime() <= now;
          const recorded = Boolean(measurement?.recordedAt);

          return (
            <Card key={days}>
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-navy-950">{days}-day checkpoint</h2>
                <Badge tone={recorded ? 'success' : isDue ? 'warning' : 'neutral'}>
                  {recorded ? 'Recorded' : isDue ? 'Due' : `Due ${dueDate.toLocaleDateString()}`}
                </Badge>
              </CardHeader>
              <CardBody>
                {recorded && measurement ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-500">Actual volume</div>
                        <div className="font-semibold text-navy-950">
                          {measurement.actualMonthlyVolume}
                          {baseline ? <span className="ml-1 text-xs font-normal text-slate-400">(baseline {baseline.monthlyVolume})</span> : null}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Actual hours saved</div>
                        <div className="font-semibold text-navy-950">
                          {measurement.actualHoursSaved?.toFixed(1)}
                          {baseline ? <span className="ml-1 text-xs font-normal text-slate-400">(baseline {baseline.hoursSavedPerMonth.toFixed(1)})</span> : null}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Actual savings</div>
                        <div className="font-semibold text-navy-950">
                          {measurement.actualSavings != null ? currency(measurement.actualSavings) : '—'}
                          {baseline ? <span className="ml-1 text-xs font-normal text-slate-400">(baseline {currency(baseline.monthlySavingsEstimate)})</span> : null}
                        </div>
                      </div>
                    </div>
                    {measurement.note ? <p className="text-xs italic text-slate-500">"{measurement.note}"</p> : null}
                    <p className="text-xs text-slate-400">
                      Recorded by {measurement.recordedBy?.name ?? 'someone'} · {measurement.recordedAt?.toLocaleDateString()}
                    </p>
                    <details>
                      <summary className="cursor-pointer text-xs text-brand-blue hover:underline">Correct this measurement</summary>
                      <div className="mt-3">
                        <RecordImpactMeasurementForm
                          agentId={agent.id}
                          checkpointDays={days as CheckpointDays}
                          defaultMonthlyVolume={measurement.actualMonthlyVolume ?? 0}
                          defaultHoursSaved={measurement.actualHoursSaved ?? 0}
                          defaultSavings={measurement.actualSavings ?? 0}
                          defaultNote={measurement.note ?? ''}
                          label="Save correction"
                        />
                      </div>
                    </details>
                  </div>
                ) : isDue ? (
                  <RecordImpactMeasurementForm
                    agentId={agent.id}
                    checkpointDays={days as CheckpointDays}
                    defaultMonthlyVolume={baseline?.monthlyVolume ?? 0}
                    defaultHoursSaved={baseline?.hoursSavedPerMonth ?? 0}
                    defaultSavings={baseline?.monthlySavingsEstimate ?? 0}
                  />
                ) : (
                  <p className="text-sm text-slate-500">Not due until {dueDate.toLocaleDateString()}.</p>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
