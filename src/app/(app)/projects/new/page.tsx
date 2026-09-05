import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { createProject } from '@/lib/actions/projects';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Label, Select, Textarea, FormRow, FormSection } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import Link from 'next/link';

export default async function NewProjectPage({ searchParams }: { searchParams: { departmentId?: string } }) {
  const [departments, potentialOwners] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: 'asc' }, include: { division: { include: { country: true } } } }),
    prisma.user.findMany({ where: { role: { in: [Role.PROCESS_OWNER, Role.DEPARTMENT_HEAD, Role.ADMINISTRATOR] } }, orderBy: { name: 'asc' } })
  ]);

  if (departments.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="New Project" />
        <EmptyState
          icon="🏢"
          title="Create a department first"
          description="A project must belong to a department."
          action={<Link href="/departments/new"><Button>+ New Department</Button></Link>}
        />
      </div>
    );
  }

  async function action(formData: FormData) {
    'use server';
    const project = await createProject(formData);
    redirect(`/projects/${project.id}`);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New AI Transformation Project" subtitle="Everything here becomes context for the AI interview and every downstream module (spec section 4)." />
      <Card>
        <CardBody>
          <form action={action}>
            <FormSection title="Basics">
              <FormRow>
                <div>
                  <Label htmlFor="departmentId">Department</Label>
                  <Select id="departmentId" name="departmentId" defaultValue={searchParams.departmentId ?? ''} required>
                    <option value="" disabled>— Select —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.division.country.name} / {d.division.name} / {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="processOwnerId" hint="(optional)">Process owner</Label>
                  <Select id="processOwnerId" name="processOwnerId" defaultValue="">
                    <option value="">— Unassigned —</option>
                    {potentialOwners.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </div>
              </FormRow>
              <div>
                <Label htmlFor="name">Project name</Label>
                <Input id="name" name="name" placeholder="AI Company Formation Case Assistant" required />
              </div>
              <div>
                <Label htmlFor="description" hint="(optional)">Project description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <FormRow>
                <div>
                  <Label htmlFor="service" hint="(optional)">Analytix service line</Label>
                  <Input id="service" name="service" placeholder="Business Setup & PRO/GRO" />
                </div>
                <div>
                  <Label htmlFor="aiProjectIdea" hint="(optional)">Basic AI project idea</Label>
                  <Input id="aiProjectIdea" name="aiProjectIdea" placeholder="Document + follow-up assistant for case officers" />
                </div>
              </FormRow>
              <div>
                <Label htmlFor="businessObjective" hint="(optional)">Business objective</Label>
                <Textarea id="businessObjective" name="businessObjective" rows={2} />
              </div>
              <div>
                <Label htmlFor="interviewObjective" hint="(optional)">Interview objective</Label>
                <Textarea id="interviewObjective" name="interviewObjective" rows={2} placeholder="What should the AI interview specifically try to learn?" />
              </div>
            </FormSection>

            <FormSection title="Scope" description="Explicit boundaries the AI interview and process discovery must respect.">
              <FormRow>
                <div>
                  <Label htmlFor="inScopeActivities" hint="(one per line)">In-scope activities</Label>
                  <Textarea id="inScopeActivities" name="inScopeActivities" rows={4} />
                </div>
                <div>
                  <Label htmlFor="outOfScopeActivities" hint="(one per line)">Explicitly out-of-scope activities</Label>
                  <Textarea id="outOfScopeActivities" name="outOfScopeActivities" rows={4} />
                </div>
              </FormRow>
            </FormSection>

            <FormSection title="Known context" description="Backend facts and existing documentation — highest-trust sources per the knowledge precedence model (spec section 6).">
              <div>
                <Label htmlFor="currentSystems" hint="(optional)">Current systems used</Label>
                <Input id="currentSystems" name="currentSystems" placeholder="Odoo, Excel, Government Portal, WhatsApp" />
              </div>
              <div>
                <Label htmlFor="existingSopSummary" hint="(optional)">Existing SOP summary</Label>
                <Textarea id="existingSopSummary" name="existingSopSummary" rows={3} />
              </div>
              <div>
                <Label htmlFor="knownBackendFacts" hint="(optional)">Known backend facts</Label>
                <Textarea id="knownBackendFacts" name="knownBackendFacts" rows={3} />
              </div>
              <FormRow>
                <div>
                  <Label htmlFor="mandatoryChecks" hint="(optional)">Mandatory checks</Label>
                  <Textarea id="mandatoryChecks" name="mandatoryChecks" rows={3} />
                </div>
                <div>
                  <Label htmlFor="mandatoryApprovals" hint="(optional)">Mandatory approvals</Label>
                  <Textarea id="mandatoryApprovals" name="mandatoryApprovals" rows={3} />
                </div>
              </FormRow>
              <FormRow>
                <div>
                  <Label htmlFor="currentTemplates" hint="(optional)">Current templates</Label>
                  <Textarea id="currentTemplates" name="currentTemplates" rows={2} />
                </div>
                <div>
                  <Label htmlFor="currentForms" hint="(optional)">Current forms</Label>
                  <Textarea id="currentForms" name="currentForms" rows={2} />
                </div>
              </FormRow>
              <FormRow>
                <div>
                  <Label htmlFor="currentChecklists" hint="(optional)">Current checklists</Label>
                  <Textarea id="currentChecklists" name="currentChecklists" rows={2} />
                </div>
                <div>
                  <Label htmlFor="existingAiTools" hint="(optional)">Existing AI tools, if any</Label>
                  <Textarea id="existingAiTools" name="existingAiTools" rows={2} />
                </div>
              </FormRow>
              <FormRow>
                <div>
                  <Label htmlFor="policiesReferenced" hint="(optional)">Policies</Label>
                  <Textarea id="policiesReferenced" name="policiesReferenced" rows={2} />
                </div>
                <div>
                  <Label htmlFor="regulatoryReferences" hint="(optional)">Regulatory references</Label>
                  <Textarea id="regulatoryReferences" name="regulatoryReferences" rows={2} />
                </div>
              </FormRow>
            </FormSection>

            <FormSection title="Current-state baseline" description="Used later for ROI / business-case calculations — never fabricated, only what's actually known today.">
              <div>
                <Label htmlFor="existingPainPoints" hint="(optional)">Existing pain points</Label>
                <Textarea id="existingPainPoints" name="existingPainPoints" rows={3} />
              </div>
              <FormRow>
                <div>
                  <Label htmlFor="currentVolume" hint="(optional)">Current process volume</Label>
                  <Input id="currentVolume" name="currentVolume" placeholder="e.g. 20-25 cases / month" />
                </div>
                <div>
                  <Label htmlFor="currentManpower" hint="(optional)">Current manpower</Label>
                  <Input id="currentManpower" name="currentManpower" placeholder="e.g. 3 case officers, 1 team lead" />
                </div>
              </FormRow>
            </FormSection>

            <div className="flex justify-end gap-2 pt-6">
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
