import { prisma } from '@/lib/prisma';
import type { InterviewState } from './interview-engine';

export type InterviewSuggestions = {
  departments: string[];
  roles: string[];
  activities: string[];
  processNames: string[];
};

/** Case-insensitive de-dupe that preserves first-seen order and casing, dropping blanks. */
function dedupe(values: (string | null | undefined)[], max = 8): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Builds "pick from these" suggestions for an interview's first four questions -- department,
 * role, day-to-day activities, and process name -- so an employee can select a value instead of
 * always typing free text. Every suggestion traces back to a real source: the project's own
 * Section 4 setup answers (captured at project creation), or what other employees already typed
 * while being interviewed for the very same project (which, since a project belongs to exactly
 * one department, also means the same department). Nothing here is generated or guessed.
 */
export async function loadInterviewSuggestions(projectId: string): Promise<InterviewSuggestions> {
  const [project, siblingInterviews, siblingProcesses] = await Promise.all([
    prisma.aiTransformationProject.findUnique({
      where: { id: projectId },
      include: { department: true }
    }),
    prisma.interview.findMany({
      where: { process: { projectId } },
      select: { stateJson: true }
    }),
    prisma.process.findMany({
      where: { projectId, name: { not: null } },
      select: { name: true },
      distinct: ['name']
    })
  ]);

  const states = siblingInterviews
    .map((i) => {
      try {
        return JSON.parse(i.stateJson) as InterviewState;
      } catch {
        return null;
      }
    })
    .filter((s): s is InterviewState => s !== null);

  const departments = dedupe([project?.department.name, ...states.map((s) => s.department)]);
  const roles = dedupe(states.map((s) => s.role));

  const activitiesFromProject = (project?.inScopeActivities ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const activities = dedupe([...activitiesFromProject, ...states.map((s) => s.mainActivities)]);

  const processNames = dedupe([...siblingProcesses.map((p) => p.name), ...states.map((s) => s.name)]);

  return { departments, roles, activities, processNames };
}
