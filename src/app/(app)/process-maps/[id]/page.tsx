import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { extractProcessFacts, pickPrimaryInterview } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { PageHeader } from '@/components/ui/PageHeader';

// Hand-built CSS flowchart — deliberately not a charting/diagramming npm package: adding one
// risks the same platform-mismatch node_modules corruption that installing packages via the
// device-bridge sandbox caused earlier in this project. Tailwind boxes + connectors are enough to
// show a linear walkthrough with one decision point (the approval/rejection branch).

function StepBox({ index, text, systems }: { index: number; text: string; systems: string[] }) {
  return (
    <div className="w-full max-w-xl rounded-card border border-surface-border bg-white px-4 py-3 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-blue text-xs font-semibold text-white">
          {index}
        </span>
        <div>
          <div className="text-sm text-slate-700">{text}</div>
          {systems.length ? <div className="mt-0.5 text-xs text-slate-400">via {systems.join(', ')}</div> : null}
        </div>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-5 w-px bg-slate-300" />
      <div className="h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-slate-300" />
    </div>
  );
}

function DecisionBox({ label }: { label: string }) {
  return (
    <div className="relative my-2 flex h-28 w-28 flex-none items-center justify-center">
      <div className="absolute inset-0 rotate-45 rounded-lg border-2 border-brand-blue bg-brand-bluePale" />
      <span className="relative z-10 max-w-[76px] text-center text-[11px] font-semibold leading-tight text-brand-blue">{label}</span>
    </div>
  );
}

function Branch({ label, text, tone }: { label: string; text: string; tone: 'success' | 'critical' }) {
  const border = tone === 'success' ? 'border-status-success' : 'border-status-critical';
  const bg = tone === 'success' ? 'bg-status-successBg' : 'bg-status-criticalBg';
  const color = tone === 'success' ? 'text-status-success' : 'text-status-critical';
  return (
    <div className={`w-56 rounded-card border px-3 py-2.5 text-center ${border} ${bg}`}>
      <div className={`text-[11px] font-semibold uppercase tracking-wide ${color}`}>{label}</div>
      <div className="mt-1 text-xs text-slate-600">{text}</div>
    </div>
  );
}

function OutcomeBox({ text }: { text: string | null }) {
  return (
    <div className="w-full max-w-xl rounded-full border border-status-success bg-status-successBg px-4 py-2.5 text-center text-sm font-medium text-status-success">
      {text || 'Process completes'}
    </div>
  );
}

export default async function ProcessMapDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: { project: { include: { department: true } }, interviews: { orderBy: { startedAt: 'desc' } } }
  });
  if (!process || process.interviews.length === 0) notFound();

  const primary = pickPrimaryInterview(process.interviews);
  const state = JSON.parse(primary.stateJson) as InterviewState;
  const facts = extractProcessFacts(state);
  const hasDecision = Boolean(facts.checker || facts.checkerDetail);

  return (
    <div>
      <PageHeader
        title={process.name || 'Untitled process'}
        subtitle={`${process.project.department.name} · ${process.project.name} · process map`}
        actions={
          <Link href="/process-maps" className="self-center text-sm text-brand-blue hover:underline">
            ← All process maps
          </Link>
        }
      />

      {facts.steps.length === 0 ? (
        <p className="text-sm text-slate-400">No workflow steps captured yet for this process.</p>
      ) : (
        <div className="flex flex-col items-center rounded-card border border-dashed border-surface-border bg-surface-muted px-6 py-10">
          {facts.steps.map((s, i) => (
            <div key={i} className="flex w-full flex-col items-center">
              <StepBox index={i + 1} text={s.text} systems={s.systems} />
              <Arrow />
            </div>
          ))}

          {facts.waitDetail ? (
            <>
              <div className="w-full max-w-xl rounded-card border border-status-warning bg-status-warningBg px-4 py-2.5 text-center text-xs text-status-warning">
                ⏳ Wait / delay reported: {facts.waitDetail}
              </div>
              <Arrow />
            </>
          ) : null}

          {hasDecision ? (
            <>
              <DecisionBox label={facts.checkerDetail || facts.checker || 'Reviewed'} />
              <Arrow />
              <div className="flex w-full max-w-2xl flex-wrap justify-center gap-10">
                <Branch label="If approved" text={facts.outcome || 'Process completes'} tone="success" />
                <Branch label="If rejected" text={facts.rejectionHandling || 'Not captured during interview'} tone="critical" />
              </div>
            </>
          ) : (
            <OutcomeBox text={facts.outcome} />
          )}
        </div>
      )}
    </div>
  );
}
