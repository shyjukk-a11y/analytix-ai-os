# Analytix AI Business Transformation OS

**Discover Work → Capture Knowledge → Improve Processes → Build AI → Measure Impact**

Analytix AI Business Transformation OS runs an organization's AI transformation program end to
end: capturing how work is done today through structured, multilingual AI-led staff interviews,
turning that into SOPs, a searchable knowledge base and process maps, identifying AI
opportunities, building ROI-backed business cases, running them through a formal governance
sign-off chain, publishing reusable AI agents, and then training staff and measuring real
impact after go-live.

All **24 modules across all 7 build phases are implemented**, and the app runs locally on
SQLite. `TECHNICAL_DOCUMENT.md` is the authoritative technical reference — architecture, data
model, every module, roles, workflows, hosting. Read it alongside this file; where the two
disagree, trust the technical document.

A design principle runs through the whole codebase: **nothing is fabricated.** Every SOP,
business case, training module and opportunity description is produced by deterministic
templates from facts an employee actually stated in an interview. There is **no live LLM call**
anywhere — the "AI Interview" is a deterministic conversation-tree engine
(`src/lib/interview-engine.ts`): same questions, same logic, every time, in five languages
(English, Hindi, Arabic, Chinese, Malayalam).

## Status

- **Runs locally**: `npm install`, `prisma migrate dev`, seed, and `npm run dev` all succeed;
  login and role-based sign-in are confirmed working.
- **`next build` is not yet verified** — the code has run in dev but not through a production
  build. This is the highest-value next check.
- **No automated tests** exist anywhere in the codebase.
- **No `middleware.ts`** — auth is gated in `src/app/(app)/layout.tsx` via `getServerSession`
  plus per-action `assertCan` checks (defense in depth). Route-level middleware should be added.
- Hosting: local only (SQLite file DB, local-disk file storage). See "Hosting / moving to
  Postgres" below and `TECHNICAL_DOCUMENT.md` §8.

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Server Actions) | 14.2.15 |
| Language | TypeScript | 5.5.3 |
| UI | React / React DOM | 18.3.1 |
| Styling | Tailwind CSS | 3.4.6 |
| Auth | NextAuth.js (Credentials provider, JWT sessions) | 4.24.7 |
| ORM | Prisma | 5.19.1 |
| Database | SQLite (local file, `prisma/dev.db`); schema is Postgres-ready | — |
| Password hashing | bcryptjs | 2.4.3 |
| Validation | Zod | 3.23.8 |
| File storage | Local disk (`./storage/knowledge-sources`); a Vercel Blob adapter in `src/lib/storage.ts` is auto-selected when `BLOB_READ_WRITE_TOKEN` is set | — |

No paid AI/LLM API is called anywhere.

## Setup

```bash
cd analytix-ai-os
npm install
cp .env.example .env
```

Then edit `.env` for local dev (the committed `.env.example` is still written for a Postgres
host — see "Known gaps / next steps"):

```
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="<output of: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
```

```bash
npx prisma migrate dev      # applies prisma/migrations/, then runs prisma/seed.ts automatically
npm run dev
```

`npm run db:seed` re-runs the seed on demand later. Open http://localhost:3000 — the login
screen lists clickable demo accounts (password for all: `Passw0rd!`).

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

The seed (`prisma/seed.ts`) also loads a full demo organization — departments, projects and
staff drawn from the spec's worked example — so no module is empty on first login.

## Modules

24 modules, registered in `src/lib/nav-config.ts` — the single source of truth the sidebar and
Help index read from. Each entry's `phase` field records which build phase introduced it. Full
per-module reference (routes, required permissions, behavior) is in `TECHNICAL_DOCUMENT.md` §7.

- **Phase 1 — Foundation**: Executive Overview, Departments, Projects, Administration
  (includes a user-creation UI), Help.
- **Phase 2 — AI Interviews**: multilingual deterministic interview engine, chat UI,
  shareable no-login invite links, multiple interviews per process with conflict detection and
  reviewer reconciliation.
- **Phase 3 — Process Intelligence**: Process Discovery, Process Digital Twin, Process Maps,
  Bottlenecks, SOP Library (deterministic SOP generator), Knowledge Base.
- **Phase 4 — AI opportunities**: AI Opportunities (rule-derived LOW/MEDIUM/HIGH impact and
  effort bands), AI Projects (deterministic business-case generator).
- **Phase 5 — AI delivery**: Agent Library, ROI / Business Cases (transparent formula with
  documented assumptions).
- **Phase 6 — Governance**: Governance (6 fixed, strictly sequential sign-off stages),
  Approvals, Security (renders the RBAC matrix directly).
- **Phase 7 — Enterprise**: Transformation Control Tower, Training, Continuous Improvement,
  Impact Measurement (30/60/90-day reviewer-entered checkpoints), Integrations (config
  registry only — no live sync).

## Auth + RBAC

