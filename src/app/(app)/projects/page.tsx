import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  const canManage = can(session?.user.role, 'setup.manage');

  const projects = await prisma.aiTransformationProject.findMany({
    include: { department: true, processOwner: true, knowledgeSources: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="AI Transformation Projects"
        subtitle="Scope, ownership and knowledge context for each transformation project."
        actions={canManage ? <Link href="/projects/new"><Button>+ New Project</Button></Link> : undefined}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon="📁"
          title="No projects yet"
          description="Set up a project to start capturing scope, ownership and knowledge sources before the AI interview phase."
          action={canManage ? <Link href="/projects/new"><Button>+ New Project</Button></Link> : undefined}
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-surface-muted">
                <div>
                  <div className="text-sm font-semibold text-navy-950">{p.name}</div>
                  <div className="text-xs text-slate-500">
                    {p.department.name}
                    {p.processOwner ? ` · Owner: ${p.processOwner.name}` : ''}
                    {' · '}{p.knowledgeSources.length} knowledge source{p.knowledgeSources.length === 1 ? '' : 's'}
                  </div>
                </div>
                <Badge tone="brand">{p.status.replaceAll('_', ' ')}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
