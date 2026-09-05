'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { departmentFormSchema } from '@/lib/validation';

// Phase 1 keeps org/country/division implicit: every department is created under a single
// default Organization + Country + Division, upserted by name. Multi-org / multi-country
// selection UI is straightforward to add later on top of this same schema.
async function getOrCreateDefaultOrgStructure(countryName: string, divisionName: string) {
  let org = await prisma.organization.findFirst();
  if (!org) {
    org = await prisma.organization.create({ data: { name: 'Analytix Group' } });
  }

  const country = await prisma.country.upsert({
    where: { organizationId_name: { organizationId: org.id, name: countryName } },
    update: {},
    create: { organizationId: org.id, name: countryName }
  });

  const division = await prisma.division.upsert({
    where: { countryId_name: { countryId: country.id, name: divisionName } },
    update: {},
    create: { countryId: country.id, name: divisionName }
  });

  return { org, country, division };
}

export async function createDepartment(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertCan(session?.user.role, 'setup.manage');

  const parsed = departmentFormSchema.parse({
    countryName: formData.get('countryName'),
    divisionName: formData.get('divisionName'),
    departmentName: formData.get('departmentName'),
    serviceArea: formData.get('serviceArea') || undefined,
    departmentHeadId: formData.get('departmentHeadId') || undefined
  });

  const { division } = await getOrCreateDefaultOrgStructure(parsed.countryName, parsed.divisionName);

  const department = await prisma.department.create({
    data: {
      name: parsed.departmentName,
      serviceArea: parsed.serviceArea,
      divisionId: division.id,
      departmentHeadId: parsed.departmentHeadId || null
    }
  });

  await writeAuditLog({
    actorId: session!.user.id,
    action: 'department.created',
    entityType: 'Department',
    entityId: department.id,
    metadata: { name: department.name }
  });

  revalidatePath('/departments');
  return department;
}
