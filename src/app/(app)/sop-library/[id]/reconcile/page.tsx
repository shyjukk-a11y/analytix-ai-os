import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { extractProcessFacts, pickPrimaryInterview, compareProcessFacts } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { ReconcileForm } from '@/components/sop/ReconcileForm';

export default async function ReconcileProcessPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const process = await prisma.process.findUnique({
    where: { id: params.id },
    include: { project: { include: { department: true } }, interviews: { include: { employee: true } } }
  });
  if (!process) notFound();

  const completed = process.interviews.filter((i) => i.status === 'COMPLETED');

  const entries = completed.map((i) => ({
    interviewId: i.id,
    employeeName: i.employee.name,
    facts: extractProcessFacts(JSON.parse(i.stateJson) as InterviewState)
  }));
  const comparison = compareProcessFacts(entries);
  const hasSomethingToResolve = comparison.fieldDiffs.length > 0 || comparison.stepsDiffer;
  const primary = completed.length ? pickPrimaryInterview(completed) : null;

  return (
    <div>
      <PageHeader
        title={`Resolve conflicting inputs — ${process.name || 'Untitled process'}`}
        subtitle={`${process.project.department.name} · ${process.project.name} · ${completed.length} completed interview${completed.length === 1 ? '' : 's'}`}
        actions={
          <Link href={`/sop-library/${process.id}`} className="self-center text-sm text-brand-blue hover:underline">
            ← Back to process
          </Link>
        }
      />

      {process.status !== 'NEEDS_REVIEW' ? (
        <Card>
          <CardBody className="text-sm text-slate-500">
            This process has no unresolved conflicts right now.
          </CardBody>
        </Card>
      ) : !hasSomethingToResolve || !primary ? (
        <Card>
          <CardBody className="text-sm text-slate-500">
            No conflicting fields were found between the completed interviews on this process — you can regenerate
            the SOP directly from the process page.
          </CardBody>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-slate-500">
            {completed.length} employees described this process, and their answers didn&rsquo;t fully match. Pick
            which version to keep for each field below before the SOP can be generated or updated.
          </p>
          <ReconcileForm
            processId={process.id}
            primaryInterviewId={primary.id}
            fieldDiffs={comparison.fieldDiffs}
            stepsDiffer={comparison.stepsDiffer}
            stepsOptions={comparison.stepsByInterview}
          />
        </>
      )}
    </div>
  );
}
