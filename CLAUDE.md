# CLAUDE.md - primary implementer instructions

Beelite is a commercial flooring takeoff and estimating app. AI reads plans, the estimator confirms
the result, and project inputs sync into a Google Sheet that performs the bid math.

The shared engineering workflow is `CONTRIBUTING.md`. Codex's independent review role is
`AGENTS.md`. The documentation index and source-of-truth status are in `docs/README.md`.

## Working agreement

- Claude plans and implements; Codex independently reviews when the owner requests it.
- GitHub issues hold substantial task intent. Pull requests hold acceptance criteria, verification,
  risks, and review discussion. Do not create repository status or review handoff files.
- Start implementation from a clean, purpose-named branch. Keep commits coherent and reviewable.
- For high-risk or cross-cutting work, create an active plan and obtain owner/Codex approval before
  implementation. Follow the plan lifecycle in `CONTRIBUTING.md`.
- Add focused tests with behavioral changes and report checks that could not be run.
- Contract changes must update every affected implementation and reference in the same pull request.
- Flag prerequisites, destructive operations, security exposure, AI cost, and migration risk early.

## Source-of-truth map

| Concern | Source |
|---|---|
| Product scope | `docs/v1-plan.md` |
| Technical architecture | `docs/architecture.md` |
| Google Sheet engine | `docs/contracts/sheet-template-v5.md` |
| Bid pricing math | `docs/contracts/pricing-v5.md` |
| Engineering process | `CONTRIBUTING.md` |
| Documentation status | `docs/README.md` |

## Stack and conventions

- Next.js App Router, TypeScript, Postgres/Supabase, Prisma, Anthropic, and Google Sheets/Drive.
- The application lives at the repository root; do not move it into `src/` without an approved need.
- `page.tsx` is a screen and `route.ts` is an API endpoint. Business logic belongs in `lib/`, not
  large page components or server-action files.
- Route and file names are kebab-case. Exported React components and Prisma models are PascalCase.
  Environment variables are SCREAMING_SNAKE_CASE.
- Prefer existing project patterns over new frameworks or speculative abstractions.

## Locked architecture

Google Sheets is the bid engine; the app is the capture, review, and sync layer. The app writes only
hidden `App_*` tabs. Visible Sheet tabs contain formulas and estimator overrides. The database stores
inputs and review state, not computed bid totals.

Pricing follows `docs/contracts/pricing-v5.md`: cost -> profit -> price. The locked regression example
must continue to produce `$15,205.54` in both the in-app estimator and generated Sheet.
