# Documentation Index

This index identifies current sources of truth and prevents proposals from competing with implemented
behavior. The lifecycle and required metadata are defined in `../CONTRIBUTING.md`.

Last reconciled: 2026-06-19

## Controlling Documents

Only one document may control a given concern.

| Document | Concern |
|---|---|
| [v1-plan.md](v1-plan.md) | Product scope and priorities |
| [architecture.md](architecture.md) | Implemented technical architecture |
| [contracts/sheet-template-v5.md](contracts/sheet-template-v5.md) | Google Sheet tabs, fields, and sync contract |
| [contracts/pricing-v5.md](contracts/pricing-v5.md) | Bid pricing and profit math |
| [../CONTRIBUTING.md](../CONTRIBUTING.md) | Engineering and review process |

## Repository Guidance

| Document | Purpose |
|---|---|
| [../CLAUDE.md](../CLAUDE.md) | Claude primary-implementer instructions |
| [../AGENTS.md](../AGENTS.md) | Codex planning/review instructions |

These files define agent behavior; they are not product specifications or task-status files.

## Active References

| Document | Status | Concern |
|---|---|---|
| [runbooks/nola-portal.md](runbooks/nola-portal.md) | active | NOLA OneStop document retrieval procedure |
| [evals/finish-read-notes.md](evals/finish-read-notes.md) | active | Dated finish-extraction observations and evaluation evidence |
| [plans/active/takeoff-measurement.md](plans/active/takeoff-measurement.md) | proposal | Traceable plan-measurement design; not approved or implemented |

## Archive

Archived documents are historical context and must not be treated as current instructions.

| Document | Reason archived |
|---|---|
| [archive/2026-06/repository-cleanup-proposal.md](archive/2026-06/repository-cleanup-proposal.md) | Cleanup proposal executed in part; its file-based handoff was superseded by `CONTRIBUTING.md` |
| [archive/2026-06/current-process.md](archive/2026-06/current-process.md) | Point-in-time flow notes that drifted from the schema and implementation |
| [archive/2026-06/estimator-plan.md](archive/2026-06/estimator-plan.md) | Superseded multi-agent execution plan and coordination log |
| [archive/2026-06/estimate-flow-spec.md](archive/2026-06/estimate-flow-spec.md) | Earlier flow specification superseded by current code and architecture |
| [archive/2026-06/estimator-workflow.md](archive/2026-06/estimator-workflow.md) | Earlier engineering workflow superseded by `CONTRIBUTING.md` |
| [archive/2026-06/pipeline-strategy.md](archive/2026-06/pipeline-strategy.md) | Earlier sourcing/estimator strategy |
| [archive/2026-06/final-proposal.md](archive/2026-06/final-proposal.md) | Superseded proposal synthesis |
| [archive/2026-06/codex-estimator-pipeline-proposal.md](archive/2026-06/codex-estimator-pipeline-proposal.md) | Superseded Codex proposal |
| [archive/2026-06/codex-final-estimator-proposal.md](archive/2026-06/codex-final-estimator-proposal.md) | Superseded Codex proposal synthesis |

## Assets

`assets/` currently contains unreferenced UI/design images from the June 2026 cleanup. The owner must
either reference meaningful images from an active document or remove them in a dedicated cleanup PR.
Third-party plan sets belong in the git-ignored `samples/` directory, never under `docs/`.
