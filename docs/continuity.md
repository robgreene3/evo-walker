# Continuity capsule

- Objective: deliver EvoWalker's controller-first MVP in ordered, evidence-gated slices.
- Current state: deterministic simulation, controller-only GA, lineage/diversity, worker
  evolution, responsive champion UI, and strict local/JSON persistence are implemented.
- Canonical instructions: `AGENTS.md`; preserved source brief: the numbered root files.
- Evidence: `docs/verification.md`, automated suites, and canonical benchmark tables.
- Decisions: `docs/decisions/0001-controller-first-workspace.md` and
  `docs/decisions/0002-browser-worker-and-persistence.md`.
- Release evidence: the authored Playwright suite passes all three production-build journeys;
  the live production advisory query reports no known vulnerabilities; the integrity and
  recovery gates are recorded in `docs/verification.md`.
- Next review trigger: morphology evolution is a separate, explicitly authorized project phase.
  Preserve the brief hashes and canonical controller benchmark if that phase is opened.
