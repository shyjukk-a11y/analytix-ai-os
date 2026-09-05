# Analytix AI Business Transformation OS

**Discover Work → Capture Knowledge → Improve Processes → Build AI → Measure Impact**

This is Phase 1 (Foundation) of the platform described in the product spec: authentication,
RBAC, org structure (country/division/department), AI transformation project setup, and
knowledge-source file storage. Every other module in the sidebar is a labeled placeholder for
its planned phase so the full intended navigation is visible from day one.

## Important: you need to run `npm install` yourself

This codebase was written by Claude in a sandboxed session that had **no access to the npm
registry** (or any other package host) — so none of it has been through `npm install`,
`next build`, or a TypeScript compile. It was written carefully, file by file, against known-good
Next.js 14 / Prisma 5 / NextAuth 4 patterns, but you are the first real compile it will see.

**Please run the setup below, then send me (Claude) the exact terminal output of any error** —
I'll fix it in a follow-up pass. This is a normal handoff step for code written without a build
loop, not a sign anything is fundamentally wrong.

## Tech stack (Phase 1)

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Prisma + **SQLite** for local dev (zero services to install). See "Moving to Postgres" below —
  you'll need it before Phase 3 (pgvector / RAG).
- NextAuth (credentials provider), backed by Prisma, with one seeded demo user per role
- Server Actions for department/project creation and knowledge-source upload
- Local-disk file storage behind a `KnowledgeStorage` interface (swap to S3 later without
  touching callers)

## Setup

```bash
cd analytix-ai-os
npm install
cp .env.example .env        # defaults are fine for local dev
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open http://localhost:3000 — you'll land on the login screen with a clickable list of demo
accounts (password for all of them: `Passw0rd!`).

| Role | Email |
|---|---|
| Administrator | admin@analytix.demo |
| Management / CEO | ceo@analytix.demo |
| Department Head | depthead@analytix.demo |
| Process Owner | processowner@analytix.demo |
| Employee | employee@analytix.demo |
| AI Transformation Committee | committee@analytix.demo |
| Technology Team | tech@analytix.demo |
| Information Security | infosec@analytix.demo |
| Legal / Compliance Reviewer | legal@analytix.demo |

A demo department ("Business Setup & Corporate Services") and project ("AI Company Formation
Case Assistant") are seeded from the spec's section 62 example, so Departments/Projects aren't
empty on first login.

## What's actually implemented in Phase 1

- **Auth + RBAC** — `src/lib/auth.ts`, `src/lib/rbac.ts`. Nine roles from spec section 3, a small
  `Permission` set (`setup.manage`, `admin.manage`, `knowledge.upload`, `executive.view`) gating
  what each role can do. Extend `PERMISSIONS` in `rbac.ts` as later phases add modules — don't
  scatter role checks across pages.
- **Departments** (`/departments`) — create/list departments under an implicit default
  Organization → Country → Division structure (spec section 4). Country/division names are
  free text and upserted, so multi-country setup already works without extra UI.
- **Projects** (`/projects`) — the full section-4 setup form (scope, systems, mandatory checks/
  approvals, templates, baseline volume/manpower, etc.), stored on `AiTransformationProject`.
- **Knowledge sources** — file upload (PDF/Word/Excel/PNG/JPEG/WebP, 20MB cap) on a project's
  detail page, stored on local disk, one row per file with a `trustLevel` defaulting to
  `EMPLOYEE_STATEMENT` — nothing uploaded is ever silently treated as approved policy (spec
  section 6 / 28). Promotion to a higher trust level is a Phase 3+ workflow.
- **Administration** — user/role list, recent audit log. User creation UI + real SSO land
  together in a later phase; edit `prisma/seed.ts` for now.
- **Audit log** — every department/project create and knowledge upload writes an `AuditLog` row.

## Data model

See `prisma/schema.prisma`. Active Phase 1 models are at the top; everything below the
`PHASE 2+ ROADMAP` divider is commented-out documentation of the target schema from spec
section 50 (Process/Interview/SOP/AiOpportunity/Approval/metrics entities) — later phases should
extend this file rather than starting a parallel schema. Fact-status tracking (spec section 7)
and the knowledge-precedence hierarchy (section 6) are modeled as enums already
(`SourceTrustLevel`) so Phase 2's interview engine has somewhere to land.

## Moving to Postgres

SQLite was chosen for Phase 1 purely so this runs with zero installed services. Before Phase 3
(which needs `pgvector` for knowledge-base semantic search), switch the datasource:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

...set `DATABASE_URL` to a real Postgres connection string, and re-run
`npx prisma migrate dev`. No application code depends on SQLite specifically.

## Design reference: the Phase 0 interview prototype

Before this repository, a standalone HTML prototype ("Analytix Virtual AI Process Consultant" /
"Alex") was built to demo the adaptive-interview concept: one question at a time, keyword-driven
follow-ups, AI Observation cards requiring explicit Yes/Partly/No confirmation before anything
becomes an official fact, and a generated SOP/bottleneck/AI-opportunity report. That prototype's
question-branching logic (section 7-9 of the product spec) is the reference design for Phase 2's
real `Interview` / `InterviewAnswer` / `InterviewFact` implementation here — the difference is
that Phase 2 persists structured state in Postgres (per spec section 50's explicit rule: *"Do
NOT keep the interview state only in the prompt"*) instead of in browser JavaScript, and calls a
real LLM through a provider-abstraction layer instead of a rule-based keyword matcher.

## Build-phase roadmap

Matches spec section 59. `src/lib/nav-config.ts` is the single source of truth the sidebar reads
from — update the `phase` / `implemented` fields there as each phase ships.

1. **Foundation** (this repo) — auth, DB, RBAC, departments, projects, knowledge storage.
2. **AI Interview** — chat + voice, dynamic questioning, structured answer extraction, scope
   validation, fact statuses, completeness engine.
3. **Process Intelligence** — Process Digital Twin, SOP generator, Knowledge Base, Bottlenecks,
   visual process map.
4. **Multi-Employee Validation** — employee comparison, SOP-vs-reality gap analysis,
   contradiction resolution.
5. **AI Transformation** — AI opportunities, AI project generator, agent matching, ROI
   calculator, process simulation.
6. **Governance** — approval workflow, security review, pilot/production gates.
7. **Enterprise** — Control Tower, training, continuous improvement, impact measurement,
   integrations (Odoo, Analytix360, email, WhatsApp).

## Known gaps / next steps

- No middleware-level route protection yet — auth is checked per-layout via
  `getServerSession`, which is correct but means an unauthenticated request briefly reaches
  the server component before redirecting. Fine for Phase 1; add `middleware.ts` if this
  matters before Phase 2.
- No automated tests yet. Given this code hasn't been build-verified, the highest-value first
  step after `npm install` is simply confirming `npm run build` succeeds.
- User creation is seed-script-only; there's no UI to add a user yet.
- `src/app/api/upload` is an empty leftover directory (Next.js ignores it) — safe to delete.
