import { z } from 'zod';

export const departmentFormSchema = z.object({
  countryName: z.string().min(1, 'Country is required'),
  divisionName: z.string().min(1, 'Division is required'),
  departmentName: z.string().min(1, 'Department name is required'),
  serviceArea: z.string().optional(),
  departmentHeadId: z.string().optional()
});
export type DepartmentFormInput = z.infer<typeof departmentFormSchema>;

export const projectFormSchema = z.object({
  departmentId: z.string().min(1, 'Department is required'),
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  service: z.string().optional(),
  businessObjective: z.string().optional(),
  aiProjectIdea: z.string().optional(),
  processOwnerId: z.string().optional(),
  interviewObjective: z.string().optional(),
  inScopeActivities: z.string().optional(),
  outOfScopeActivities: z.string().optional(),
  currentSystems: z.string().optional(),
  existingSopSummary: z.string().optional(),
  knownBackendFacts: z.string().optional(),
  mandatoryChecks: z.string().optional(),
  mandatoryApprovals: z.string().optional(),
  currentTemplates: z.string().optional(),
  currentForms: z.string().optional(),
  currentChecklists: z.string().optional(),
  policiesReferenced: z.string().optional(),
  regulatoryReferences: z.string().optional(),
  existingPainPoints: z.string().optional(),
  currentVolume: z.string().optional(),
  currentManpower: z.string().optional(),
  existingAiTools: z.string().optional()
});
export type ProjectFormInput = z.infer<typeof projectFormSchema>;
