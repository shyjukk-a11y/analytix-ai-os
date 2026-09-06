import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can, PERMISSIONS, ROLE_LABELS } from '@/lib/rbac';
import { Role } from '@/lib/enums';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

const PERMISSION_LABELS: Record<string, string> = {
  'setup.manage': 'Manage setup (departments/projects)',
  'admin.manage': 'Administration',
  'knowledge.upload': 'Upload knowledge sources',
  'executive.view': 'Executive dashboards',
  'interview.conduct': 'Conduct interviews',
  'interview.review': 'Review interviews & AI proposals',
  'governance.review': 'Act on governance stages',
  'security.view': 'View Security module'
};

export default async function SecurityPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'security.view')) notFound();

  const [users, recentAuditLogs] = await Promise.all([
    prisma.user.findMany({ select: { role: true, active: true } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { actor: true }
    })
  ]);

  const roles = Object.values(Role) as Role[];
  const permissions = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];

  const usersByRole = roles.map((role) => ({
    role,
    active: users.filter((u) => u.role === role && u.active).length,
    inactive: users.filter((u) => u.role === role && !u.active).length
  }));

  return (
    <div>
      <PageHeader
        title="Security"
        subtitle="Access posture (who can do what), active user counts by role, and a rolling audit trail of AI-usage and governance actions."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-navy-950">Active users by role</h2>
            <p className="text-xs text-slate-500">Data isolation is role-scoped — see the access matrix below for what each role can reach.</p>
          </CardHeader>
          <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {usersByRole.map((r) => (
              <div key={r.role} className="rounded-lg border border-surface-border px-3 py-2">
                <div className="text-xs text-slate-500">{ROLE_LABELS[r.role]}</div>
                <div className="text-lg font-semibold text-navy-950">
                  {r.active}
                  {r.inactive > 0 ? <span className="ml-1 text-xs font-normal text-slate-400">(+{r.inactive} inactive)</span> : null}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-navy-950">Access matrix</h2>
            <p className="text-xs text-slate-500">Every permission this application enforces, and which roles hold it.</p>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-slate-400">
                  <th className="px-5 py-2 font-medium">Permission</th>
                  <th className="px-5 py-2 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {permissions.map((perm) => (
                  <tr key={perm}>
                    <td className="px-5 py-2.5 font-medium text-navy-950">{PERMISSION_LABELS[perm] ?? perm}</td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {PERMISSIONS[perm].map((role) => (
                          <Badge key={role}>{ROLE_LABELS[role]}</Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-navy-950">Recent activity (audit trail)</h2>
            <p className="text-xs text-slate-500">The last 50 recorded actions across the platform — every AI generation, publish, and governance decision is logged here.</p>
          </CardHeader>
          <CardBody className="p-0">
            {recentAuditLogs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <div className="divide-y divide-surface-border">
                {recentAuditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <span className="font-medium text-navy-950">{log.actor?.name ?? 'System'}</span>
                      <span className="text-slate-500"> · {log.action} · {log.entityType}</span>
                    </div>
                    <span className="flex-none text-slate-400">{log.createdAt.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
