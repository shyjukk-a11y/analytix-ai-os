import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { ensureDefaultIntegrations } from '@/lib/integrations';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { IntegrationConfigForm } from '@/components/integrations/IntegrationConfigForm';

export default async function IntegrationsPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'admin.manage')) notFound();

  await ensureDefaultIntegrations();
  const integrations = await prisma.integration.findMany({
    include: { configuredBy: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="A registry of external connections — configuration status only. This app doesn't hold real credentials for any of these systems, so nothing here performs a live sync."
      />

      <Card>
        <div className="divide-y divide-surface-border">
          {integrations.map((i) => (
            <div key={i.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-950">{i.name}</span>
                  <Badge tone={i.status === 'CONFIGURED' ? 'success' : 'neutral'}>{i.status.replaceAll('_', ' ')}</Badge>
                </div>
                {i.status === 'CONFIGURED' ? (
                  <div className="mt-1 text-xs text-slate-500">
                    {i.endpointOrNote ? <div>{i.endpointOrNote}</div> : null}
                    <div>
                      Configured by {i.configuredBy?.name ?? 'someone'}
                      {i.configuredAt ? ` · ${i.configuredAt.toLocaleDateString()}` : ''}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Not configured yet.</p>
                )}
              </div>
              <IntegrationConfigForm
                id={i.id}
                name={i.name}
                endpointOrNote={i.endpointOrNote}
                isConfigured={i.status === 'CONFIGURED'}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
