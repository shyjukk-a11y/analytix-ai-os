import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { createDepartment } from '@/lib/actions/departments';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input, Label, Select, FormRow } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export default async function NewDepartmentPage() {
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.DEPARTMENT_HEAD, Role.ADMINISTRATOR] } },
    orderBy: { name: 'asc' }
  });

  async function action(formData: FormData) {
    'use server';
    const dept = await createDepartment(formData);
    redirect(`/departments/${dept.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New Department" subtitle="Set up the org structure before creating projects under it." />
      <Card>
        <CardBody>
          <form action={action} className="space-y-4">
            <FormRow>
              <div>
                <Label htmlFor="countryName">Country</Label>
                <Input id="countryName" name="countryName" placeholder="United Arab Emirates" required />
              </div>
              <div>
                <Label htmlFor="divisionName">Division</Label>
                <Input id="divisionName" name="divisionName" placeholder="Business Setup & Corporate Services" required />
              </div>
            </FormRow>
            <div>
              <Label htmlFor="departmentName">Department name</Label>
              <Input id="departmentName" name="departmentName" placeholder="Company Formation Team" required />
            </div>
            <div>
              <Label htmlFor="serviceArea">Analytix service area</Label>
              <Select id="serviceArea" name="serviceArea" defaultValue="">
                <option value="">— Select —</option>
                <option>Business Advisory & Strategic Consulting</option>
                <option>Business Setup & PRO/GRO</option>
                <option>Legal Advisory & Dispute Resolution</option>
                <option>Accounting, Tax & Audit</option>
                <option>Industrial & Manufacturing Support</option>
                <option>Vendor & Compliance</option>
                <option>Startup & Innovation</option>
                <option>Office & Real Estate</option>
                <option>Technology & Digital</option>
                <option>Talent & HR</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="departmentHeadId" hint="(optional)">Department head</Label>
              <Select id="departmentHeadId" name="departmentHeadId" defaultValue="">
                <option value="">— Unassigned —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit">Create Department</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
