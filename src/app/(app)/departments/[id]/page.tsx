import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default async function DepartmentDetailPage({ params }: { params: { id: string } }) {
  const department = await prisma.department.findUnique({
    where: { id: params.id },
    include: {
      division: { include: { country: true } },
      departmentHead: true,
      projects: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!department) notFound();

  return (
    <div>
      <PageHeader
        title={department.name}
        subtitle={`${department.division.country.name} · ${department.division.name}${department.serviceArea ? ' · ' + department.serviceArea : ''}`}
        actions={<Link href={`/projects/new?departmentId=${department.id}`}><Button>+ New Project</Button></Link>}
      />

      <Card className="mb-6">
        <CardBody className="flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-slate-400">Department head</div>
            <div className="font-medium text-navy-950">{department.departmentHead?.name ?? 'Unassigned'}</div>
          </div>
          <div>
            <div className="text-slate-400">Projects</div>
            <div className="font-medium text-navy-950">{department.projects.length}</div>
          </div>
        </CardBody>
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Projects</h2>
      {department.projects.length === 0 ? (
        <EmptyState icon="📁" title="No projects yet" description="Create the first AI transformation project for this department." />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {department.projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-surface-muted">
                <span className="text-sm font-medium text-navy-950">{p.name}</span>
                <Badge tone="brand">{p.status.replaceAll('_', ' ')}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
