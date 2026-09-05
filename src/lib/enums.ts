// SQLite (Phase 1's local dev datasource) does not support Prisma's native `enum` type, so the
// three fixed-vocabulary fields below (User.role, AiTransformationProject.status,
// KnowledgeSource.trustLevel) are plain `String` columns in prisma/schema.prisma. These
// const-object + derived-type pairs give the same ergonomics as a real TypeScript enum
// (`Role.ADMINISTRATOR` as a value, `Role` as a type) without relying on Prisma to generate it.
// When Phase 3 migrates the datasource to Postgres, these can move back into schema.prisma as
// real `enum` blocks if desired — call sites here would not need to change.

export const Role = {
  EMPLOYEE: 'EMPLOYEE',
  PROCESS_OWNER: 'PROCESS_OWNER',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  AI_TRANSFORMATION_COMMITTEE: 'AI_TRANSFORMATION_COMMITTEE',
  TECHNOLOGY_TEAM: 'TECHNOLOGY_TEAM',
  INFORMATION_SECURITY: 'INFORMATION_SECURITY',
  LEGAL_COMPLIANCE_REVIEWER: 'LEGAL_COMPLIANCE_REVIEWER',
  MANAGEMENT_CEO: 'MANAGEMENT_CEO',
  ADMINISTRATOR: 'ADMINISTRATOR'
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const SourceTrustLevel = {
  BACKEND_APPROVED: 'BACKEND_APPROVED',
  APPROVED_SOP_POLICY: 'APPROVED_SOP_POLICY',
  PROCESS_OWNER_CONFIRMED: 'PROCESS_OWNER_CONFIRMED',
  DEPARTMENT_HEAD_CONFIRMED: 'DEPARTMENT_HEAD_CONFIRMED',
  MULTI_EMPLOYEE_CONSENSUS: 'MULTI_EMPLOYEE_CONSENSUS',
  EMPLOYEE_STATEMENT: 'EMPLOYEE_STATEMENT',
  ANALYTIX_PUBLIC_KNOWLEDGE: 'ANALYTIX_PUBLIC_KNOWLEDGE',
  OFFICIAL_REGULATORY_SOURCE: 'OFFICIAL_REGULATORY_SOURCE',
  OTHER_RELIABLE_REFERENCE: 'OTHER_RELIABLE_REFERENCE',
  AI_INFERENCE: 'AI_INFERENCE'
} as const;
export type SourceTrustLevel = (typeof SourceTrustLevel)[keyof typeof SourceTrustLevel];

export const ProjectStatus = {
  SETUP: 'SETUP',
  DISCOVERY: 'DISCOVERY',
  PROPOSED: 'PROPOSED',
  COMMITTEE_REVIEW: 'COMMITTEE_REVIEW',
  APPROVED: 'APPROVED',
  DEVELOPMENT: 'DEVELOPMENT',
  TECHNICAL_REVIEW: 'TECHNICAL_REVIEW',
  PILOT: 'PILOT',
  PRODUCTION: 'PRODUCTION',
  MEASURING_IMPACT: 'MEASURING_IMPACT',
  ON_HOLD: 'ON_HOLD',
  ARCHIVED: 'ARCHIVED'
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];
