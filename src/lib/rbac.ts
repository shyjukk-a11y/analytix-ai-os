import { Role } from '@prisma/client';

/**
 * Role-based access control (Phase 1).
 *
 * Every role from spec section 3 is represented. Permissions here are intentionally coarse —
 * Phase 1 only needs to gate the modules it actually implements (setup, administration).
 * Later phases should extend `PERMISSIONS` rather than scattering role checks around the app.
 */

export const ROLE_LABELS: Record<Role, string> = {
  EMPLOYEE: 'Employee',
  PROCESS_OWNER: 'Process Owner',
  DEPARTMENT_HEAD: 'Department Head',
  AI_TRANSFORMATION_COMMITTEE: 'AI Transformation Committee',
  TECHNOLOGY_TEAM: 'Technology Team',
  INFORMATION_SECURITY: 'Information Security',
  LEGAL_COMPLIANCE_REVIEWER: 'Legal / Compliance Reviewer',
  MANAGEMENT_CEO: 'Management / CEO',
  ADMINISTRATOR: 'Administrator'
};

export type Permission =
  | 'setup.manage' // create/edit departments & projects
  | 'admin.manage' // administration module (users, config)
  | 'knowledge.upload'
  | 'executive.view';

const PERMISSIONS: Record<Permission, Role[]> = {
  'setup.manage': ['ADMINISTRATOR', 'DEPARTMENT_HEAD', 'PROCESS_OWNER'],
  'admin.manage': ['ADMINISTRATOR'],
  'knowledge.upload': [
    'ADMINISTRATOR',
    'DEPARTMENT_HEAD',
    'PROCESS_OWNER',
    'EMPLOYEE',
    'TECHNOLOGY_TEAM'
  ],
  'executive.view': ['ADMINISTRATOR', 'MANAGEMENT_CEO', 'AI_TRANSFORMATION_COMMITTEE', 'DEPARTMENT_HEAD']
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[permission].includes(role);
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Throws ForbiddenError if the role lacks the permission. Use inside server actions/route handlers. */
export function assertCan(role: Role | undefined | null, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError();
  }
}
