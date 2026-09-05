'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertCan } from '@/lib/rbac';
import { writeAuditLog } from '@/lib/audit';
import { projectFormSchema } from '@/lib/validation';
import { knowledgeStorage, ALLOWED_KNOWLEDGE_MIME_TYPES, MAX_KNOWLEDGE_FILE_SIZE_BYTES } from '@/lib/storage';

function textFieldsFromForm(formData: FormData) {
  const keys = [
    'service', 'businessObjective', 'aiProjectIdea', 'interviewObjective', 'inScopeActivities',
    'outOfScopeActivities', 'currentSystems', 'existingSopSummary', 'knownBackendFacts',
    'mandatoryChecks', 'mandatoryApprovals', 'currentTemplates', 'currentForms', 'currentChecklists',
    'policiesReferenced', 'regulatoryReferences', 'existingPainPoints', 'currentVolume',
    'currentManpower', 'existingAiTools'
  ] as const;

  const out: Record<string, string | undefined> = {};
  for (const key of keys) {
    out[key] = (formData.get(key) as string) || undefined;
  }
  return out;
}

export async function createProject(formData: FormData) {
  const session = await getServerSession(authOptions);
  assertCan(session?.user.role, 'setup.manage');

  const parsed = projectFormSchema.parse({
    departmentId: formData.get('departmentId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    processOwnerId: formData.get('processOwnerId') || undefined,
    ...textFieldsFromForm(formData)
  });

  const org = await prisma.organization.findFirstOrThrow();

  const project = await prisma.aiTransformationProject.create({
    data: {
      ...parsed,
      organizationId: org.id
    }
  });

  await writeAuditLog({
    actorId: session!.user.id,
    action: 'project.created',
    entityType: 'AiTransformationProject',
    entityId: project.id,
    metadata: { name: project.name }
  });

  revalidatePath('/projects');
  return project;
}

export async function uploadKnowledgeSource(projectId: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  assertCan(session?.user.role, 'knowledge.upload');

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    throw new Error('No file provided.');
  }
  if (file.size > MAX_KNOWLEDGE_FILE_SIZE_BYTES) {
    throw new Error('File exceeds the 20MB limit for Phase 1 local storage.');
  }
  if (!ALLOWED_KNOWLEDGE_MIME_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}. Allowed: PDF, Word, Excel, PNG/JPEG/WebP.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = await knowledgeStorage.save(projectId, file.name, buffer);

  const source = await prisma.knowledgeSource.create({
    data: {
      projectId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      storagePath,
      uploadedById: session!.user.id
      // trustLevel defaults to EMPLOYEE_STATEMENT until a process owner / admin promotes it —
      // see spec section 6/28: uploaded content is never silently treated as approved policy.
    }
  });

  await writeAuditLog({
    actorId: session!.user.id,
    action: 'knowledge_source.uploaded',
    entityType: 'KnowledgeSource',
    entityId: source.id,
    metadata: { fileName: file.name, projectId }
  });

  revalidatePath(`/projects/${projectId}`);
  return source;
}
