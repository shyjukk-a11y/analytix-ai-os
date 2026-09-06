import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { languageOptions, type InterviewState } from '@/lib/interview-engine';
import { buildResumeAction } from '@/lib/interview-resume';
import { loadInterviewSuggestions } from '@/lib/interview-suggestions';
import {
  submitInterviewAnswer,
  resolveInterviewObservation,
  confirmInterviewSummary,
  requestInterviewCorrection,
  changeInterviewLanguage
} from '@/lib/actions/interviews';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { InterviewChat } from '@/components/interviews/InterviewChat';

export default async function InterviewDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const canReview = can(session?.user.role, 'interview.review');

  const interview = await prisma.interview.findUnique({
    where: { id: params.id },
    include: {
      process: { include: { project: true } },
      employee: true,
      messages: { orderBy: { createdAt: 'asc' } },
      observations: { where: { status: 'PENDING' }, take: 1 }
    }
  });

  if (!interview) notFound();

  const isOwner = interview.employeeId === session!.user.id;
  if (!isOwner && !canReview) notFound();

  const state = JSON.parse(interview.stateJson) as InterviewState;
  const lastAiMessage = [...interview.messages].reverse().find((m) => m.sender === 'AI');
  const resumeAction = buildResumeAction(state, lastAiMessage?.text, interview.observations[0]);
  const langName = languageOptions().find((l) => l.code === interview.language)?.name ?? interview.language;
  const suggestions = isOwner ? await loadInterviewSuggestions(interview.process.projectId) : undefined;

  return (
    <div>
      <PageHeader
        title={interview.process.name || 'Untitled process'}
        subtitle={`${interview.process.project.name} · ${interview.employee.name} · ${langName}`}
        actions={
          <>
            <Badge tone={interview.status === 'COMPLETED' ? 'success' : 'brand'}>{interview.status.replaceAll('_', ' ')}</Badge>
            <Link href="/ai-interviews" className="text-sm text-brand-blue hover:underline self-center">
              ← All interviews
            </Link>
          </>
        }
      />

      <InterviewChat
        interviewId={interview.id}
        initialMessages={interview.messages.map((m) => ({ id: m.id, sender: m.sender as 'AI' | 'EMPLOYEE', text: m.text }))}
        initialState={state}
        initialAction={resumeAction}
        suggestions={suggestions}
        readOnly={!isOwner}
        actions={
          isOwner
            ? {
                submitAnswer: submitInterviewAnswer,
                resolveObservation: resolveInterviewObservation,
                confirmSummary: confirmInterviewSummary,
                requestCorrection: requestInterviewCorrection,
                changeLanguage: changeInterviewLanguage
              }
            : undefined
        }
      />
    </div>
  );
}
