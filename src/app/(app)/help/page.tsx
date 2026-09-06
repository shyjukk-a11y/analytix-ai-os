import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { NAV_MODULES } from '@/lib/nav-config';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';

export default async function HelpIndexPage() {
  const session = await getServerSession(authOptions);
  const visibleModules = NAV_MODULES.filter((m) => m.slug !== 'help' && (!m.requires || can(session?.user.role, m.requires)));

  return (
    <div>
      <PageHeader title="Help & User Manual" subtitle="What every module does, how to use it, and the overall flow of the software." />

      <Card className="mb-6">
        <CardBody>
          <h2 className="mb-2 text-sm font-semibold text-navy-950">How it all fits together</h2>
          <p className="mb-2 text-sm text-slate-600">
            The software follows one end-to-end flow, phase by phase. Set up the org structure first
            (<strong>Departments</strong> → <strong>Projects</strong>), then capture how work actually happens today
            through <strong>AI Interviews</strong> — either directly or via a shareable no-login link. Everything
            captured feeds the read-only discovery views (<strong>Process Discovery</strong>,{' '}
            <strong>Digital Twin</strong>, <strong>Process Maps</strong>, <strong>Bottlenecks</strong>,{' '}
            <strong>Knowledge Base</strong>) and, once you generate one, the <strong>SOP Library</strong>.
          </p>
          <p className="mb-2 text-sm text-slate-600">
            Where an interview surfaces a confirmed automation idea, it becomes an{' '}
            <strong>AI Opportunity</strong>, which can be developed into an <strong>AI Project</strong> business
            case, estimated in <strong>ROI</strong>, published to the <strong>Agent Library</strong>, and — for
            production-bound projects — walked through the six-stage <strong>Governance</strong> sign-off chain
            (visible in one place under <strong>Approvals</strong>). A published SOP can also generate a{' '}
            <strong>Training</strong> module, stay current through <strong>Continuous Improvement</strong> change
            requests, and have its real-world impact tracked in <strong>Impact Measurement</strong> 30/60/90 days
            after launch. <strong>Control Tower</strong> and the <strong>Dashboard</strong> roll all of this up;{' '}
            <strong>Security</strong>, <strong>Integrations</strong> and <strong>Administration</strong> cover
            platform posture, connectors and user/role management underneath everything else.
          </p>
          <p className="text-sm text-slate-600">
            You&rsquo;ll only ever see the modules your role has access to in the sidebar — that&rsquo;s expected,
            not a bug. Every page also has a small <strong>?</strong> next to its title linking straight back to
            that module&rsquo;s article below.
          </p>
        </CardBody>
      </Card>

      <Card>
        <div className="divide-y divide-surface-border">
          {visibleModules.map((mod) => (
            <Link
              key={mod.slug}
              href={`/help/${mod.slug}`}
              className="flex items-center gap-3 px-5 py-4 hover:bg-surface-muted"
            >
              <span className="w-6 flex-none text-center text-lg">{mod.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-navy-950">{mod.label}</div>
                <div className="truncate text-xs text-slate-500">{mod.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
