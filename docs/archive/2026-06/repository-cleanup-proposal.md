# Repository Cleanup and Claude/Codex Working Proposal

Status: archived
Prepared: 2026-06-19
Archived: 2026-06-19

Historical note: this proposal was executed in part. Its recommendation to use `STATUS.md` and
`CODEX_REVIEW.md` was superseded by the issue/branch/pull-request process in `CONTRIBUTING.md`.

## 1. Instructions for Claude

Review this proposal against the current worktree before executing it.

1. Do not delete, move, stage, or commit anything during the first review pass.
2. Run `git status --short`, inspect every uncommitted file, and identify which current work belongs
   to Claude or the owner.
3. Verify every file disposition below. Mark recommendations that have become stale.
4. Call out any file listed for deletion that contains information not preserved elsewhere.
5. Propose changes to this document first. Execute only after the owner approves the amended plan.

The current worktree is heavily dirty. Cleanup must not be mixed into the unfinished product changes.
Do not use `git add -A`, `git clean`, `git reset --hard`, or bulk deletion commands.

## 2. Executive Decision

The application does not need a broad folder rewrite. The current top-level code layout is suitable
for a small Next.js application:

```text
app/
components/
lib/
prisma/
scripts/
public/
```

Keep that layout. The main problems are documentation drift, missing automated quality gates, an
unclear Claude/Codex handoff, and several modules that have grown too large. Clean those areas in
small, reviewable commits.

## 3. Non-Negotiable Safety Rules

- First preserve the current product work in a reviewed commit or explicitly named stash created by
  the owner. Do not reorganize a dirty worktree.
- Before deleting a tracked file, use `git log --all -- <path>` and inspect its latest contents.
- Before deleting an untracked file, open it and confirm whether it is an input, output, credential,
  or unfinished owner work.
- Never commit `.env`, `service-account.json`, downloaded plan PDFs, scraped data, or credentials.
- Never rewrite git history merely to make the repository look cleaner.
- Use `git mv` for tracked moves so history remains understandable.
- Make documentation cleanup, tooling changes, code splits, and security changes separate commits.
- Run the verification command after every implementation commit once that command exists.

## 4. Proposed Target Layout

```text
/
  AGENTS.md                         # Codex-specific instructions
  CLAUDE.md                         # Claude-specific instructions
  README.md                         # setup and product entry point
  STATUS.md                         # short current handoff only, temporary if desired
  app/
  components/
  lib/
  prisma/
    schema.prisma
    migrations/
  scripts/
  tests/
  docs/
    README.md                       # document index and status
    product/
      v1.md
    architecture/
      overview.md
    contracts/
      sheet-template-v5.md
      pricing-v5.md
    decisions/
      0001-sheet-is-bid-engine.md
    plans/
      active/
    evals/
    archive/
      2026-06/
```

Do not create every directory preemptively. Create a directory when at least one retained document
belongs there.

## 5. Exact File Disposition

### 5.1 Keep at the repository root

| Path | Decision | Required change |
|---|---|---|
| `README.md` | Keep | Correct setup instructions and link to `docs/README.md`. |
| `CLAUDE.md` | Keep and shorten | Claude behavior only; link shared engineering rules instead of repeating architecture. |
| `AGENTS.md` | Create | Codex review role, exact review baseline, severity format, and no-edit default. |
| `STATUS.md` | Keep temporarily | Limit to the current task, base SHA, review SHA, acceptance criteria, checks, and known risks. |
| `CODEX_REVIEW.md` | Keep temporarily | One current review only. Archive or remove it later if reviews move to pull requests. |
| `.env.example` | Keep | Remove obsolete SAM variables and reconcile Google variable names with the code and README. |
| `.gitignore` | Keep | Add only verified generated/local artifacts; do not hide source files to make status clean. |
| `package.json`, `package-lock.json` | Keep | Add deterministic quality scripts and a supported Node engine. |
| `tsconfig.json`, `next.config.mjs` | Keep | No structural move required. |

### 5.2 Keep as active documentation, but move or rewrite

| Current path | Proposed path | Action |
|---|---|---|
| `docs/v1-plan.md` | `docs/product/v1.md` | Keep as product scope; reconcile it with the actual current flow. |
| `docs/architecture.md` | `docs/architecture/overview.md` | Rewrite as an overview. Remove the copied Prisma schema and link to `prisma/schema.prisma`. |
| `claude/sheet-template.md` | `docs/contracts/sheet-template-v5.md` | Move; this is a product contract, not Claude-owned memory. |
| `claude/v5-math-contract.md` | `docs/contracts/pricing-v5.md` | Move and keep as the pricing contract. |
| `docs/estimator-plan.md` | `docs/plans/active/estimator-pipeline.md` | Retain only still-current execution steps; archive stale agent coordination history. |
| `docs/read-notes.md` | `docs/evals/read-notes.md` | Keep as evaluation evidence, clearly labeled with date and model. |
| `docs/nola-portal-scraping.md` | `docs/architecture/nola-portal.md` | Keep while the NOLA work remains in scope. |
| `docs/takeoff-measurement-proposal.md` | `docs/plans/active/takeoff-measurement.md` | Untracked today; keep only if the owner confirms it is active unfinished work. |

