# Continuity capsule

- Objective: deliver EvoWalker's controller-first MVP in ordered, evidence-gated slices.
- Current state: deterministic fixed-quadruped simulation, legacy controller GA, continuous
  controller-only quality-diversity archive, uninterrupted replay, worker exploration, and
  schema-v2 resumable persistence are implemented.
- Canonical instructions: `AGENTS.md`; preserved source brief: the numbered root files.
- Evidence: `docs/verification.md`, automated suites, and canonical benchmark tables.
- Decisions: `docs/decisions/0001-controller-first-workspace.md`,
  `docs/decisions/0002-browser-worker-and-persistence.md`, and
  `docs/decisions/0003-continuous-quality-diversity-quadruped.md`.
- Release evidence: the authored Playwright suite passes all three production-build journeys;
  the live production advisory query reports no known vulnerabilities; the integrity and
  recovery gates are recorded in `docs/verification.md`.
- Publication readiness: an MIT licence and minimal GitHub Actions verification workflow are
  prepared locally. The hosted workflow remains unobserved until a remote is explicitly approved.
- Live evidence: seed 42 reached 512 evaluations, 22/64 viable niches, champion fitness
  `1.48828`, forward progress `1.3133`, and zero fall penalty without console errors; the tab was
  left paused at that boundary.
- Next review trigger: morphology evolution remains a separate, explicitly authorized phase.
