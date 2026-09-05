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

export default async function DepartmentsPage() {
  const session = await getServerSession(authOptions);
  const canManage = can(session?.user.role, 'setup.manage');

  const departments = await prisma.department.findMany({
    include: {
      division: { include: { country: true } },
      departmentHead: true,
      projects: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Country / division / department structure and ownership."
        actions={canManage ? <Link href="/departments/new"><Button>+ New Department</Button></Link> : undefined}
      />

      {departments.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No departments configured yet"
          description="Set up a department before creating an AI transformation project for it."
          action={canManage ? <Link href="/departments/new"><Button>+ New Department</Button></Link> : undefined}
        />
      ) : (
        <Card>
          <div className="divide-y divide-surface-border">
            {departments.map((d) => (
              <Link key={d.id} href={`/departments/${d.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-surface-muted">
                <div>
                  <div className="text-sm font-semibold text-navy-950">{d.name}</div>
                  <div className="text-xs text-slate-500">
                    {d.division.country.name} · {d.division.name}
                    {d.serviceArea ? ` · ${d.serviceArea}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.departmentHead ? (
                    <span className="text-xs text-slate-500">Head: {d.departmentHead.name}</span>
                  ) : (
                    <Badge tone="caution">No department head</Badge>
                  )}
                  <Badge tone="brand">{d.projects.length} project{d.projects.length === 1 ? '' : 's'}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
