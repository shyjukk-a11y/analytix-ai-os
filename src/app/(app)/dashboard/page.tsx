import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [departmentCount, projectCount, userCount, knowledgeSourceCount, recentProjects] = await Promise.all([
    prisma.department.count(),
    prisma.aiTransformationProject.count(),
    prisma.user.count(),
    prisma.knowledgeSource.count(),
    prisma.aiTransformationProject.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { department: true }
    })
  ]);

  const stats = [
    { label: 'Departments configured', value: departmentCount, icon: '🏢' },
    { label: 'AI transformation projects', value: projectCount, icon: '📁' },
    { label: 'Platform users', value: userCount, icon: '👥' },
    { label: 'Knowledge sources uploaded', value: knowledgeSourceCount, icon: '📎' }
  ];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.user.name.split(' ')[0]}`}
        subtitle="Discover Work → Capture Knowledge → Improve Processes → Build AI → Measure Impact"
      />

      <div className="mb-6 rounded-card border border-brand-bluePale bg-brand-bluePale/40 px-5 py-4">
        <div className="flex items-center gap-2">
          <Badge tone="brand">Phase 1 — Foundation</Badge>
          <span className="text-sm text-slate-600">
            Auth, RBAC, department/project setup and knowledge-source storage are live. Every other module in the
            sidebar is a placeholder for its planned phase — see the README for the full roadmap.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <div className="text-2xl">{s.icon}</div>
              <div className="mt-2 text-2xl font-bold text-navy-950">{s.value}</div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Recent projects</h2>
          <Link href="/projects" className="text-sm font-medium text-brand-blue hover:underline">
            View all →
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <Card>
            <CardBody className="text-center text-sm text-slate-500">
              No projects yet.{' '}
              <Link href="/projects/new" className="font-medium text-brand-blue hover:underline">
                Set up your first project
              </Link>
              .
            </CardBody>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-surface-border">
              {recentProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted"
                >
                  <div>
                    <div className="text-sm font-medium text-navy-950">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.department.name}</div>
                  </div>
                  <Badge tone="brand">{p.status.replaceAll('_', ' ')}</Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
