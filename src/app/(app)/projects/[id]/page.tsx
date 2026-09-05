import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { KnowledgeUploadForm } from '@/components/projects/KnowledgeUploadForm';
import { StartInterviewForm } from '@/components/interviews/StartInterviewForm';
import { languageOptions } from '@/lib/interview-engine';
import { TRUST_LEVEL_LABELS } from '@/lib/enums';

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{value}</div>
    </div>
  );
}

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const canUpload = can(session?.user.role, 'knowledge.upload');

  const project = await prisma.aiTransformationProject.findUnique({
    where: { id: params.id },
    include: {
      department: { include: { division: { include: { country: true } } } },
      processOwner: true,
      knowledgeSources: { include: { uploadedBy: true }, orderBy: { createdAt: 'desc' } }
    }
  });

  if (!project) notFound();

  return (
    <div>
      <PageHeader
        title={project.name}
        subtitle={`${project.department.name} · ${project.department.division.country.name}`}
        actions={<Badge tone="brand">{project.status.replaceAll('_', ' ')}</Badge>}
      />

      {project.description ? <p className="mb-6 text-sm text-slate-600">{project.description}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-navy-950">Project setup</h2></CardHeader>
            <CardBody className="divide-y divide-surface-border">
              <DetailRow label="Service line" value={project.service} />
              <DetailRow label="AI project idea" value={project.aiProjectIdea} />
              <DetailRow label="Business objective" value={project.businessObjective} />
              <DetailRow label="Interview objective" value={project.interviewObjective} />
              <DetailRow label="In-scope activities" value={project.inScopeActivities} />
              <DetailRow label="Out-of-scope activities" value={project.outOfScopeActivities} />
              <DetailRow label="Current systems" value={project.currentSystems} />
              <DetailRow label="Existing SOP summary" value={project.existingSopSummary} />
              <DetailRow label="Known backend facts" value={project.knownBackendFacts} />
              <DetailRow label="Mandatory checks" value={project.mandatoryChecks} />
              <DetailRow label="Mandatory approvals" value={project.mandatoryApprovals} />
              <DetailRow label="Current templates" value={project.currentTemplates} />
              <DetailRow label="Current forms" value={project.currentForms} />
              <DetailRow label="Current checklists" value={project.currentChecklists} />
              <DetailRow label="Policies" value={project.policiesReferenced} />
              <DetailRow label="Regulatory references" value={project.regulatoryReferences} />
              <DetailRow label="Existing pain points" value={project.existingPainPoints} />
              <DetailRow label="Current volume" value={project.currentVolume} />
              <DetailRow label="Current manpower" value={project.currentManpower} />
              <DetailRow label="Existing AI tools" value={project.existingAiTools} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-navy-950">Ownership</h2></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-slate-400">Process owner</div>
                <div className="text-slate-700">{project.processOwner?.name ?? 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Department</div>
                <div className="text-slate-700">{project.department.name}</div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-navy-950">AI Interview</h2></CardHeader>
            <CardBody>
              {can(session?.user.role, 'interview.conduct') ? (
                <StartInterviewForm projects={[{ id: project.id, name: project.name }]} languages={languageOptions()} />
              ) : (
                <p className="text-sm text-slate-500">You do not have permission to conduct interviews.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-sm font-semibold text-navy-950">Knowledge sources</h2></CardHeader>
            <CardBody>
              {canUpload ? (
                <div className="mb-4">
                  <KnowledgeUploadForm projectId={project.id} />
                  <p className="mt-2 text-xs text-slate-400">
                    PDF, Word, Excel, PNG/JPEG/WebP · up to 20MB. Uploaded files are stored locally and marked
                    &ldquo;Employee statement&rdquo; trust until a process owner promotes them — nothing here becomes
                    official policy automatically (spec section 6/28).
                  </p>
                </div>
              ) : null}

              {project.knowledgeSources.length === 0 ? (
                <EmptyState icon="📎" title="No files uploaded yet" />
              ) : (
                <ul className="space-y-2">
                  {project.knowledgeSources.map((k) => (
                    <li key={k.id} className="rounded-lg border border-surface-border px-3 py-2 text-sm">
                      <div className="font-medium text-navy-950">{k.fileName}</div>
                      <div className="mt-0.5 flex items-center justify-between text-xs text-slate-400">
                        <span>{(k.sizeBytes / 1024).toFixed(0)} KB · {k.uploadedBy.name}</span>
                        <Badge tone="neutral">{TRUST_LEVEL_LABELS[k.trustLevel as keyof typeof TRUST_LEVEL_LABELS] ?? k.trustLevel}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
