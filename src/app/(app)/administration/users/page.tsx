import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { UserActiveToggle } from '@/components/administration/UserActiveToggle';
import { ROLE_LABELS, can } from '@/lib/rbac';
import type { Role } from '@/lib/enums';

export default async function UsersPage() {
  const [session, users] = await Promise.all([
    getServerSession(authOptions),
    prisma.user.findMany({ orderBy: { name: 'asc' } })
  ]);
  const canManage = can(session?.user.role, 'admin.manage');

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Everyone provisioned on the platform, one row per account."
        actions={
          canManage ? (
            <Link href="/administration/users/new">
              <Button>+ New User</Button>
            </Link>
          ) : undefined
        }
      />
      <Card>
        <div className="divide-y divide-surface-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-navy-950">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-3">
                {u.isDemoUser ? <Badge tone="neutral">Demo</Badge> : null}
                {!u.active ? <Badge tone="critical">Inactive</Badge> : null}
                <Badge tone="brand">{ROLE_LABELS[u.role as Role]}</Badge>
                {canManage ? (
                  <UserActiveToggle userId={u.id} active={u.active} disabled={u.id === session?.user.id} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
