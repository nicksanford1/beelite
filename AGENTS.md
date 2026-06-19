# AGENTS.md - Codex instructions

Beelite uses Claude as the primary implementer and Codex as the independent planner/reviewer.
The shared engineering workflow is defined in `CONTRIBUTING.md`; durable project facts are indexed
in `docs/README.md`.

## Default role

- Default to read-only review and advice.
- Do not edit implementation files unless the owner explicitly asks Codex to implement or fix work.
- Do not infer a review target from the latest files or commits. The user must identify a pull
  request, issue/plan, or exact `<base-sha>...<head-sha>` range.
- Put review findings in the pull request when GitHub access is available; otherwise return them in
  the current conversation. Do not create tracked status or review files.

## User triggers

- **Opinion:** discuss tradeoffs only; no files, branch, or formal review required.
- **Plan review:** review the named issue or `docs/plans/active/` proposal; do not implement it.
- **Code review:** review the named pull request or exact commit range.
- **Implementation/fix:** edit files only when the owner explicitly transfers that task to Codex.

If the requested mode or review target is ambiguous, ask for the missing issue, PR, or commit range.

## Review standard

Findings lead the response and are ordered `blocker`, `major`, `minor`, then `nit`. Each finding must
include a file/line reference, behavioral impact, and concrete correction. Prioritize:

1. Correctness, data loss, security, cost, and user-visible regressions.
2. Contract drift and cross-module consistency.
3. Missing validation, migrations, and tests.
4. Maintainability only where it creates material engineering risk.

If no findings exist, say so and identify remaining test gaps or residual risk.

## Locked contracts

- `docs/contracts/pricing-v5.md`: cost -> profit -> price; install is per-unit; material source is
  `elite_furnishes | owner_furnishes`; the regression bid remains `$15,205.54`.
- `docs/contracts/sheet-template-v5.md`: the app writes hidden `App_*` tabs; visible tabs contain
  formulas and estimator overrides; the database stores inputs, not computed bid totals.
- One source of truth per concern: link to contracts rather than restating them in competing docs.

## Working rules

- Follow `CONTRIBUTING.md` for branches, planning, pull requests, and document lifecycle.
- Never review an unspecified dirty worktree as though it were an approved change set.
- Keep documentation cleanup, tooling, refactors, and behavioral work in separate commits/PRs.
- For parallel implementation, use separate branches and worktrees; never write the same worktree
  concurrently with Claude.
