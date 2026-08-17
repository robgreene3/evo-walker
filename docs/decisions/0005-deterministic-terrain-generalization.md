# Decision 0005: Deterministic terrain before morphology

Status: accepted on 2026-08-09.

## Context

The continuous controller archive produced inspectable level-ground gaits, but prolonged viewing
did not expose adaptation to changing physical demands. Adding body genes now would confound
controller search, physics, fitness, and visualization before any one of those boundaries could
be falsified independently.

## Decision

Add one versioned, seeded terrain generator with four bounded courses: the unchanged flat proving
ground, a gentle rise, two low curbs, and a shallow uneven trail. A course is an immutable list of
box colliders consumed by both Rapier and Three.js. Terrain kind, seed, and generator version cross
the worker protocol and are stored redundantly in experiment configuration, physics metadata, and
episode provenance; schema validation requires those copies to agree.

Hold morphology, the eight-joint periodic genome, search operators, fitness weights, timestep, and
episode duration constant. A seeded benchmark must find a viable controller on every non-flat
course with meaningful forward progress, at least one crossed feature, multiple gait niches, and
exact replay. Version-2 archives migrate only to flat ground, their sole historical environment.

## Consequences

- Users can watch visibly different physical challenges while the scientific variable remains
  controller adaptation.
- The flat benchmark remains a compatibility baseline rather than being silently replaced.
- “Features cleared” is descriptive evidence, not a fitness term; ranking remains explainable by
  the existing component equation.
- Terrain seed controls geometry, while experiment seed controls evolutionary randomness.
- Morphology evolution remains a separate future phase requiring its own representation,
  validity, repair, and benchmark decisions.
