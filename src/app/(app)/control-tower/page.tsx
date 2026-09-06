import { notFound } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';

const currency = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default async function ControlTowerPage() {
  const session = await getServerSession(authOptions);
  if (!can(session?.user.role, 'executive.view')) notFound();

  const [
    departments,
    projectCount,
    completedInterviews,
    opportunityCount,
    proposedProjectCount,
    activeAgentCount,
    approvedGovernanceCount,
    roiEstimates
  ] = await Promise.all([
    prisma.department.findMany({
      include: {
        projects: {
          include: {
            processes: {
              include: {
                interviews: { where: { status: 'COMPLETED' } },
                aiOpportunities: true
              }
            }
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.aiTransformationProject.count(),
    prisma.interview.count({ where: { status: 'COMPLETED' } }),
    prisma.aiOpportunity.count({ where: { status: 'IDENTIFIED' } }),
    prisma.aiProject.count({ where: { status: 'PROPOSED' } }),
    prisma.agent.count({ where: { status: 'ACTIVE' } }),
    prisma.aiProject.count({ where: { governanceStatus: 'APPROVED' } }),
    prisma.roiEstimate.findMany({ select: { annualSavingsEstimate: true } })
  ]);

  const totalAnnualSavings = roiEstimates.reduce((sum, r) => sum + r.annualSavingsEstimate, 0);

  const stats = [
    { label: 'Departments', value: departments.length, icon: '🏢' },
    { label: 'AI transformation projects', value: projectCount, icon: '📁' },
    { label: 'Interviews completed', value: completedInterviews, icon: '💬' },
    { label: 'AI opportunities identified', value: opportunityCount, icon: '💡' },
    { label: 'AI projects proposed', value: proposedProjectCount, icon: '🤖' },
    { label: 'Agents active in production', value: activeAgentCount, icon: '📚' },
    { label: 'Approved into production (governance)', value: approvedGovernanceCount, icon: '⚖️' },
    { label: 'Estimated annual savings (all ROI estimates)', value: currency(totalAnnualSavings), icon: '📈' }
  ];

  const byDepartment = departments.map((d) => {
    const processes = d.projects.flatMap((p) => p.processes);
    return {
      id: d.id,
      name: d.name,
      projectCount: d.projects.length,
      completedInterviews: processes.reduce((sum, p) => sum + p.interviews.length, 0),
      opportunityCount: processes.reduce((sum, p) => sum + p.aiOpportunities.length, 0)
    };
  });

  return (
    <div>
      <PageHeader
        title="Transformation Control Tower"
        subtitle="Group-wide AI transformation metrics, rolled up across every department and project."
      />

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

      <div className="mt-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-navy-950">By department</h2>
          </CardHeader>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border text-xs text-slate-400">
                  <th className="px-5 py-2 font-medium">Department</th>
                  <th className="px-5 py-2 font-medium">Projects</th>
                  <th className="px-5 py-2 font-medium">Interviews completed</th>
                  <th className="px-5 py-2 font-medium">Opportunities identified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {byDepartment.map((d) => (
                  <tr key={d.id}>
                    <td className="px-5 py-2.5 font-medium text-navy-950">{d.name}</td>
                    <td className="px-5 py-2.5">{d.projectCount}</td>
                    <td className="px-5 py-2.5">{d.completedInterviews}</td>
                    <td className="px-5 py-2.5">{d.opportunityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
