# Continuity capsule

- Objective: deliver EvoWalker's controller-first MVP in ordered, evidence-gated slices.
- Current state: repository baseline, deterministic single-creature episode, stable fixed
  phenotype, controller-only GA mechanics, and the worker protocol foundation are verified.
  Lineage/diversity state and browser responsiveness remain before those slices fully close.
- Canonical instructions: `AGENTS.md`; preserved source brief: the numbered root files.
- Evidence: `docs/verification.md` and the unit/reproducibility suites.
- Decisions: `docs/decisions/0001-controller-first-workspace.md`.
- Unresolved: controller lineage/diversity, browser worker responsiveness, browser critical
  journey, persistence, and release/accessibility/performance gates.
- Next review trigger: complete and verify lineage/diversity state, then refresh React and
  Three.js APIs before adding the UI.
