// User manual content for the Help module (src/app/(app)/help). One entry per NAV_MODULES slug
// (except 'help' itself) — kept as plain data so /help/page.tsx and /help/[slug]/page.tsx can
// stay dumb renderers. Written from how each module's server actions and RBAC gates actually
// behave (see src/lib/actions/*.ts and src/lib/rbac.ts), not aspirational copy.

export type HelpArticle = {
  overview: string;
  howTo: string[];
  tips: string[];
};

export const HELP_CONTENT: Record<string, HelpArticle> = {
  dashboard: {
    overview: 'Your home screen — a quick read on what has been set up so far (departments, projects, users) so you can tell at a glance whether the organization structure is in place.',
    howTo: [
      'Open this page any time you want a birds-eye check of setup progress.',
      'Use the counts and lists here as a jumping-off point — click through to Departments or Projects to dig in.'
    ],
    tips: [
      'If a number here looks low, it usually means Departments or Projects still need setting up — start there.'
    ]
  },
  'control-tower': {
    overview: 'A group-wide rollup of transformation metrics across every country and department — the executive view of how the whole AI transformation program is progressing, not just one project.',
    howTo: [
      'Use this when you need a leadership-level summary rather than a single process\'s detail.',
      'Drill from a summary number back into the relevant module (Governance, ROI, AI Projects) for the underlying detail.'
    ],
    tips: [
      'Only visible to roles with executive-view access (Administrator, Management/CEO, AI Transformation Committee, Department Head) — if you can\'t see it, that\'s expected for your role.'
    ]
  },
  departments: {
    overview: 'The org structure: Country → Division → Department. Every project and process belongs to a department, so this is usually the first thing to set up for a new part of the business.',
    howTo: [
      'Create a Department under the right Division/Country before creating a Project for it.',
      'Assign a Department Head so ownership is clear and RBAC (setup.manage, executive.view) resolves correctly for that person.'
    ],
    tips: [
      'You can\'t create a Project without a Department, and a Department name must be unique within its Division — plan the structure once rather than renaming later.'
    ]
  },
  projects: {
    overview: 'An "AI transformation project" — the scoping record (objective, in/out of scope, current systems, pain points) that every AI Interview and discovered Process is anchored to.',
    howTo: [
      'Fill in as much of the setup fields as you know up front (objective, scope, current systems) — interviewers and reviewers rely on this context later.',
      'Once the project exists, go to AI Interviews (or generate a shareable interview link) to start capturing how the work is actually done today.'
    ],
    tips: [
      'You can upload supporting knowledge sources (existing SOPs, policies) to a project — they\'re stored as reference context, not yet auto-parsed into facts.'
    ]
  },
  'process-discovery': {
    overview: 'Every process employees have started describing via an AI Interview, and how far each capture has gotten — the first stop for reviewing what\'s been discovered.',
    howTo: [
      'Click a row to open its Digital Twin — the structured view of everything captured for that process.',
      'Watch the "% in progress" badge to see which processes still need interviews finished before a reliable SOP can be generated.'
    ],
    tips: [
      'The trash icon on a row lets a reviewer delete just that process\'s AI Interviews (keeping any SOP/Knowledge/AI Opportunities already built) or, for Administrators, delete the process and everything built from it — always shows exactly what will be affected first.'
    ]
  },
  'ai-interviews': {
    overview: 'Multilingual, AI-led interviews that capture how work actually happens today, one question at a time — the core data-capture engine the rest of the app is built on.',
    howTo: [
      'Pick a project and language, then Start Interview — the AI walks the employee through trigger, steps, systems, exceptions and more.',
      'If a colleague already described this exact process, choose "Another perspective on: [process]" instead of starting a new one — their answers get compared, and any real disagreement is flagged for a reviewer to resolve before an SOP is generated.',
      'Reviewers can generate a no-login-required Shareable Interview Link for a staff member instead of asking them to sign in themselves.'
    ],
    tips: [
      'An interview can be resumed later — it isn\'t lost if the employee closes the tab partway through.',
      'AI Observation cards (duplicate entry, doc dependency, etc.) always need an explicit Yes/Partly/No from the employee — the engine never assumes them confirmed.'
    ]
  },
  'digital-twin': {
    overview: 'A structured, visual read-out of one discovered process — trigger, steps, systems, dependencies, exceptions — built directly from the captured interview, nothing invented.',
    howTo: [
      'Open a process from Process Discovery or the Digital Twin list to see its full captured picture.',
      'If more than one interview exists for a process, this page shows the "best" one (most complete/most recent) plus a list of the others.'
    ],
    tips: [
      'If two interviews on the same process disagree, look for the "Needs review" flag in SOP Library — that\'s where a reviewer reconciles the difference, not here.'
    ]
  },
  'process-maps': {
    overview: 'The same captured process rendered as a simple visual flowchart — one box per step, with a decision branch shown where an approval/rejection point was captured.',
    howTo: [
      'Use this when a step-by-step visual is more useful than the Digital Twin\'s field-by-field layout — e.g. for a training handout or a quick walkthrough with the team.'
    ],
    tips: [
      'The flowchart is hand-built from Tailwind boxes, not a diagramming library — it\'s deliberately simple and always renders, with no external dependency to break.'
    ]
  },
  'sop-library': {
    overview: 'Generated Standard Operating Procedures — one deterministic markdown document per process, built from captured facts, with Draft/Published status.',
    howTo: [
      'Once a process has at least one completed interview, click Generate SOP.',
      'If the process shows "Needs review" instead, two or more employees described it differently — click Resolve to pick the correct answer for each field that disagreed before you can generate or update the SOP.',
      'Toggle a generated SOP between Draft and Published once you\'re satisfied it\'s accurate.'
    ],
    tips: [
      'Every line in a generated SOP either quotes what an employee said or says "Not captured during interview" — nothing is invented, so a thin SOP usually means the interview needs to go deeper, not that the generator is broken.',
      'Regenerating an SOP always re-derives it fresh from the current primary interview — any manual edits you might expect to persist do not; raise a Change Request instead (see Continuous Improvement) if the wording needs a one-off correction.'
    ]
  },
  'knowledge-base': {
    overview: 'Every distinct knowledge/template statement an employee mentioned during an interview (a checklist, a reference sheet, a rule of thumb) — auto-collected, not manually catalogued.',
    howTo: [
      'Browse here to see what institutional knowledge has already surfaced from interviews across the organization.'
    ],
    tips: [
      'Entries are deduplicated per process by exact text, so if two employees mention the same checklist you\'ll see it once, not twice.'
    ]
  },
  bottlenecks: {
    overview: 'Detected bottlenecks with the evidence behind them — pulled from the "problems" and delay/wait detail an employee actually described during their interview.',
    howTo: [
      'Use this as a starting point for process-improvement conversations — every bottleneck traces back to a specific interview answer, so you can go verify it directly.'
    ],
    tips: []
  },
  'ai-opportunities': {
    overview: 'AI automation opportunities, auto-created whenever an employee confirms (Yes or Partly) an AI Observation during their interview — never a bottom-up guess, always tied to a real confirmed observation.',
    howTo: [
      'Review each opportunity\'s impact/effort banding, then either dismiss it or move it forward by generating an AI Project business case.'
    ],
    tips: [
      'Dismissing an opportunity here is remembered — regenerating or re-syncing from a later interview never silently un-dismisses it.'
    ]
  },
  'ai-projects': {
    overview: 'A deterministic business-case document generated from one AI Opportunity — the deliberate "should we actually build this" synthesis step, mirroring how the SOP Library works.',
    howTo: [
      'Generate a business case from a promising opportunity, mark it Proposed once it\'s ready, then either publish it to the Agent Library or send it into Governance for sign-off.'
    ],
    tips: []
  },
  'agent-library': {
    overview: 'Published, reusable AI agent components — the productized form of an AI Project once it\'s been proposed and judged worth cataloguing for reuse elsewhere in the organization.',
    howTo: [
      'Publish an agent from a Proposed AI Project. The library then surfaces "reuse candidates" — other identified opportunities of the same kind elsewhere that this same agent could address.'
    ],
    tips: []
  },
  roi: {
    overview: 'A transparent, formula-based savings estimate for an AI Opportunity — built from reviewer-supplied case volume and cost-per-hour, never a fabricated financial model.',
    howTo: [
      'Enter your monthly case volume and cost per hour for an opportunity to calculate estimated monthly/annual savings.',
      'The assumptions behind every number are spelled out on the page — read them before quoting the figure elsewhere.'
    ],
    tips: [
      'Recalculating overwrites the previous estimate for that opportunity — there\'s no history of prior estimates, so note down a figure elsewhere if you need to compare versions.'
    ]
  },
  governance: {
    overview: 'The fixed 6-stage sign-off chain a proposed AI project goes through — Process Owner → Department Head → Legal/Compliance → Information Security → AI Transformation Committee → Management/CEO — before it can go to production.',
    howTo: [
      'Start governance review on a Proposed AI Project. Stages must be decided strictly in order — you can\'t skip ahead.',
      'Each stage can only be approved or rejected by the specific role it names (or an Administrator) — everyone else sees it as read-only.',
      'A rejected chain can be restarted from scratch after rework.'
    ],
    tips: [
      '"3/6 approved" always means stages 1 through 3 specifically, never an out-of-sequence subset — the next actionable stage is always the first PENDING one.'
    ]
  },
  approvals: {
    overview: 'A single cross-project view of every governance stage currently awaiting a decision — useful if you hold one of the sign-off roles and want to see everything waiting on you in one place, instead of hunting through Governance project by project.',
    howTo: [
      'Check here first if you know you have sign-offs pending; click through to act on any of them.'
    ],
    tips: []
  },
  security: {
    overview: 'An honest record of the platform\'s access, data-isolation and AI-usage audit posture — what\'s actually configured, not a marketing claim of what\'s theoretically possible.',
    howTo: [
      'Use this to answer "who can see what" questions, or to prepare for an internal security review.'
    ],
    tips: []
  },
  training: {
    overview: 'A deterministic training module generated from a published SOP — turns its step-by-step procedure and known pain points into a learning outline, ready to use for onboarding.',
    howTo: [
      'Publish an SOP first — a training module can only be generated from a published one.',
      'Regenerate any time the underlying SOP changes materially.'
    ],
    tips: []
  },
  'continuous-improvement': {
    overview: 'The feedback loop for a published SOP: anyone who can be interviewed (not just reviewers) can flag "this needs review" with a short note, and a reviewer resolves it.',
    howTo: [
      'Spot something stale or wrong in a published SOP? Raise a Change Request against it rather than waiting for a full re-interview.',
      'Reviewers: mark a request In Progress while working it, then Resolved with a note on what changed.'
    ],
    tips: [
      'Raising a change request never edits the SOP itself — it\'s a flag for a human to act on, by design.'
    ]
  },
  'impact-measurement': {
    overview: '30/60/90-day before-vs-after checkpoints against a published Agent\'s baseline ROI estimate — always a reviewer\'s own reported numbers, since the platform has no live usage telemetry to pull from.',
    howTo: [
      'At each checkpoint, enter the actual volume/hours-saved/savings you observed for that agent.'
    ],
    tips: [
      'A checkpoint with no recorded date just means it hasn\'t been measured yet, even if its due date has passed — it\'s not an error.'
    ]
  },
  integrations: {
    overview: 'A connector registry (Odoo, Analytix360, email, WhatsApp, etc.) — configuration metadata only. This app holds no real credentials for any of these systems, so nothing here performs a live sync.',
    howTo: [
      'Record what\'s actually configured outside the app (endpoint, notes) so the rest of the team has an accurate picture — not to trigger a real connection.'
    ],
    tips: []
  },
  administration: {
    overview: 'User and role management, plus platform configuration — Administrator-only.',
    howTo: [
      'Create a new user with + New User, assign their role, and set a job title.',
      'Deactivate a user instead of deleting them if they leave — deactivated users can\'t sign in but their history (interviews, audit trail) is preserved. You can\'t deactivate your own account.'
    ],
    tips: [
      'Roles drive everything else in this app (what you can see and do) — double-check the role before creating a user, since it\'s not just a label.'
    ]
  }
};
