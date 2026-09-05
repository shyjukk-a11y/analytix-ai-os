import { prisma } from '@/lib/prisma';
import { StartInviteButton } from './StartInviteButton';

export default async function InviteLandingPage({ params }: { params: { token: string } }) {
  const link = await prisma.interviewInviteLink.findUnique({
    where: { token: params.token },
    include: { project: { include: { department: true } }, employee: true }
  });

  const inactive = !link || !link.active;

  const existing = link
    ? await prisma.interview.findFirst({
        where: { inviteLinkId: link.id, status: 'IN_PROGRESS' },
        orderBy: { startedAt: 'desc' }
      })
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy-950 to-navy-800 px-4">
      <div className="w-full max-w-md rounded-card bg-white p-8 text-center shadow-cardLg">
        <div className="mb-1 text-lg font-bold text-navy-950">Analytix AI Process Consultant</div>
        <div className="mb-6 text-xs uppercase tracking-wide text-slate-400">AI-led employee interview</div>

        {inactive || !link ? (
          <p className="text-sm text-slate-600">This interview link is no longer active. Please ask for a new one.</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-600">
              Hi {link.employee.name} — you&rsquo;ve been invited to a short interview about how you handle{' '}
              <span className="font-semibold text-navy-950">{link.project.name}</span> in {link.project.department.name}.
              It takes about 10 minutes, one question at a time, in your own words. No account or login needed.
            </p>
            <StartInviteButton token={params.token} label={existing ? 'Continue your interview' : 'Start Interview'} />
          </>
        )}
      </div>
    </div>
  );
}
