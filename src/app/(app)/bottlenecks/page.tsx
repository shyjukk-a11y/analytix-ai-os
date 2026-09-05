import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { extractProcessFacts } from '@/lib/process-facts';
import type { InterviewState } from '@/lib/interview-engine';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const STATUS_TONE: Record<string, 'success' | 'warning'> = { CONFIRMED: 'success', PARTLY: 'warning' };
const STATUS_LABEL: Record<string, string> = { CONFIRMED: 'Confirmed', PARTLY: 'Partly confirmed' };

export default async function BottlenecksPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const observations = await prisma.interviewObservation.findMany({
    where: { category: 'BOTTLENECK', status: { in: ['CONFIRMED', 'PARTLY'] } },
    include: {
      interview: {
        include: {
          process: { include: { project: { include: { department: true } } } },
          employee: true
        }
      }
    },
    orderBy: { resolvedAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="Bottlenecks"
        subtitle="Pain points the AI raised during interviews and the employee then confirmed — never assumed."
      />

      {observations.length === 0 ? (
        <EmptyState
          icon="🚦"
          title="No confirmed bottlenecks yet"
          description="Bottlenecks appear here once an employee confirms an AI-raised observation during their interview."
        />
      ) : (
        <div className="space-y-4">
          {observations.map((o) => {
            const state = JSON.parse(o.interview.stateJson) as InterviewState;
            const facts = extractProcessFacts(state);
            const evidence = facts.waitDetail || facts.rejectionHandling;
            return (
              <Card key={o.id}>
                <div className="px-5 py-4">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/digital-twin/${o.interview.processId}`} className="text-sm font-semibold text-navy-950 hover:underline">
                      {o.interview.process.name || 'Untitled process'}
                    </Link>
                    <Badge tone={STATUS_TONE[o.status] ?? 'neutral'}>{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>
                  <div className="mb-2 text-xs text-slate-400">
                    {o.interview.process.project.department.name} · {o.interview.process.project.name} · reported by{' '}
                    {o.interview.employee.name}
                  </div>
                  <p className="text-sm text-slate-700">{o.text}</p>
                  {evidence ? <p className="mt-2 border-l-2 border-surface-border pl-3 text-sm italic text-slate-500">“{evidence}”</p> : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
