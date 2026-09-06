'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { userFormSchema } from '@/lib/validation';

/** Create a real (non-demo) user from the Users & Roles UI — the replacement for hand-editing
 * prisma/seed.ts. Password is set by the admin here; Phase 1 has no self-service reset or real
 * SSO yet (see auth.ts), so the admin is expected to share it with the new user out of band. */
export async function createUser(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertCan(session?.user.role, 'admin.manage');

  const parsed = userFormSchema.parse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    jobTitle: formData.get('jobTitle') || undefined
  });

  const org = await prisma.organization.findFirst();
  if (!org) {
    throw new Error('No organization is set up yet — create a department first.');
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.email } });
  if (existing) {
    throw new Error('A user with this email address already exists.');
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash,
      role: parsed.role,
      jobTitle: parsed.jobTitle || null,
      organizationId: org.id
    }
  });

  await writeAuditLog({
    actorId: session!.user.id,
    action: 'user.created',
    entityType: 'User',
    entityId: user.id,
    metadata: { name: user.name, email: user.email, role: user.role }
  });

  revalidatePath('/administration/users');
  revalidatePath('/administration');
  return user;
}

/** Activate/deactivate an existing user. Deactivated users are blocked at sign-in (see auth.ts's
 * `!user.active` check) without deleting their historical records (audit logs, generated SOPs,
 * conducted interviews, etc). */
export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const session = await getServerSession(authOptions);
  assertCan(session?.user.role, 'admin.manage');

  if (session!.user.id === userId && !active) {
    throw new Error('You cannot deactivate your own account.');
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { active } });

  await writeAuditLog({
    actorId: session!.user.id,
    action: active ? 'user.reactivated' : 'user.deactivated',
    entityType: 'User',
    entityId: user.id,
    metadata: { email: user.email }
  });

  revalidatePath('/administration/users');
}
