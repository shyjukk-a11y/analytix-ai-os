import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { languageOptions } from '@/lib/interview-engine';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StartInterviewForm } from '@/components/interviews/StartInterviewForm';
import { InviteLinksPanel } from '@/components/interviews/InviteLinksPanel';
import { DeleteInterviewButton } from '@/components/interviews/DeleteInterviewButton';
import { DepartmentProjectFilter } from '@/components/filters/DepartmentProjectFilter';
import { loadFilterOptions, relationFilterWhere, type ListFilterParams } from '@/lib/list-filters';
import Link from 'next/link';

const STATUS_TONE: Record<string, 'neutral' | 'success' | 'brand'> = {
  IN_PROGRESS: 'brand',
  COMPLETED: 'success',
  ABANDONED: 'neutral'
};

function InterviewRow({ interview, showEmployee }: { interview: any; showEmployee: boolean }) {
  const langName = languageOptions().find((l) => l.code === interview.language)?.name ?? interview.language;
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-muted">
      <Link href={`/ai-interviews/${interview.id}`} className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-navy-950">
          {interview.process.name || 'Untitled process'}
        </div>
        <div className="text-xs text-slate-500">
          {interview.process.project.name}
          {showEmployee ? ` · ${interview.employee.name}` : ''}
          {' · '}{langName}
          {' · '}{interview.completeness}% complete
        </div>
      </Link>
      <div className="flex flex-none items-center gap-2">
        <Badge tone={STATUS_TONE[interview.status] ?? 'neutral'}>{interview.status.replaceAll('_', ' ')}</Badge>
        <DeleteInterviewButton interviewId={interview.id} />
      </div>
    </div>
  );
}

export default async function AiInterviewsPage({ searchParams }: { searchParams: ListFilterParams }) {
  const session = await getServerSession(authOptions);
  const canReview = can(session?.user.role, 'interview.review');
  const processFilter = relationFilterWhere(searchParams);

  const [{ departments: filterDepartments, projects: filterProjects }, myInterviews, allInterviews, departments, staff, inviteLinks, allProcesses] = await Promise.all([
    loadFilterOptions(),
    prisma.interview.findMany({
      where: { employeeId: session!.user.id },
      include: { process: { include: { project: true } } },
      orderBy: { startedAt: 'desc' }
    }),
    canReview
      ? prisma.interview.findMany({
          where: { process: processFilter },
          include: { process: { include: { project: true } }, employee: true },
          orderBy: { startedAt: 'desc' }
        })
      : Promise.resolve([]),
    canReview
      ? prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } })
      : Promise.resolve([]),
    canReview
      ? prisma.user.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, role: true } })
      : Promise.resolve([]),
    canReview
      ? prisma.interviewInviteLink.findMany({
          include: { project: true, employee: true, createdBy: true, _count: { select: { interviews: true } } },
          orderBy: { createdAt: 'desc' }
        })
      : Promise.resolve([]),
    prisma.process.findMany({ select: { id: true, name: true, projectId: true } })
  ]);
  const projects = filterProjects;

  return (
    <div>
      <PageHeader
        title="AI Interviews"
        subtitle="Multilingual, AI-led interviews that capture how work actually happens today, one question at a time."
      />

      <Card className="mb-6">
        <div className="px-5 py-4">
          <h2 className="mb-3 text-sm font-semibold text-navy-950">Start a new interview</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-500">
              Create a project first — an interview always belongs to a project's discovery scope.
            </p>
          ) : (
            <StartInterviewForm projects={projects} languages={languageOptions()} processes={allProcesses} />
          )}
        </div>
      </Card>

      {canReview ? (
        <Card className="mb-6">
          <div className="px-5 py-4">
            <h2 className="mb-1 text-sm font-semibold text-navy-950">Shareable interview links</h2>
            <p className="mb-3 text-sm text-slate-500">
              Generate a no-login-required link for a specific staff member — pick their department, project and
              name, then send them the link. Opening it starts (or resumes) their interview immediately.
            </p>
            <InviteLinksPanel
              departments={departments as { id: string; name: string }[]}
              projects={projects}
              staff={staff as { id: string; name: string; role: string }[]}
              languages={languageOptions()}
              processes={allProcesses}
              initialLinks={(inviteLinks as any[]).map((l) => ({
                id: l.id,
                token: l.token,
                active: l.active,
                language: l.language,
                projectName: l.project.name,
                employeeName: l.employee.name,
                createdByName: l.createdById === session!.user.id ? 'You' : l.createdBy.name,
                interviewCount: l._count.interviews
              }))}
            />
          </div>
        </Card>
      ) : null}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">My interviews</h2>
        {myInterviews.length === 0 ? (
          <EmptyState icon="💬" title="No interviews yet" description="Start one above to begin capturing a process." />
        ) : (
          <Card>
            <div className="divide-y divide-surface-border">
              {myInterviews.map((i) => (
                <InterviewRow key={i.id} interview={i} showEmployee={false} />
              ))}
            </div>
          </Card>
        )}
      </div>

      {canReview ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-navy-950">All interviews (review)</h2>
          <DepartmentProjectFilter departments={filterDepartments} projects={filterProjects} />
          {allInterviews.length === 0 ? (
            <EmptyState
              icon="🗂️"
              title={searchParams.departmentId || searchParams.projectId ? 'No interviews match this filter' : 'No interviews captured yet across the organization'}
            />
          ) : (
            <Card>
              <div className="divide-y divide-surface-border">
                {allInterviews.map((i: any) => (
                  <InterviewRow key={i.id} interview={i} showEmployee />
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