Create `docs/README.md` with a table containing: document, status, owner, last verified date, and
replacement/superseding document. A document may be `active`, `proposal`, or `archived`. Only one
document may be marked controlling for a given concern.

### 5.3 Archive after useful information is consolidated

These are not immediate deletion candidates. Move them to `docs/archive/2026-06/` after Claude has
confirmed that current decisions and unresolved questions have been preserved:

```text
docs/codex-estimator-pipeline-proposal.md
docs/codex-final-estimator-proposal.md
docs/final-proposal.md
docs/pipeline-strategy.md
docs/estimator-workflow.md
docs/estimate-flow-spec.md
```

`docs/current-process.md` is currently untracked and already disagrees with the schema. Either merge
its still-useful flow description into the architecture overview or discard it. Do not commit it with
the label "current" unless it is reverified line by line.

`CODEX_REVIEW.md` and old sections of `STATUS.md` are history, not architecture. Git already retains
their prior versions. Do not copy their full history into another controlling document.

### 5.4 Safe deletion candidates after Claude verifies the inventory

The following tracked files contain zero or effectively zero content:

```text
docs/finish-read-flow-recommendation.md   # 0 bytes
docs/gpt.md                               # 3 bytes
```

Delete them in the documentation cleanup commit unless Claude finds a meaningful historical reason
to retain them.

The following tracked images are not referenced by any Markdown file:

```text
docs/1d13c81a-bf12-4c6a-abfe-9f2d790660c1.png
docs/ChatGPT Image Jun 18, 2026, 01_56_13 AM.png
docs/ChatGPT Image Jun 18, 2026, 12_54_35 AM.png
docs/ChatGPT Image Jun 18, 2026, 12_54_52 AM.png
```

Claude must visually inspect them before deletion. If an image documents an accepted UI direction,
rename it descriptively, move it to `docs/assets/`, and reference it from an active document. Delete
the others from the repository. Do not retain anonymous binary files "just in case"; git history
still preserves tracked versions.

### 5.5 Untracked artifacts: do not commit under `docs/`

At the time of this proposal, these untracked binary artifacts are present:

```text
docs/3014ef2d-dea1-4b1b-be7d-f6055a50989e.png
docs/8df4dc85-590c-4439-9527-d2992e81c464.png
docs/ChatGPT Image Jun 18, 2026, 04_16_19 AM.png
docs/Final Building Plans - 228C (RCC).pdf
```

Disposition:

- Inspect the three images. Keep only accepted design references, renamed descriptively and linked
  from an active document. Otherwise remove them locally.
- Move the plan PDF to the ignored `samples/` directory if it is a legitimate test fixture and its
  licensing/privacy allows local use. Otherwise remove it locally. Do not commit third-party plan
  sets to `docs/`.

### 5.6 Generated and local-only directories

| Path | Decision |
|---|---|
| `.next/` | Generated and ignored. Safe to remove locally when no dev/build process is using it. |
| `tsconfig.tsbuildinfo` | Generated and ignored. Safe to remove locally. |
| `website/` | Inventory shows only `website/.next/` cache. The product docs say the website was removed. Safe to remove locally after one final inventory check. |
| `.agents/`, `.codex/` | Currently empty. Empty directories are not tracked; they may be removed locally. Use root `AGENTS.md` for Codex. |
| `.claude/` | Keep local. It contains Claude permissions/settings and is intentionally ignored. Do not commit `settings.local.json`. |
| `samples/` | Keep ignored. Scripts use local sample PDFs from this directory. |
| `public/samples/` | Keep ignored while `app/sample/page.tsx` references `/samples/midlands-A701.png`. |
| `data/` | Keep ignored for scraped/local corpus data. |
| `.env` | Keep ignored and local. Never print or commit its values. |
| `service-account.json` | Keep ignored only if still required locally; otherwise securely delete it. It has not been identified as tracked. |

### 5.7 The `claude/` directory

After both contract documents are moved and their links are updated, delete `claude/README.md` and
remove the empty `claude/` directory. Durable product contracts must not appear to belong to one AI
tool.

## 6. Code Organization Changes - Later, Not During Documentation Cleanup

Do not relocate the entire application into `src/`. That adds churn without solving a current problem.

Split `app/actions.ts` by domain once the dirty implementation is committed and reviewed. A reasonable
incremental destination is:

```text
app/actions/
  projects.ts
  documents.ts
  finishes.ts
  rates.ts
  takeoff.ts
  scope.ts
  sheets.ts
```

Keep reusable business logic in `lib/`; server actions should validate input, call domain logic, and
perform revalidation/redirects. Avoid introducing a generic service/repository framework.

Split `app/globals.css` by stable UI area only when editing those areas. Do not do a 1,000-line CSS
move in the same commit as visual changes.

## 7. Required Engineering Gates

Add deterministic scripts so Claude and Codex run the same checks locally and CI runs exactly the
same entry point:

