import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { GenerateAiProjectButton } from '@/components/ai-projects/GenerateAiProjectButton';

export default async function AiProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const opportunities = await prisma.aiOpportunity.findMany({
    where: { status: 'IDENTIFIED' },
    include: {
      process: { include: { project: { include: { department: true } } } },
      aiProject: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="AI Projects"
        subtitle="Deterministic business-case proposals generated from confirmed AI opportunities — draft until reviewed."
      />

      {opportunities.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="No AI opportunities to propose yet"
          description="Generate an AI project proposal once an opportunity has been identified from a completed interview."
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {opportunities.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-navy-950">{o.title}</div>
                  <div className="truncate text-xs text-slate-500">
                    {o.process.project.department.name} · {o.process.project.name} · {o.process.name || 'Untitled process'}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-3">
                  {o.aiProject ? (
                    <>
                      <Badge tone={o.aiProject.status === 'PROPOSED' ? 'success' : 'neutral'}>{o.aiProject.status}</Badge>
                      <Link href={`/ai-projects/${o.id}`} className="text-sm text-brand-blue hover:underline">
                        View
                      </Link>
                    </>
                  ) : (
                    <GenerateAiProjectButton opportunityId={o.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
