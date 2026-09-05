import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default async function AdministrationPage() {
  const [userCount, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.auditLog.findMany({ take: 15, orderBy: { createdAt: 'desc' }, include: { actor: true } })
  ]);

  return (
    <div>
      <PageHeader title="Administration" subtitle="Platform configuration, access and activity." />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/administration/users">
          <Card className="transition-shadow hover:shadow-cardLg">
            <CardBody>
              <div className="text-2xl">👥</div>
              <div className="mt-2 text-lg font-semibold text-navy-950">Users &amp; Roles</div>
              <div className="text-sm text-slate-500">{userCount} users provisioned</div>
            </CardBody>
          </Card>
        </Link>
        <Card>
          <CardBody>
            <div className="text-2xl">🧩</div>
            <div className="mt-2 text-lg font-semibold text-navy-950">Knowledge source storage</div>
            <div className="text-sm text-slate-500">Local disk (Phase 1) — see README for the S3 swap path.</div>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Recent audit log</h2>
      <Card>
        {auditLogs.length === 0 ? (
          <CardBody className="text-center text-sm text-slate-500">No activity recorded yet.</CardBody>
        ) : (
          <div className="divide-y divide-surface-border">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div>
                  <span className="font-medium text-navy-950">{log.actor?.name ?? 'System'}</span>
                  <span className="text-slate-500"> · {log.action}</span>
                </div>
                <Badge tone="neutral">{new Date(log.createdAt).toLocaleString()}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