```json
{
  "scripts": {
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings=0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "verify": "npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build"
  }
}
```

Exact tools may be amended to match the installed Next.js version, but `npm run lint` must never open
an interactive configuration prompt. Add a GitHub Actions workflow that runs `npm ci` and
`npm run verify` on pull requests.

Initial focused tests should cover:

1. Bid math and the locked `$15,205.54` parity case.
2. Anthropic JSON/fenced-output parsing and malformed responses.
3. Project workflow/status derivation.
4. Finish/rate normalization and validation.
5. NOLA portal parsing using saved HTML fixtures, not live network calls.

Do not chase a coverage percentage initially. Protect expensive calculations and fragile parsers.

## 8. Database Discipline

- Add and commit `prisma/migrations/`.
- Use named migrations for reviewed schema changes.
- Keep `db:push` for disposable local prototyping only, not production deployment.
- Require a migration and rollback/data-migration note whenever Claude changes persisted fields.
- Do not copy the Prisma schema into architecture documents. Link to the real file.

## 9. Security Boundary Before Public Deployment

The current application behaves like a trusted single-user prototype. Before any public deployment:

- Add authentication and project/company authorization to server actions and API routes.
- Remove or protect the temporary mutating `GET /api/ingest` endpoint.
- Validate uploaded MIME type, file size, and PDF parsing failures.
- Bind Google OAuth state to the initiating session and store connections per user/company.
- Review storage bucket policies and signed URL lifetime.
- Add rate limits around document ingest and Anthropic calls.

If public deployment is not yet intended, state "local/private prototype only" clearly in README and
STATUS so neither AI mistakenly treats the current trust model as production-ready.

## 10. Claude Primary / Codex Reviewer Workflow

### Start of task

1. Begin from a clean branch based on the agreed base commit.
2. Put the task goal, acceptance criteria, allowed scope, and base SHA in `STATUS.md`.
3. Claude lists expected files before editing.

### Claude implementation

1. Make the smallest coherent change.
2. Add or update focused tests.
3. Run `npm run verify`.
4. Commit the implementation.
5. Update the handoff with the review SHA, checks run, failures, and known risks.

### Codex review

Codex reviews the exact range `<base-sha>...<review-sha>`, not "latest code" and not an unspecified
dirty worktree. Codex reports findings first, ordered by severity, with file/line references. Codex
does not change implementation files unless the owner explicitly asks it to fix findings.

### Resolution

1. Claude addresses or explicitly disputes every finding.
2. Claude reruns verification and creates a follow-up commit.
3. Codex rereviews only when the change is high-risk or findings materially changed behavior.
4. Merge only with a clean worktree and passing CI.

For parallel work, use separate git worktrees and branches. Claude and Codex must not write to the
same worktree concurrently.

## 11. Execution Sequence

Each phase should be its own reviewed commit or pull request.

### Phase 0 - Preserve unfinished work

- Inventory all modified, deleted, and untracked files.
- Separate intentional product work from local artifacts.
- Commit coherent product work only after review; do not blindly stage all files.
- Record the resulting clean base SHA.

### Phase 1 - Establish gates

- Configure noninteractive linting and formatting.
- Add typecheck, focused tests, `verify`, supported Node version, and CI.
- Diagnose the current production build failure until `npm run build` is dependable.

### Phase 2 - Consolidate documentation

- Create `AGENTS.md` and `docs/README.md`.
- Shorten `CLAUDE.md` and `STATUS.md`.
- Move active contracts/docs with `git mv`.
- Consolidate useful proposal content.
- Archive superseded proposals.
- Delete only the verified empty/unreferenced files listed above.
- Fix all internal links and run a link check.

### Phase 3 - Database reproducibility

- Reconcile the current database with `prisma/schema.prisma`.
- Establish a migration baseline without losing production data.
- Document migration procedure.

### Phase 4 - Module boundaries

- Split `app/actions.ts` one domain at a time with no behavioral rewrite.
- Add validation at action boundaries.
- Extract CSS only alongside tested UI work.

### Phase 5 - Deployment security

- Add authentication, authorization, OAuth state, protected ingest, storage review, and rate limits
  before exposing the application publicly.

## 12. Definition of Done for Repository Cleanup

- `git status --short` is empty after the approved cleanup commit.
- `npm ci` and `npm run verify` pass from a fresh checkout.
- CI runs the same verification command.
- Prisma migrations reproduce the schema.
- Every active document appears in `docs/README.md` and has one clear status.
- No two active documents claim to control the same concern.
- No anonymous or unreferenced binary assets remain under `docs/`.
- `CLAUDE.md` and `AGENTS.md` agree on the commit-based handoff.
- `STATUS.md` describes only the current task and stays short.
- The README accurately states setup requirements and deployment trust level.

## 13. Claude Review Response Template

Claude should append its review below this line without executing the cleanup:

```text
Inventory verified: yes/no

Accepted:
- ...

Amendments:
- ...

Deletion candidates that must be retained:
- path - reason

Uncommitted files requiring owner decision:
- path - reason

Recommended first execution commit:
- ...
```
