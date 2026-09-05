import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// All demo accounts share this password (see also src/app/login/page.tsx, which lists them).
const DEMO_PASSWORD = 'Passw0rd!';

const DEMO_USERS: { name: string; email: string; role: Role; jobTitle: string }[] = [
  { name: 'Aisha Khan', email: 'admin@analytix.demo', role: 'ADMINISTRATOR', jobTitle: 'Platform Administrator' },
  { name: 'Rashid Al Marri', email: 'ceo@analytix.demo', role: 'MANAGEMENT_CEO', jobTitle: 'Group CEO' },
  { name: 'Fatima Noor', email: 'depthead@analytix.demo', role: 'DEPARTMENT_HEAD', jobTitle: 'Head of Business Setup & Corporate Services' },
  { name: 'Sandeep Menon', email: 'processowner@analytix.demo', role: 'PROCESS_OWNER', jobTitle: 'Team Lead, Company Formation' },
  { name: 'Priya Nair', email: 'employee@analytix.demo', role: 'EMPLOYEE', jobTitle: 'Case Officer' },
  { name: 'Transformation Committee', email: 'committee@analytix.demo', role: 'AI_TRANSFORMATION_COMMITTEE', jobTitle: 'AI Transformation Committee Member' },
  { name: 'Wei Zhang', email: 'tech@analytix.demo', role: 'TECHNOLOGY_TEAM', jobTitle: 'Technology Lead' },
  { name: 'Omar Haddad', email: 'infosec@analytix.demo', role: 'INFORMATION_SECURITY', jobTitle: 'Information Security Officer' },
  { name: 'Layla Saeed', email: 'legal@analytix.demo', role: 'LEGAL_COMPLIANCE_REVIEWER', jobTitle: 'Legal & Compliance Reviewer' }
];

async function main() {
  console.log('Seeding organization structure…');

  const org = await prisma.organization.upsert({
    where: { id: 'seed-org-analytix' },
    update: {},
    create: { id: 'seed-org-analytix', name: 'Analytix Group' }
  });

  const country = await prisma.country.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'United Arab Emirates' } },
    update: {},
    create: { organizationId: org.id, name: 'United Arab Emirates', isoCode: 'AE' }
  });

  const division = await prisma.division.upsert({
    where: { countryId_name: { countryId: country.id, name: 'Business Setup & Corporate Services' } },
    update: {},
    create: { countryId: country.id, name: 'Business Setup & Corporate Services' }
  });

  console.log('Seeding demo users…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const createdUsers: Record<string, string> = {};
  for (const u of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        name: u.name,
        email: u.email,
        role: u.role,
        jobTitle: u.jobTitle,
        passwordHash,
        isDemoUser: true,
        organizationId: org.id
      }
    });
    createdUsers[u.role] = user.id;
  }

  console.log('Seeding demo department (spec section 62)…');
  const department = await prisma.department.upsert({
    where: { divisionId_name: { divisionId: division.id, name: 'Business Setup & Corporate Services' } },
    update: {},
    create: {
      name: 'Business Setup & Corporate Services',
      serviceArea: 'Business Setup & PRO/GRO',
      divisionId: division.id,
      departmentHeadId: createdUsers['DEPARTMENT_HEAD']
    }
  });

  console.log('Seeding demo project (spec section 62)…');
  const existingProject = await prisma.aiTransformationProject.findFirst({
    where: { name: 'AI Company Formation Case Assistant' }
  });

  if (!existingProject) {
    await prisma.aiTransformationProject.create({
      data: {
        name: 'AI Company Formation Case Assistant',
        description:
          'Understand how company formation cases are actually processed today, then design an AI assistant for document handling, follow-up and status tracking.',
        organizationId: org.id,
        departmentId: department.id,
        processOwnerId: createdUsers['PROCESS_OWNER'],
        service: 'Business Setup & PRO/GRO',
        businessObjective: 'Reduce case turnaround time and manual follow-up effort for company formation cases.',
        aiProjectIdea: 'A case assistant that checks document completeness, drafts client follow-ups, and tracks government portal status automatically.',
        interviewObjective: 'Reconstruct the real, current company formation workflow end-to-end, including every handoff, wait and exception.',
        inScopeActivities:
          'Client engagement\nDocument collection\nDocument completeness checking\nMissing-document follow-up\nOdoo case update\nTeam-lead review\nGovernment authority submission\nStatus monitoring\nApproval/output handling\nClient handover',
        outOfScopeActivities: 'Contract drafting\nPricing and invoicing\nMarketing and lead generation',
        currentSystems: 'Odoo, Excel, Government Portal, WhatsApp, Email',
        existingPainPoints:
          'Missing documents\nDuplicate data entry across Odoo and Excel\nManual client follow-up\nManual government portal status checking\nRejection-handling knowledge held by a few experienced staff',
        currentVolume: '20-25 cases / month (approximate, to be confirmed during interviews)',
        currentManpower: '3 case officers, 1 team lead'
      }
    });
  }

  console.log('\nSeed complete. Demo login (any account, password: %s):', DEMO_PASSWORD);
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role.padEnd(28)} ${u.email}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
