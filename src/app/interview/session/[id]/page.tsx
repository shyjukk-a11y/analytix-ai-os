import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { languageOptions, type InterviewState } from '@/lib/interview-engine';
import { buildResumeAction } from '@/lib/interview-resume';
import { loadInterviewSuggestions } from '@/lib/interview-suggestions';
import {
  submitGuestInterviewAnswer,
  resolveGuestInterviewObservation,
  confirmGuestInterviewSummary,
  requestGuestInterviewCorrection,
  changeGuestInterviewLanguage
} from '@/lib/actions/interviews';
import { InterviewChat } from '@/components/interviews/InterviewChat';

export default async function GuestInterviewSessionPage({ params }: { params: { id: string } }) {
  const interview = await prisma.interview.findUnique({
    where: { id: params.id },
    include: {
      process: { include: { project: true } },
      employee: true,
      messages: { orderBy: { createdAt: 'asc' } },
      observations: { where: { status: 'PENDING' }, take: 1 }
    }
  });

  // Only interviews created via an active-at-the-time invite link are reachable without a
  // session — see loadInterviewForActor in src/lib/actions/interviews.ts for the matching
  // server-side guard on every write.
  if (!interview || !interview.inviteLinkId) notFound();

  const state = JSON.parse(interview.stateJson) as InterviewState;
  const lastAiMessage = [...interview.messages].reverse().find((m) => m.sender === 'AI');
  const resumeAction = buildResumeAction(state, lastAiMessage?.text, interview.observations[0]);
  const langName = languageOptions().find((l) => l.code === interview.language)?.name ?? interview.language;
  const suggestions = await loadInterviewSuggestions(interview.process.projectId);

  return (
    <div className="min-h-screen bg-surface-muted px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <div className="text-lg font-bold text-navy-950">{interview.process.name || 'Untitled process'}</div>
          <div className="text-sm text-slate-500">
            {interview.process.project.name} · {interview.employee.name} · {langName}
          </div>
        </div>

        <InterviewChat
          interviewId={interview.id}
          initialMessages={interview.messages.map((m) => ({ id: m.id, sender: m.sender as 'AI' | 'EMPLOYEE', text: m.text }))}
          initialState={state}
          initialAction={resumeAction}
          suggestions={suggestions}
          readOnly={false}
          actions={{
            submitAnswer: submitGuestInterviewAnswer,
            resolveObservation: resolveGuestInterviewObservation,
            confirmSummary: confirmGuestInterviewSummary,
            requestCorrection: requestGuestInterviewCorrection,
            changeLanguage: changeGuestInterviewLanguage
          }}
        />
      </div>
    </div>
  );
}
