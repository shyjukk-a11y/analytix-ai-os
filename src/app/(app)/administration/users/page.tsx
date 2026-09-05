import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ROLE_LABELS } from '@/lib/rbac';

export default async function UsersPage() {
  const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Seeded demo users, one per role. User creation UI lands alongside real SSO in a later phase — edit prisma/seed.ts for now."
      />
      <Card>
        <div className="divide-y divide-surface-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3">
              <div>
                <div className="text-sm font-medium text-navy-950">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {u.isDemoUser ? <Badge tone="neutral">Demo</Badge> : null}
                <Badge tone="brand">{ROLE_LABELS[u.role]}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
