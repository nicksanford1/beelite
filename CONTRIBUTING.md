# Engineering Workflow

This is the controlling process for human, Claude, and Codex contributions to Beelite.

## 1. Systems of record

- **GitHub issue:** problem, goal, non-goals, acceptance criteria, and owner decisions for substantial
  work.
- **Branch and commits:** implementation history.
- **Pull request:** current change set, test evidence, risks, migrations, and review discussion.
- **Product documentation:** durable product behavior and decisions, not task status.

Do not add tracked status, handoff, or current-review files. Git and GitHub already preserve that
history.

## 2. Choose the smallest process that fits

### Discussion only

Use chat without a branch or document for explanations, alternatives, and early product thinking.

### Small, obvious change

Use a purpose-named branch and pull request. An issue or plan document is optional when the problem
and acceptance criteria fit clearly in the PR description.

### Substantial or high-risk change

Create an issue and plan before implementation. This includes:

- database/schema or migration changes;
- authentication, authorization, OAuth, storage, or public endpoints;
- pricing, tax, profit, or Google Sheet contract changes;
- AI prompts, model routing, document ingestion, or changes with material token cost;
- workflows spanning multiple features or expected to take multiple sessions;
- destructive operations or refactors with a broad behavioral surface.

## 3. Planning

Normal plans live in the GitHub issue or draft PR. Create `docs/plans/active/<topic>.md` only when the
design is substantial enough to remain useful across multiple sessions or reviewers.

An active plan contains:

1. Problem and evidence
2. Goal and non-goals
3. User workflow
4. Proposed technical design
5. Data, security, AI-cost, and migration impact
6. Alternatives considered
7. Acceptance criteria
8. Test and rollout strategy
9. Open owner decisions

Each plan begins with:

```text
Status: proposal | approved | implemented | archived
Owner: <name>
Issue: #<number>
Created: YYYY-MM-DD
Last verified: YYYY-MM-DD
```

Claude writes the first plan. Codex reviews the named plan independently when the owner requests a
planning review. Implementation begins only after required owner decisions are resolved.

After merge:

- move enduring behavior into product, architecture, contract, runbook, or ADR documentation;
- create an ADR in `docs/decisions/` for a durable decision with meaningful alternatives;
- mark the plan implemented and move it to `docs/archive/YYYY-MM/`;
- never leave completed plans competing with current architecture.

## 4. Branches and worktrees

Start from an updated `main` and a clean worktree.

```text
feat/<issue>-short-name
fix/<issue>-short-name
chore/<issue>-short-name
```

One feature normally uses one branch sequentially: Claude implements, Codex reviews, and Claude fixes.
A separate Codex branch is not needed for read-only review.

Use separate branches and git worktrees only for genuinely independent parallel implementation.
Agents must not edit the same worktree concurrently.

## 5. Implementation

Claude is the default implementer:

1. Confirm the issue/PR acceptance criteria and intended files.
2. Make the smallest coherent behavioral change.
3. Add focused tests proportional to risk.
4. Include a named Prisma migration for persisted schema changes.
5. Update controlling documentation when behavior or a locked contract changes.
6. Run the repository verification commands.
7. Commit coherent units; do not blindly stage unrelated files.

Do not mix documentation cleanup, new tooling, broad refactors, and product behavior in one commit or
pull request unless they are inseparable from the accepted task.

## 6. Pull requests

Open a draft PR early for substantial work. The PR template is the task dashboard and must contain:

- linked issue and concise change summary;
- acceptance criteria and explicit non-goals;
- files/areas intentionally affected;
- verification commands and results;
- screenshots for user-interface changes;
- schema migration and rollback/data notes;
- security, AI-cost, and operational risks;
- documentation changed or intentionally deferred.

The PR must represent a clean diff against its base branch. Reviewers should not have to infer which
dirty files belong to the task.

## 7. Codex review

The owner explicitly triggers Codex with either a PR number or exact commit range.

Planning review example:

```text
Review the plan for issue #42. Challenge the architecture, risks, and acceptance criteria.
Do not implement it.
```

Code review example:

```text
Review PR #42 for correctness, regressions, security, AI cost, migrations, and missing tests.
Do not edit files.
```

Codex posts findings in the PR when GitHub CLI access is available, or returns them in the current
conversation. Reviews are not stored in tracked Markdown handoff files.

Findings are ordered blocker, major, minor, then nit and include file/line references and concrete
corrections. Claude addresses or explicitly disputes every material finding in the PR, adds a fix
commit, and reruns verification.

Rereview is expected for blockers, major findings, contract changes, security changes, and material
rewrites. It is optional for narrow low-risk corrections.

## 8. Verification and merge

The intended single entry point is `npm run verify`, covering formatting, linting, typechecking,
focused tests, and the production build. Until that script and CI are installed, every PR must list
the individual checks actually run and clearly report unavailable or failing gates.

Do not claim a check passed when it was skipped. Do not normalize a known red build; either fix it in
the owning PR or record an explicit owner-approved exception with a follow-up issue.

Merge only when:

- acceptance criteria are satisfied;
- material review findings are resolved;
- required migrations and documentation are present;
- required checks pass or an explicit owner exception is documented;
- the branch has no unrelated changes.

Prefer squash merge for a focused feature/fix PR, then delete the branch. Preserve separate commits
when they carry useful independent history, such as a migration followed by a behavioral change.

## 9. Documentation lifecycle

`docs/README.md` indexes all non-archived documents. Status values are:

- **controlling:** the sole source of truth for one concern;
- **active:** current supporting reference;
- **proposal:** not approved or implemented;
- **archived:** historical and not authoritative.

Rules:

- Only one controlling document exists per concern.
- Plans describe future work; architecture describes current behavior.
- Contracts define behavior that code and tests must defend.
- Runbooks describe repeatable operational procedures.
- Evals hold dated model/prompt evidence and answer keys.
- Assets must be descriptively named and referenced by an active document.
- Avoid filenames such as `final`, `new`, or `current`; use purpose and status metadata instead.

## 10. GitHub access

Both agents need authenticated GitHub CLI access to read and post issue/PR discussion directly:

```bash
gh auth status
```

If authentication is unavailable, use exact commit ranges for review and keep the output in the
current conversation. Fix authentication rather than reintroducing tracked handoff files.
