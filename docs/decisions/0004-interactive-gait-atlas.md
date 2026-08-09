# Decision 0004: Isolated interactive gait atlas

Status: accepted on 2026-08-09.

## Context

The controller archive contained many reproducible behaviors, but the web app rendered its
occupied cells as a passive heatmap and replayed only the current champion. Making archive
diversity experiential must not interrupt or contaminate the authoritative exploration worker.

## Decision

Occupied archive cells are keyboard-operable replay controls. Selection sends the archived
periodic genome through protocol v2 to a separate browser worker, which runs the same
deterministic episode function used for evaluation. The UI displays a specimen only after its
fitness and behavior descriptors reproduce the archived entry within `1e-9`; the live archive,
champion, checkpoint, and PRNG stream remain owned by the exploration worker.

The renderer rounds the torso and marks the eight physical joint anchors, but continues to
consume only authoritative immutable body transforms. No physical dimensions, morphology,
fitness, controller genes, or evolutionary operators change.

## Consequences

- A user can inspect a niche's motion, fitness components, controller, and ancestry while
  evaluation counts continue advancing.
- “Follow live champion” explicitly exits specimen mode; persistence always serializes the live
  champion episode, never the transient inspected specimen.
- The extra worker exists only during inspection and is terminated on replacement, reset, load,
  return to champion, or unmount.
- Any future replay payload change requires another worker protocol version and equivalence
  evidence.
