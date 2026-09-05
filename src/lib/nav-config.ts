import type { Permission } from '@/lib/rbac';

export type NavModule = {
  slug: string;
  label: string;
  href: string;
  icon: string; // single emoji glyph
  phase: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  implemented: boolean;
  requires?: Permission;
  description: string;
};

// Mirrors spec section 53's 23 modules + Control Tower. `phase` tracks the build-phase plan
// from section 59 so the sidebar can honestly show "coming in Phase N" instead of hiding the
// eventual shape of the product.
export const NAV_MODULES: NavModule[] = [
  { slug: 'dashboard', label: 'Executive Overview', href: '/dashboard', icon: '🏠', phase: 1, implemented: true, description: 'Home dashboard: what has been set up so far.' },
  { slug: 'control-tower', label: 'Transformation Control Tower', href: '/control-tower', icon: '🛰️', phase: 7, implemented: false, description: 'Group-wide transformation metrics across countries and departments.' },
  { slug: 'departments', label: 'Departments', href: '/departments', icon: '🏢', phase: 1, implemented: true, requires: 'setup.manage', description: 'Country / division / department structure and ownership.' },
  { slug: 'projects', label: 'Projects', href: '/projects', icon: '📁', phase: 1, implemented: true, requires: 'setup.manage', description: 'AI transformation project setup and scope.' },
  { slug: 'process-discovery', label: 'Process Discovery', href: '/process-discovery', icon: '🧭', phase: 3, implemented: false, description: 'Processes identified and their discovery status.' },
  { slug: 'ai-interviews', label: 'AI Interviews', href: '/ai-interviews', icon: '💬', phase: 2, implemented: false, description: 'Multilingual AI-led employee interviews.' },
  { slug: 'digital-twin', label: 'Process Digital Twin', href: '/digital-twin', icon: '🧬', phase: 3, implemented: false, description: 'Structured, visual representation of each discovered process.' },
  { slug: 'process-maps', label: 'Process Maps', href: '/process-maps', icon: '🗺️', phase: 3, implemented: false, description: 'Flowcharts, swimlanes and system interaction maps.' },
  { slug: 'sop-library', label: 'SOP Library', href: '/sop-library', icon: '📋', phase: 3, implemented: false, description: 'Generated SOPs with version control and approval status.' },
  { slug: 'knowledge-base', label: 'Knowledge Base', href: '/knowledge-base', icon: '🧠', phase: 3, implemented: false, description: 'Structured, searchable business knowledge.' },
  { slug: 'bottlenecks', label: 'Bottlenecks', href: '/bottlenecks', icon: '🚦', phase: 3, implemented: false, description: 'Detected bottlenecks with evidence and business impact.' },
  { slug: 'ai-opportunities', label: 'AI Opportunities', href: '/ai-opportunities', icon: '💡', phase: 5, implemented: false, description: 'Scored AI opportunities per process.' },
  { slug: 'ai-projects', label: 'AI Projects', href: '/ai-projects', icon: '🤖', phase: 5, implemented: false, description: 'Generated AI project proposals and business cases.' },
  { slug: 'agent-library', label: 'Agent Library', href: '/agent-library', icon: '📚', phase: 5, implemented: false, description: 'Reusable internal AI agent components.' },
  { slug: 'roi', label: 'ROI / Business Cases', href: '/roi', icon: '📈', phase: 5, implemented: false, description: 'Baseline, projected and simulated ROI per project.' },
  { slug: 'governance', label: 'Governance', href: '/governance', icon: '⚖️', phase: 6, implemented: false, description: 'Approval workflow stages from process owner to production.' },
  { slug: 'approvals', label: 'Approvals', href: '/approvals', icon: '✅', phase: 6, implemented: false, description: 'Pending approvals across all governance stages.' },
  { slug: 'security', label: 'Security', href: '/security', icon: '🔐', phase: 6, implemented: false, description: 'Access, data isolation and AI-usage audit posture.' },
  { slug: 'training', label: 'Training', href: '/training', icon: '🎓', phase: 7, implemented: false, description: 'Generated training modules from approved SOPs.' },
  { slug: 'continuous-improvement', label: 'Continuous Improvement', href: '/continuous-improvement', icon: '🔄', phase: 7, implemented: false, description: 'Scheduled SOP review and change requests.' },
  { slug: 'impact-measurement', label: 'Impact Measurement', href: '/impact-measurement', icon: '📊', phase: 7, implemented: false, description: '30 / 60 / 90 day before-vs-after measurement.' },
  { slug: 'integrations', label: 'Integrations', href: '/integrations', icon: '🔌', phase: 7, implemented: false, description: 'Odoo, Analytix360, email, WhatsApp and other connections.' },
  { slug: 'administration', label: 'Administration', href: '/administration', icon: '⚙️', phase: 1, implemented: true, requires: 'admin.manage', description: 'Users, roles and platform configuration.' }
];
