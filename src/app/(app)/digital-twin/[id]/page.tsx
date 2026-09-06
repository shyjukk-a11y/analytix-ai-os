import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { extractProcessFacts, pickPrimaryInterview, OBS_STATUS_TONE } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { getProcessDependencySummary } from '@/lib/actions/process-delete';
import { ProcessDeleteControls } from '@/components/process/ProcessDeleteControls';

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-slate-700">{value || '—'}</div>
    </div>
  );
}

export default async function DigitalTwinDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: {
      project: { include: { department: true } },
      interviews: { include: { employee: true }, orderBy: { startedAt: 'desc' } }
    }
  });
  if (!process || process.interviews.length === 0) notFound();

  const primary = pickPrimaryInterview(process.interviews);
  const state = JSON.parse(primary.stateJson) as InterviewState;
  const facts = extractProcessFacts(state);
  const others = process.interviews.filter((i) => i.id !== primary.id);
  const dependencySummary = await getProcessDependencySummary(process.id);

  return (
    <div>
      <PageHeader
        title={process.name || 'Untitled process'}
        subtitle={`${process.project.department.name} · ${process.project.name}`}
        actions={
          <>
            <Badge tone={primary.status === 'COMPLETED' ? 'success' : 'brand'}>
              {primary.status === 'COMPLETED' ? 'Captured' : `${facts.completeness}% captured`}
            </Badge>
            <ProcessDeleteControls
              processId={process.id}
              summary={dependencySummary}
              canFullDelete={can(session?.user.role, 'admin.manage')}
              canDeleteInterviews={can(session?.user.role, 'interview.review')}
              afterFullDeleteHref="/digital-twin"
            />
            <Link href="/digital-twin" className="self-center text-sm text-brand-blue hover:underline">
              ← All processes
            </Link>
          </>
        }
      />

      <p className="mb-6 text-xs text-slate-400">
        Structured from {process.interviews.length > 1 ? `${process.interviews.length} interviews, primarily ` : 'the interview with '}
        {primary.employee.name} ({primary.language.toUpperCase()}). Every fact below is what the employee stated — nothing is inferred or estimated.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Overview</h2>
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Field label="Role" value={facts.role} />
              <Field label="Frequency" value={facts.frequency} />
              <Field label="Trigger / starts when" value={facts.trigger} />
              <Field label="Ends when / outcome" value={facts.outcome} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Workflow steps</h2>
            </CardHeader>
            <CardBody>
              {facts.steps.length ? (
                <ol className="space-y-3">
                  {facts.steps.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-bluePale text-xs font-semibold text-brand-blue">
                        {i + 1}
                      </span>
                      <div>
                        <div className="text-sm text-slate-700">{s.text}</div>
                        {s.systems.length ? <div className="mt-0.5 text-xs text-slate-400">via {s.systems.join(', ')}</div> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400">No steps captured yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Controls &amp; exceptions</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Field label="Checked / approved by" value={facts.checkerDetail || facts.checker} />
              <Field label="If rejected" value={facts.rejectionHandling} />
              <Field label="Waiting / delays" value={facts.waitDetail} />
              {facts.exceptions.length ? (
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Exceptions reported</div>
                  <ul className="list-disc space-y-1 pl-4">
                    {facts.exceptions.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {facts.aiObservations.length ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-navy-950">AI observations raised during interview</h2>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                {facts.aiObservations.map((o, i) => (
                  <div key={i} className="flex items-start justify-between gap-2">
                    <span className="text-slate-600">{o.text}</span>
                    <Badge tone={OBS_STATUS_TONE[o.status] ?? 'neutral'}>{o.status}</Badge>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Systems</h2>
            </CardHeader>
            <CardBody>
              {facts.systems.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {facts.systems.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">None mentioned.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Depends on</h2>
            </CardHeader>
            <CardBody>
              {facts.activeDeps.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {facts.activeDeps.map((d) => (
                    <Badge key={d.key}>{d.label}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">None mentioned.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-navy-950">Pain points</h2>
            </CardHeader>
            <CardBody>
              {facts.activeProblems.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {facts.activeProblems.map((p) => (
                    <Badge key={p.key} tone="caution">
                      {p.label}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">None flagged.</p>
              )}
            </CardBody>
          </Card>

          {facts.knowledge.length || facts.templates.length ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-navy-950">Knowledge &amp; templates relied on</h2>
              </CardHeader>
              <CardBody className="space-y-3 text-sm">
                {facts.knowledge.length ? (
                  <ul className="list-disc space-y-1 pl-4">
                    {facts.knowledge.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                ) : null}
                {facts.templates.length ? (
                  <ul className="list-disc space-y-1 pl-4 text-slate-500">
                    {facts.templates.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {others.length ? (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-navy-950">Other interviews of this process</h2>
              </CardHeader>
              <div className="divide-y divide-surface-border">
                {others.map((i) => (
                  <Link key={i.id} href={`/ai-interviews/${i.id}`} className="block px-5 py-3 text-sm hover:bg-surface-muted">
                    {i.employee.name} · {i.completeness}% · {i.status.replaceAll('_', ' ')}
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
