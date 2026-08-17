# Continuity capsule

- Objective: deliver EvoWalker's controller-first MVP in ordered, evidence-gated slices.
- Current state: deterministic fixed-quadruped simulation, legacy controller GA, continuous
  controller-only quality-diversity archive, uninterrupted replay, worker exploration, four
  seeded physical courses, and schema-v3 resumable persistence are implemented.
- Canonical instructions: `AGENTS.md`; preserved source brief: the numbered root files.
- Evidence: `docs/verification.md`, automated suites, and canonical benchmark tables.
- Decisions: `docs/decisions/0001-controller-first-workspace.md`,
  `docs/decisions/0002-browser-worker-and-persistence.md`,
  `docs/decisions/0003-continuous-quality-diversity-quadruped.md`,
  `docs/decisions/0004-interactive-gait-atlas.md`, and
  `docs/decisions/0005-deterministic-terrain-generalization.md`.
- Release evidence: the authored Playwright suite passes the production critical journey in
  Chromium, Firefox, and WebKit plus a 720-evaluation sustained Chromium run; the live production
  advisory query reports no known vulnerabilities; the integrity and recovery gates are recorded
  in `docs/verification.md`.
- Publication state: `robgreene3/evo-walker` contains the earlier verified `main` baseline and
  protected `controller-first-mvp` tag. The quality-diversity and gait-atlas commits remain local
  on `feat/controller-first-mvp` until a separate publication decision.
- Live evidence: seed 42 reached 3,038 evaluations, 25/64 viable niches, champion fitness
  `1.51858`, and a complete viable trial without console errors.
- Terrain evidence: seed 42 found a viable, feature-clearing controller on each mild non-flat
  course after 120 complete evaluations; the terrain checkpoint journey passes Chromium,
  Firefox, and WebKit.
- Next review trigger: consider cross-course evaluation and bounded curricula before any body
  genes. Morphology evolution remains a separate phase with new validity and repair obligations.
