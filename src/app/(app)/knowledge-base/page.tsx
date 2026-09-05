import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { TRUST_LEVEL_LABELS, type SourceTrustLevel } from '@/lib/enums';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const CATEGORY_LABEL: Record<string, string> = { KNOWLEDGE: 'Knowledge relied on', TEMPLATE: 'Template / checklist used' };

export default async function KnowledgeBasePage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'interview.review')) notFound();

  const [items, sources] = await Promise.all([
    prisma.knowledgeItem.findMany({
      include: { process: { include: { project: { include: { department: true } } } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.knowledgeSource.findMany({
      include: { project: { include: { department: true } }, uploadedBy: true },
      orderBy: { createdAt: 'desc' }
    })
  ]);

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        subtitle="Tacit knowledge captured during interviews, alongside reference documents uploaded for each project."
      />

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Captured from interviews</h2>
        {items.length === 0 ? (
          <EmptyState
            icon="🧠"
            title="No tacit knowledge captured yet"
            description="Employees mention templates, checklists and know-how during interviews — they appear here automatically once captured."
          />
        ) : (
          <Card>
            <div className="divide-y divide-surface-border">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/digital-twin/${item.processId}`} className="text-sm font-semibold text-navy-950 hover:underline">
                      {item.process.name || 'Untitled process'}
                    </Link>
                    <Badge tone="neutral">{TRUST_LEVEL_LABELS[item.trustLevel as SourceTrustLevel] ?? item.trustLevel}</Badge>
                  </div>
                  <div className="mb-1.5 text-xs text-slate-400">
                    {item.process.project.department.name} · {item.process.project.name} · {CATEGORY_LABEL[item.category] ?? item.category}
                  </div>
                  <p className="text-sm text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-navy-950">Uploaded reference documents</h2>
        {sources.length === 0 ? (
          <EmptyState icon="📎" title="No documents uploaded yet" />
        ) : (
          <Card>
            <div className="divide-y divide-surface-border">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-navy-950">{s.fileName}</div>
                    <div className="text-xs text-slate-400">
                      {s.project.department.name} · {s.project.name} · {(s.sizeBytes / 1024).toFixed(0)} KB · {s.uploadedBy.name}
                    </div>
                  </div>
                  <Badge tone="neutral">{TRUST_LEVEL_LABELS[s.trustLevel as SourceTrustLevel] ?? s.trustLevel}</Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