`src/lib/auth.ts` and `src/lib/rbac.ts`. Nine roles (`src/lib/enums.ts` → `Role`); eight
coarse permissions in one matrix (`PERMISSIONS` in `rbac.ts`), checked with `can()` /
`assertCan()` wherever a page or action gates access:

`setup.manage`, `admin.manage`, `knowledge.upload`, `executive.view`, `interview.conduct`,
`interview.review`, `governance.review`, `security.view`.

`PERMISSIONS` is exported so the Security module renders the live access matrix rather than
re-deriving it. Extend this matrix as new modules land — don't scatter role checks across
pages.

## Data model

`prisma/schema.prisma` — **25 active models spanning all 7 phases**, grouped by the phase that
introduced them (see `TECHNICAL_DOCUMENT.md` §4). `cuid()` primary keys throughout; cascade
deletes are deliberate so removing a `Process` cleanly removes everything downstream of it.

The commented block below the **FUTURE SCHEMA** divider at the end of the file is *not* built —
it documents fuller spec-model shapes (process-step normalization, SOP/knowledge versioning,
formal `Risk` / `Approval` entities, separate metric tables) so later work extends this schema
toward them rather than starting a parallel one.

SQLite has no native `enum` type, so fixed-vocabulary fields (`role`, `status`, `trustLevel`,
…) are `String` columns with const-object stand-ins in `src/lib/enums.ts`. The
knowledge-precedence hierarchy (spec section 6) and fact-status vocabulary (section 7) live
there as `SourceTrustLevel`.

## Hosting / moving to Postgres

The app runs locally only. Per `TECHNICAL_DOCUMENT.md` §8, hosting it needs three code changes
(all straightforward) plus accounts you provide (a domain, a GitHub repo, Vercel, a managed
Postgres provider, Vercel Blob):

1. In `prisma/schema.prisma`, change `provider` to `"postgresql"`, point `DATABASE_URL` at a
   real connection string, delete the SQLite-dialect migration(s) in `prisma/migrations/`, run
   `npx prisma migrate dev --name init` to regenerate them, then `npx prisma migrate deploy`
   against production.
2. File storage already has a `VercelBlobKnowledgeStorage` adapter in `src/lib/storage.ts`
   that activates when `BLOB_READ_WRITE_TOKEN` is set — enable Blob on the Vercel project.
3. Set a real `NEXTAUTH_SECRET` and point `NEXTAUTH_URL` at the real domain.

No application code depends on SQLite specifically.

## Design reference: the Phase 0 interview prototype

Before this repository, a standalone HTML prototype ("Analytix Virtual AI Process Consultant" /
"Alex") demoed the adaptive-interview concept: one question at a time, keyword-driven
follow-ups, AI Observation cards requiring an explicit Yes/Partly/No confirmation before
anything becomes an official fact, and a generated SOP/bottleneck/AI-opportunity report. That
branching logic (spec sections 7–9) is the design the Phase 2 engine here implements. The
differences: Phase 2 persists structured state in the database (`Interview.stateJson` plus
normalized transcript / step / observation tables) instead of browser JavaScript, and the
engine deliberately stayed a **deterministic rule-based conversation tree** rather than moving
to an LLM — per the "nothing fabricated" principle (`TECHNICAL_DOCUMENT.md` §1, §9).

## Build phases

All seven phases are built. `src/lib/nav-config.ts` `phase` fields map each module to the
phase that introduced it.

1. **Foundation** — auth, DB, RBAC, departments, projects, knowledge storage.
2. **AI Interview** — multilingual deterministic questioning, structured answer extraction,
   observation confirmation, completeness scoring, invite links, multi-interview reconciliation.
3. **Process Intelligence** — Digital Twin, SOP generator, Knowledge Base, Bottlenecks,
   visual process maps.
4. **Multi-Employee Validation** — join-existing-process interviews, `compareProcessFacts()`
   conflict detection, `NEEDS_REVIEW` gating, side-by-side reconciliation.
5. **AI Transformation** — AI opportunities, AI project generator, Agent Library, ROI
   calculator.
6. **Governance** — 6-stage sequential approval chain, Approvals queue, Security posture view.
7. **Enterprise** — Control Tower, training, continuous improvement, impact measurement,
   integrations registry.

## Known gaps / next steps

- **`next build` not yet verified** — run it and fix whatever surfaces before building more.
- **No automated tests** anywhere in the codebase.
- **No `middleware.ts`** — auth is per-layout (`src/app/(app)/layout.tsx`) plus per-action
  `assertCan`. Correct, but a request briefly reaches a server component before redirecting;
  add route-level middleware.
- **`.env.example` is still Postgres-shaped** (`DATABASE_URL="postgresql://…"`, placeholder
  `NEXTAUTH_SECRET`) — the "Setup" section above works around it. Rewrite it for the SQLite
  default.
- **`src/app/api/upload`** is an empty leftover directory (Next.js ignores it) — safe to delete.
- **`src/components/layout/ComingSoon.tsx`** is now dead code — every `nav-config.ts` module is
  `implemented: true`. Remove it.
- **`package.json` `version` is `0.1.0-phase1`** — a stale label; bump it.
