import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';
import type { NavModule } from '@/lib/nav-config';

export function ComingSoon({ mod }: { mod: NavModule }) {
  return (
    <div>
      <PageHeader
        title={mod.label}
        subtitle={mod.description}
        actions={<Badge tone="brand">Planned for Phase {mod.phase}</Badge>}
      />
      <EmptyState
        icon={mod.icon}
        title="Not built yet"
        description={`${mod.label} is part of the product roadmap (see README) but hasn't been implemented in this build. It ships in Phase ${mod.phase} of the plan.`}
      />
    </div>
  );
}
